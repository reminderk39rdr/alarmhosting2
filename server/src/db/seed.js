import { loadSeedData } from '../data.js';
import { getDb, schema } from './client.js';

const normalizeUsers = (users) =>
  users.map((user) => ({
    ...user,
  }));

const normalizeResources = (resources) =>
  resources.map((resource) => ({
    id: resource.id,
    type: resource.type,
    label: resource.label,
    hostname: resource.hostname,
    provider: resource.provider,
    expiryDate: resource.expiryDate,
    status: resource.status,
    renewalUrl: resource.renewalUrl,
    notes: resource.notes,
    lastChecked: resource.lastChecked ? new Date(resource.lastChecked) : null,
  }));

const normalizeReminders = (reminders) =>
  reminders.map((reminder) => ({
    id: reminder.id,
    resourceId: reminder.resourceId,
    dueInDays: reminder.dueInDays,
    scheduledFor: reminder.scheduledFor
      ? new Date(reminder.scheduledFor)
      : new Date(),
    severity: reminder.severity,
    channel: reminder.channel,
    message: reminder.message,
  }));

export const ensureSeedData = async () => {
  const db = getDb();
  if (!db) return;
  const data = await loadSeedData();
  const [user] = await db.select().from(schema.users).limit(1);
  if (!user) {
    await db.insert(schema.users).values(normalizeUsers(data.users));
  }
  const [resource] = await db.select().from(schema.resources).limit(1);
  if (!resource) {
    await db.insert(schema.resources).values(normalizeResources(data.resources));
  }
  const [reminder] = await db.select().from(schema.reminders).limit(1);
  if (!reminder) {
    await db.insert(schema.reminders).values(normalizeReminders(data.reminders));
  }
};
