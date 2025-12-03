import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { loadSeedData } from './data.js';
import { getState, createResource as createFileResource } from './store.js';
import { getDb, schema } from './db/client.js';
import { ensureSeedData } from './db/seed.js';
import { desc, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const db = getDb();

const bootstrapDatabase = async () => {
  if (!db) return;
  try {
    await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
    await ensureSeedData();
  } catch (error) {
    console.error('Database bootstrap failed', error);
  }
};

bootstrapDatabase();

app.use(
  cors({
    origin: ALLOWED_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());

const memorySessions = new Map();

const createSessionRecord = async (userId) => {
  const sessionId = randomUUID();
  const now = new Date();
  if (db) {
    await db.insert(schema.sessions).values({
      id: sessionId,
      userId,
      createdAt: now,
      lastSeenAt: now,
    });
  } else {
    memorySessions.set(sessionId, { userId, lastSeenAt: now });
  }
  return sessionId;
};

const findSessionUserId = async (sessionId) => {
  if (!sessionId) return null;
  if (db) {
    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .limit(1);
    if (!session) return null;
    await db
      .update(schema.sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(schema.sessions.id, sessionId));
    return session.userId;
  }
  const existing = memorySessions.get(sessionId);
  if (!existing) return null;
  existing.lastSeenAt = new Date();
  memorySessions.set(sessionId, existing);
  return existing.userId;
};

const destroySessionRecord = async (sessionId) => {
  if (!sessionId) return;
  if (db) {
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));
  } else {
    memorySessions.delete(sessionId);
  }
};

const getSessionUserId = async (req) => {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) return null;
  return findSessionUserId(sessionId);
};

const normalizeUser = (user) =>
  user
    ? {
        ...user,
        isAdmin: Boolean(user.isAdmin),
      }
    : null;

const normalizeResource = (resource) => {
  if (!resource) return null;
  const lastChecked =
    resource.lastChecked instanceof Date
      ? resource.lastChecked.toISOString()
      : resource.lastChecked ?? new Date().toISOString();
  return {
    ...resource,
    status: resource.status ?? 'healthy',
    renewalUrl: resource.renewalUrl ?? '',
    notes: resource.notes ?? '',
    lastChecked,
    tags: Array.isArray(resource.tags) ? resource.tags : [],
  };
};

const normalizeReminder = (reminder) => {
  if (!reminder) return null;
  return {
    ...reminder,
    channel: reminder.channel ?? 'telegram',
    severity: reminder.severity ?? 'low',
    message: reminder.message ?? '',
    scheduledFor:
      reminder.scheduledFor instanceof Date
        ? reminder.scheduledFor.toISOString()
        : reminder.scheduledFor ?? new Date().toISOString(),
  };
};

const ensureUserExists = async (userId) => {
  if (!userId) return null;
  if (db) {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return normalizeUser(user);
  }
  const data = await getState();
  return data.users.find((user) => user.id === userId) ?? null;
};

const buildCalendar = (data, { range = 30, types = null, statuses = null } = {}) => {
  const maxRange = Math.min(Math.max(range, 1), 180);
  const now = new Date();
  const events = data.reminders
    .map((reminder) => ({
      ...reminder,
      resource: data.resources.find((item) => item.id === reminder.resourceId),
    }))
    .filter((item) => {
      if (!item.resource) return false;
      if (types && !types.includes(item.resource.type)) return false;
      if (statuses && !statuses.includes(item.resource.status)) return false;
      const eventDate = new Date(item.scheduledFor);
      const diffInDays =
        (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffInDays <= maxRange && diffInDays >= -30;
    });

  const grouped = events.reduce((acc, event) => {
    const dateKey = event.scheduledFor.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const timeline = Object.entries(grouped)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([date, groupedEvents]) => ({ date, events: groupedEvents }));

  return {
    range: maxRange,
    count: events.length,
    days: timeline,
  };
};

const mapResourcePayload = (payload) => ({
  id: payload.id ?? `res-${randomUUID()}`,
  type: payload.type,
  label: payload.label,
  hostname:
    payload.hostname ??
    `${payload.label.toLowerCase().replace(/\s+/g, '-')}.local`,
  provider: payload.provider,
  expiryDate: payload.expiryDate,
  status: payload.status ?? 'healthy',
  renewalUrl: payload.renewalUrl ?? '',
  notes: payload.notes ?? '',
  lastChecked: payload.lastChecked ? new Date(payload.lastChecked) : new Date(),
});

const createResourceEntry = async (payload) => {
  if (db) {
    const resource = mapResourcePayload(payload);
    const [inserted] = await db
      .insert(schema.resources)
      .values(resource)
      .returning();
    return normalizeResource(inserted);
  }
  return createFileResource(payload);
};

const alertHistory = [];

const recordAlertLog = async (entry) => {
  const normalized = {
    ...entry,
    id: entry.id ?? randomUUID(),
    sentAt: entry.sentAt ?? new Date().toISOString(),
  };
  if (!db) {
    alertHistory.push(normalized);
    return normalized;
  }
  try {
    await db.insert(schema.alertLogs).values({
      id: normalized.id,
      channel: normalized.channel,
      target: normalized.target,
      status: normalized.status,
      payload: normalized.payload ? JSON.stringify(normalized.payload) : null,
      error: normalized.error ?? null,
      sentAt: new Date(normalized.sentAt),
    });
  } catch (error) {
    console.error('Gagal menyimpan alert log ke database', error);
    alertHistory.push(normalized);
  }
  return normalized;
};

const fetchAlertHistory = async (limit) => {
  if (!db) {
    return alertHistory.slice(-limit).reverse();
  }
  try {
    const rows = await db
      .select()
      .from(schema.alertLogs)
      .orderBy(desc(schema.alertLogs.sentAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      target: row.target,
      status: row.status,
      sentAt: row.sentAt
        ? row.sentAt.toISOString()
        : new Date().toISOString(),
      error: row.error ?? undefined,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
    }));
  } catch (error) {
    console.error('Gagal membaca alert log dari database', error);
    return alertHistory.slice(-limit).reverse();
  }
};

const loadOverview = async () => {
  if (db) {
    const [usersData, resourcesData, remindersData, seed] = await Promise.all([
      db.select().from(schema.users),
      db.select().from(schema.resources),
      db.select().from(schema.reminders),
      loadSeedData(),
    ]);
    return {
      users: usersData.map(normalizeUser),
      resources: resourcesData.map(normalizeResource),
      reminders: remindersData.map(normalizeReminder),
      activity: seed.activity,
    };
  }
  return getState();
};

const loadCalendarData = async (params) => {
  if (db) {
    const [resourcesData, remindersData] = await Promise.all([
      db.select().from(schema.resources),
      db.select().from(schema.reminders),
    ]);
    return buildCalendar(
      {
        resources: resourcesData.map(normalizeResource),
        reminders: remindersData.map(normalizeReminder),
      },
      params
    );
  }
  const data = await getState();
  return buildCalendar(data, params);
};

app.get('/', (_req, res) => {
  res.json({
    message: 'AlarmHosting API',
    docs: 'See README for available endpoints.',
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/dashboard/overview', async (_req, res, next) => {
  try {
    const data = await loadOverview();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get('/calendar', async (req, res, next) => {
  try {
    const range = Number.parseInt(req.query.range ?? '30', 10);
    const types = req.query.types ? String(req.query.types).split(',') : null;
    const statuses = req.query.statuses
      ? String(req.query.statuses).split(',')
      : null;

    const calendar = await loadCalendarData({ range, types, statuses });
    res.json(calendar);
  } catch (error) {
    next(error);
  }
});

app.get('/reports/upcoming', async (req, res, next) => {
  try {
    const format = (req.query.format || 'json').toString().toLowerCase();
    const calendar = await loadCalendarData({
      range: Number.parseInt(req.query.range ?? '30', 10),
      types: req.query.types ? String(req.query.types).split(',') : null,
      statuses: req.query.statuses ? String(req.query.statuses).split(',') : null,
    });

    if (format === 'csv') {
      const rows = [['Date', 'Resource', 'Type', 'Status', 'Message']];
      calendar.days.forEach((day) => {
        day.events.forEach((event) => {
          rows.push([
            day.date,
            event.resource?.label ?? event.resourceId,
            event.resource?.type ?? 'unknown',
            event.resource?.status ?? '-',
            event.message ?? '',
          ]);
        });
      });
      const csv = rows
        .map((row) => row.map((item) => `"${item}"`).join(','))
        .join('\n');
      res.header('Content-Type', 'text/csv');
      res.attachment('upcoming.csv');
      return res.send(csv);
    }

    res.json(calendar);
  } catch (error) {
    next(error);
  }
});

const validActions = new Set(['preview', 'snooze', 'mark_done']);

app.post('/actions/telegram', async (req, res) => {
  const { reminderId, action, metadata } = req.body || {};
  if (!reminderId || !validActions.has(action)) {
    return res.status(400).json({
      error: 'reminderId dan action (preview|snooze|mark_done) wajib diisi',
    });
  }

  const responsePayload = {
    status: 'queued',
    reminderId,
    action,
    metadata,
    dispatchedAt: new Date().toISOString(),
  };

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    await recordAlertLog({
      channel: 'telegram',
      target: TELEGRAM_CHAT_ID || 'mock-chat',
      payload: responsePayload,
      status: 'queued',
      sentAt: responsePayload.dispatchedAt,
    });
    return res.json(responsePayload);
  }

  const text = `[AlarmHosting] ${action.toUpperCase()} untuk reminder ${reminderId}${
    metadata?.resource ? ` (${metadata.resource})` : ''
  }`;

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
        }),
      }
    );
    if (!telegramResponse.ok) {
      const errorMessage = await telegramResponse.text();
      throw new Error(errorMessage || 'Telegram API error');
    }
    const data = await telegramResponse.json();
    const record = {
      channel: 'telegram',
      target: TELEGRAM_CHAT_ID,
      payload: { ...responsePayload, telegram: data },
      status: 'sent',
      sentAt: new Date().toISOString(),
    };
    await recordAlertLog(record);
    return res.json(record.payload);
  } catch (error) {
    console.error('Telegram dispatch failed:', error);
    await recordAlertLog({
      channel: 'telegram',
      target: TELEGRAM_CHAT_ID || 'unknown-chat',
      payload: responsePayload,
      status: 'failed',
      sentAt: new Date().toISOString(),
      error: error.message,
    });
    return res.status(502).json({ error: 'Gagal mengirim ke Telegram.' });
  }
});

app.post('/integrations/email/test', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email wajib diisi.' });
  }
  const record = {
    id: randomUUID(),
    channel: 'email',
    target: email,
    status: 'sent',
    sentAt: new Date().toISOString(),
  };
  await recordAlertLog(record);
  res.json(record);
});

app.post('/integrations/slack/test', async (req, res) => {
  const { channel } = req.body || {};
  if (!channel) {
    return res.status(400).json({ error: 'Channel Slack wajib diisi.' });
  }
  const record = {
    id: randomUUID(),
    channel: 'slack',
    target: channel,
    status: 'sent',
    sentAt: new Date().toISOString(),
  };
  await recordAlertLog(record);
  res.json(record);
});

app.post('/resources', async (req, res, next) => {
  try {
    const { type, label, provider, expiryDate } = req.body || {};
    if (!type || !label || !provider || !expiryDate) {
      return res.status(400).json({
        error: 'type, label, provider, dan expiryDate wajib diisi.',
      });
    }
    const resource = await createResourceEntry(req.body);
    res.status(201).json(resource);
  } catch (error) {
    next(error);
  }
});

app.get('/alerts/history', async (req, res, next) => {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Login diperlukan untuk melihat log.' });
    }
    const user = await ensureUserExists(userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Hanya admin yang dapat melihat log alert.' });
    }
    const limit = Number.parseInt(req.query.limit ?? '20', 10);
    const trimmed = Number.isNaN(limit) ? 20 : Math.min(Math.max(limit, 1), 200);
    const items = await fetchAlertHistory(trimmed);
    res.json({ count: items.length, items });
  } catch (error) {
    next(error);
  }
});

app.get('/auth/me', async (req, res, next) => {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return res.status(401).json({ user: null });
    }
    const user = await ensureUserExists(userId);
    if (!user) {
      return res.status(401).json({ user: null });
    }
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post('/auth/login', async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId wajib diisi.' });
    }
    const user = await ensureUserExists(userId);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }
    const sessionId = await createSessionRecord(user.id);
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post('/auth/logout', async (req, res) => {
  const sessionId = req.cookies?.session_id;
  if (sessionId) {
    await destroySessionRecord(sessionId);
  }
  res.clearCookie('session_id');
  res.json({ ok: true });
});

// error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`AlarmHosting API listening on http://localhost:${PORT}`);
});
