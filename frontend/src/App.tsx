import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { API_BASE_URL } from './config';
import { fetchSeedData } from './services/dataService';
import {
  fetchSessionUser,
  loginUser,
  logoutUser,
} from './services/authService';
import {
  getStoredAlertPrefs,
  setStoredAlertPrefs,
} from './services/preferencesService';
import { sendTelegramAction } from './services/telegramService';
import {
  fetchCalendarData,
  buildCsvFromCalendar,
} from './services/calendarService';
import { fetchAlertHistory } from './services/alertHistoryService';
import { createResource } from './services/resourceService';
import { sendEmailTest, sendSlackTest } from './services/integrationService';
import type {
  ActivityItem,
  AlertPreference,
  AlertHistoryItem,
  CalendarResponse,
  Reminder,
  Resource,
  ResourceType,
  User,
} from './types';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const shortFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
});

const typeLabels: Record<ResourceType, string> = {
  domain: 'Domain',
  hosting: 'Hosting',
  ssl: 'SSL/TLS',
  email: 'Email Suite',
};

const resourceIcon: Record<ResourceType, string> = {
  domain: '🌐',
  hosting: '🗄️',
  ssl: '🔐',
  email: '✉️',
};

const getDaysUntil = (iso: string) => {
  const now = new Date();
  const target = new Date(iso);
  const msInDay = 1000 * 60 * 60 * 24;
  return Math.ceil((target.getTime() - now.getTime()) / msInDay);
};

const statusLabel = {
  healthy: 'Aman',
  'due-soon': 'Perlu perhatian',
  overdue: 'Overdue',
};

const statusClass = {
  healthy: 'badge healthy',
  'due-soon': 'badge warning',
  overdue: 'badge danger',
};

const severityClass: Record<Reminder['severity'], string> = {
  low: 'timeline-chip low',
  medium: 'timeline-chip medium',
  high: 'timeline-chip high',
};

const severityLabel: Record<Reminder['severity'], string> = {
  low: 'Pengingat awal',
  medium: 'Prioritas menengah',
  high: 'Segera tindakan',
};

const formatTimeAgo = (iso: string) => {
  const diff = getDaysUntil(iso) * -1;
  if (diff === 0) return 'Hari ini';
  return diff === 1 ? 'Kemarin' : `${diff} hari lalu`;
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();

function App() {
  const [query, setQuery] = useState('');
  const [resources, setResources] = useState<Resource[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    type: 'domain' as ResourceType,
    label: '',
    provider: '',
    expiryDate: '',
  });
  const [currentUserId, setCurrentUserId] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<
    (ActivityItem & { resource?: Resource }) | null
  >(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [toastStatus, setToastStatus] = useState<{
    type: 'success' | 'error';
    message: string;
    id: string;
  } | null>(null);
  const [integrationPending, setIntegrationPending] = useState(false);
  const [alertPrefs, setAlertPrefs] = useState<AlertPreference>(
    getStoredAlertPrefs()
  );
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(
    null
  );
  const [calendarPending, setCalendarPending] = useState(false);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);
  const [resourcePending, setResourcePending] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const data = await fetchSeedData();
        if (!isMounted) return;
        setResources(data.resources);
        setReminders(data.reminders);
        setActivityLog(data.activity);
        setUsers(data.users);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat memuat data.'
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [reloadCounter]);

  useEffect(() => {
    if (!resources.length || !reminders.length) return;
    let active = true;
    setCalendarPending(true);
    fetchCalendarData(reminders, resources, { range: 30 })
      .then((data) => {
        if (active) setCalendarData(data);
      })
      .catch((error) => {
        console.warn('[calendar] gagal memuat', error);
      })
      .finally(() => {
        if (active) setCalendarPending(false);
      });
    return () => {
      active = false;
    };
  }, [resources, reminders]);
  
  useEffect(() => {
    if (!API_BASE_URL) return;
    fetchAlertHistory(50)
      .then(setAlertHistory)
      .catch((error) => {
        console.warn('[alert-history] gagal memuat', error);
      });
  }, [integrationPending]);

  useEffect(() => {
    if (!selectedId && resources[0]) {
      setSelectedId(resources[0].id);
    }
  }, [resources, selectedId]);

  useEffect(() => {
    if (!users.length) return;
    let active = true;
    fetchSessionUser()
      .then((userId) => {
        if (active && userId && users.some((user) => user.id === userId)) {
          setCurrentUserId(userId);
        }
      })
      .catch((error) => {
        console.warn('[auth] fetch session failed', error);
      });
    return () => {
      active = false;
    };
  }, [users]);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [users, currentUserId]
  );
  const adminUser = users.find((user) => user.isAdmin);
  const [authPending, setAuthPending] = useState(false);

  const handleLogin = async (userId: string) => {
    if (!users.some((user) => user.id === userId)) return;
    setAuthPending(true);
    try {
      await loginUser(userId);
      setCurrentUserId(userId);
      setToastStatus({
        type: 'success',
        message: 'Login berhasil.',
        id: crypto.randomUUID(),
      });
    } catch (error) {
      setToastStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Login gagal.',
        id: crypto.randomUUID(),
      });
    } finally {
      setAuthPending(false);
    }
  };

  const handleLogout = async () => {
    setAuthPending(true);
    try {
      await logoutUser();
    } catch (error) {
      console.warn('[auth] logout failed', error);
    } finally {
      setCurrentUserId('');
      setAuthPending(false);
    }
  };

  const handleSwitchToAdmin = () => {
    if (adminUser) handleLogin(adminUser.id);
  };
  const handleSelectActivity = (activity: ActivityItem) => {
    const resource = resources.find((res) => res.id === activity.resourceId);
    setSelectedActivity({ ...activity, resource });
  };
  const updateAlertPref = (patch: Partial<AlertPreference>) => {
    setAlertPrefs((prev) => {
      const next = { ...prev, ...patch };
      setStoredAlertPrefs(next);
      return next;
    });
  };
  const handleTelegramAction = async (
    action: 'preview' | 'snooze' | 'mark_done',
    reminder: Reminder & { resource?: Resource } | null
  ) => {
    if (!reminder) {
      setToastStatus({
        type: 'error',
        message: 'Tidak ada reminder yang dipilih.',
        id: crypto.randomUUID(),
      });
      return;
    }
    setActionPending(true);
    setToastStatus(null);
    try {
      await sendTelegramAction({
        reminderId: reminder.id,
        action,
        metadata: {
          resource: reminder.resource?.label ?? reminder.resourceId,
        },
      });
      const successMap = {
        preview: 'Preview terkirim ke Telegram.',
        snooze: 'Reminder disnooze 3 hari.',
        mark_done: 'Reminder ditandai selesai.',
      };
      setToastStatus({
        type: 'success',
        message: successMap[action],
        id: crypto.randomUUID(),
      });
    } catch (err) {
      setToastStatus({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal mengirim aksi Telegram.',
        id: crypto.randomUUID(),
      });
    } finally {
      setActionPending(false);
    }
  };
  const handleIntegrationTest = async (channel: 'email' | 'slack') => {
    setIntegrationPending(true);
    setToastStatus(null);
    try {
      if (channel === 'email') {
        await sendEmailTest(alertPrefs.emailEnabled ? alertPrefs.email : '');
        setToastStatus({
          type: 'success',
          message: `Email test dikirim ke ${alertPrefs.email}.`,
          id: crypto.randomUUID(),
        });
      } else {
        await sendSlackTest(
          alertPrefs.slackEnabled ? alertPrefs.slackChannel : ''
        );
        setToastStatus({
          type: 'success',
          message: `Notifikasi Slack dikirim ke ${alertPrefs.slackChannel}.`,
          id: crypto.randomUUID(),
        });
      }
    } catch (err) {
      setToastStatus({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal mengirim notifikasi.',
        id: crypto.randomUUID(),
      });
    } finally {
      setIntegrationPending(false);
    }
  };

  const handleExportCalendar = () => {
    if (API_BASE_URL) {
      const exportUrl = `${API_BASE_URL}/reports/upcoming?format=csv`;
      window.open(exportUrl, '_blank', 'noopener');
      return;
    }
    if (!calendarData) return;
    const csv = buildCsvFromCalendar(calendarData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'upcoming.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const filteredResources = useMemo(() => {
    if (!query.trim()) return resources;
    const lower = query.toLowerCase();
    return resources.filter(
      (res) =>
        res.label.toLowerCase().includes(lower) ||
        res.hostname.toLowerCase().includes(lower) ||
        res.provider.toLowerCase().includes(lower)
    );
  }, [query, resources]);

  const sortedResources = useMemo(
    () =>
      [...filteredResources].sort(
        (a, b) =>
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      ),
    [filteredResources]
  );

  const selectedResource =
    resources.find((item) => item.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const total = resources.length;
    const dueThisWeek = resources.filter(
      (res) => res.status !== 'overdue' && getDaysUntil(res.expiryDate) <= 7
    ).length;
    const overdue = resources.filter((res) => res.status === 'overdue').length;
    return { total, dueThisWeek, overdue };
  }, [resources]);

  const timeline = useMemo(
    () =>
      reminders
        .slice()
        .sort((a, b) => a.dueInDays - b.dueInDays)
        .map((item) => ({
          ...item,
          resource: resources.find((res) => res.id === item.resourceId),
        })),
    [reminders, resources]
  );

  const upcomingBuckets = useMemo(() => {
    const buckets = {
      week: [] as Resource[],
      month: [] as Resource[],
      later: [] as Resource[],
    };
    resources.forEach((res) => {
      const days = getDaysUntil(res.expiryDate);
      if (days <= 7) buckets.week.push(res);
      else if (days <= 30) buckets.month.push(res);
      else buckets.later.push(res);
    });
    return buckets;
  }, [resources]);
  const canViewLog = currentUser?.isAdmin ?? false;
  const nextReminder = useMemo(() => {
    if (!reminders.length) return null;
    const next = reminders
      .slice()
      .sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime()
      )[0];
    return {
      ...next,
      resource: resources.find((res) => res.id === next.resourceId),
    };
  }, [reminders, resources]);
  const personalQueue = useMemo(
    () => reminders.filter((item) => item.dueInDays <= 7),
    [reminders]
  );
  const personalDueSoon = personalQueue.filter((item) => item.dueInDays >= 0).length;
  const personalOverdue = personalQueue.length - personalDueSoon;

  if (loading) {
    return (
      <div className="layout status-layout">
        <div className="status-card">
          <p>Memuat data dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="layout status-layout">
        <div className="status-card">
          <p>{error}</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Muat ulang
          </button>
        </div>
      </div>
    );
  }

  const onSubmitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.label || !formState.expiryDate || !formState.provider) {
      setFormAlert('Lengkapi nama resource, provider, dan tanggal.');
      return;
    }
    setResourcePending(true);
    setFormAlert(null);
    try {
      const created = await createResource(formState);
      if (API_BASE_URL) {
        setReloadCounter((prev) => prev + 1);
      } else {
        setResources((prev) => [...prev, created]);
      }
      setFormAlert(`Resource ${created.label} berhasil disimpan.`);
      setFormState((prev) => ({
        ...prev,
        label: '',
        provider: '',
        expiryDate: '',
      }));
    } catch (error) {
      setFormAlert(
        error instanceof Error ? error.message : 'Gagal menyimpan resource.'
      );
    } finally {
      setResourcePending(false);
    }
  };

  return (
    <div className="layout">
      <header className="topbar">
        <div className="logo-block">
          <div className="logo-mark">AH</div>
          <div>
            <p className="brand-name">Alarm Hosting</p>
            <p className="brand-subtitle">Domain & Hosting Renewal</p>
          </div>
        </div>
        <nav className="top-nav">
          <button className="top-nav-item active">Command Center</button>
          <button className="top-nav-item">Calendar</button>
          <button className="top-nav-item">Telegram Bot</button>
          <button className="top-nav-item">Reports</button>
        </nav>
          <div className="top-actions">
            <div className="search-control">
            <input
              type="text"
              placeholder="Cari resource atau provider"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span>⌘K</span>
          </div>
          <button className="ghost">Create brief</button>
          {currentUser ? (
            <div className="session-pill">
              <div>
                <p className="session-name">{currentUser.name}</p>
                <p className="session-role">
                  {currentUser.role}
                  {currentUser.isAdmin ? ' • Admin' : ''}
                </p>
              </div>
              <div className="avatar small">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} />
                ) : (
                  <span>{getInitials(currentUser.name)}</span>
                )}
              </div>
            </div>
          ) : (
            <button
              className="primary"
              onClick={() => setCurrentUserId(users[0]?.id ?? '')}
            >
              Login
            </button>
          )}
        </div>
      </header>

      <main className="page">
        <section className="hero">
          <div>
            <p className="eyebrow">
              {currentUser?.isAdmin ? 'Renewal overview — Asia/Jakarta' : 'My action queue'}
            </p>
            <h1>
              {currentUser?.isAdmin ? 'Renewal Command Center' : 'Workboard'}{' '}
              <span>
                {currentUser?.isAdmin
                  ? 'Dashboard'
                  : currentUser?.name.split(' ')[0] ?? 'Guest'}
              </span>
            </h1>
            <p className="hero-copy">
              {currentUser?.isAdmin
                ? 'KPI ringkas untuk domain & layanan hosting kritikal. Data siap dikirim ke channel Telegram.'
                : 'Lihat pengingat mendesak dan simulasi pesan Telegram sebelum broadcast.'}
            </p>
            <div className="hero-actions">
              {currentUser?.isAdmin ? (
                <>
                  <button className="primary">+ Reminder Baru</button>
                  <button className="ghost">Sinkronisasi bot</button>
                </>
              ) : (
                <>
                  <button className="primary">Mulai review hari ini</button>
                  <button className="ghost">Lihat calendar</button>
                </>
              )}
            </div>
          </div>
          <div className="hero-panel">
            {currentUser?.isAdmin ? (
              <>
                <p>Service Health</p>
                <div className="hero-stats">
                  <div>
                    <p className="hero-value">{stats.total}</p>
                    <p className="muted">Total resources</p>
                  </div>
                  <div>
                    <p className="hero-value warning">{stats.dueThisWeek}</p>
                    <p className="muted">Due &lt; 7 hari</p>
                  </div>
                  <div>
                    <p className="hero-value danger">{stats.overdue}</p>
                    <p className="muted">Overdue</p>
                  </div>
                </div>
                <div className="hero-foot">
                  <p>Next Telegram blast</p>
                  <p className="hero-foot-date">Senin, 09:00 WIB</p>
                </div>
              </>
            ) : (
              <>
                <p>My Tasks</p>
                <div className="hero-stats">
                  <div>
                    <p className="hero-value">{personalQueue.length}</p>
                    <p className="muted">Reminder ≤ 7 hari</p>
                  </div>
                  <div>
                    <p className="hero-value warning">{personalDueSoon}</p>
                    <p className="muted">Butuh follow up</p>
                  </div>
                  <div>
                    <p className="hero-value danger">{personalOverdue}</p>
                    <p className="muted">Overdue</p>
                  </div>
                </div>
                <div className="hero-foot">
                  <p>Prioritas Anda</p>
                  <p className="hero-foot-date">
                    {personalQueue[0]
                      ? shortFormatter.format(
                          new Date(personalQueue[0].scheduledFor)
                        )
                      : 'Semua aman'}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="key-metrics">
          <InsightCard
            title="Critical queue"
            value={`${upcomingBuckets.week.length}`}
            description="Resource jatuh tempo ≤ 7 hari."
          />
          <InsightCard
            title="Waiting confirmation"
            value={`${reminders.filter((r) => r.dueInDays <= 0).length}`}
            description="Reminder terkirim yang belum closing."
          />
          <InsightCard
            title="Next broadcast"
            value={
              nextReminder
                ? shortFormatter.format(new Date(nextReminder.scheduledFor))
                : '-'
            }
            description="Jadwal Telegram terdekat."
          />
        </section>

        <section className="main-grid">
          <div className="card resource-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Renewal pipeline</p>
                <h2>Prioritas 30 Hari</h2>
              </div>
              <div className="chip-row">
                <span className="chip">Minggu ini {upcomingBuckets.week.length}</span>
                <span className="chip">30 hari {upcomingBuckets.month.length}</span>
                <span className="chip muted">&gt; 30 hari {upcomingBuckets.later.length}</span>
              </div>
            </div>
            <ResourceTable
              resources={sortedResources}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <div className="resource-detail-block">
              <div className="detail-block-head">
                <p className="eyebrow">Selected asset</p>
                <button className="ghost small">Bagikan ke Telegram</button>
              </div>
              {selectedResource ? (
                <ResourceDetail
                  resource={selectedResource}
                  currentUser={currentUser}
                  getDaysUntil={getDaysUntil}
                />
              ) : (
                <p className="muted">Pilih resource untuk melihat detail.</p>
              )}
            </div>
          </div>

          <div className="compact-column">
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="eyebrow">Upcoming reminders</p>
                  <h2>Timeline & Preview</h2>
                </div>
                <button className="ghost small">Kelola jadwal</button>
              </div>
              <Timeline
                timeline={timeline}
                limit={3}
                onAction={handleTelegramAction}
                actionPending={actionPending}
              />
              <TelegramPreview
                reminder={nextReminder}
                actionPending={actionPending}
                onAction={handleTelegramAction}
              />
            </div>

            <div className="card calendar-entry-card">
              <div className="card-head">
                <div>
                  <p className="eyebrow">Calendar & Entry</p>
                  <h2>Agenda & Draft</h2>
                </div>
                <button className="ghost small" onClick={handleExportCalendar}>
                  Export CSV
                </button>
              </div>
              {calendarPending ? (
                <p className="muted">Memuat kalender...</p>
              ) : (
                <CalendarBoard calendarDays={calendarData?.days ?? []} />
              )}
              <div className="divider" />
              <QuickAddForm
                formState={formState}
                setFormState={setFormState}
                onSubmit={onSubmitForm}
                alert={formAlert}
                pending={resourcePending}
              />
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <p className="eyebrow">Alert center</p>
                  <h2>Email & Slack</h2>
                </div>
              </div>
              <AlertingPanel
                prefs={alertPrefs}
                onChange={updateAlertPref}
                onTest={handleIntegrationTest}
                pending={integrationPending}
              />
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <p className="eyebrow">Alert history</p>
                  <h2>Email/Slack/Telegram</h2>
                </div>
              </div>
              <AlertHistoryList items={alertHistory} />
            </div>

            <div className={`card ${!canViewLog ? 'locked' : ''}`}>
              <div className="card-head">
                <div>
                  <p className="eyebrow">Activity log</p>
                  <h2>Timeline Operasional</h2>
                </div>
                <button className="ghost small">Export CSV</button>
              </div>
              {canViewLog ? (
                <ActivityFeed
                  activityLog={activityLog}
                  onSelect={handleSelectActivity}
                />
              ) : (
                <div className="locked-state">
                  <p>Log hanya tersedia untuk admin.</p>
                  {adminUser && (
                    <button className="primary" onClick={handleSwitchToAdmin}>
                      Login sebagai {adminUser.name.split(' ')[0]}
                    </button>
                  )}
                </div>
              )}
            </div>

            <UserAccessCard
              users={users}
              currentUserId={currentUserId}
              onLogin={handleLogin}
              onLogout={handleLogout}
            />
          </div>
        </section>
      </main>
      {canViewLog && selectedActivity && (
        <ActivityModal
          item={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
      {toastStatus && (
        <Toast
          status={toastStatus}
          onDismiss={() => setToastStatus(null)}
        />
      )}
      {!currentUser && users.length > 0 && (
        <LoginPanel users={users} onLogin={handleLogin} pending={authPending} />
      )}
    </div>
  );
}

const InsightCard = ({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) => (
  <div className="insight-card">
    <p className="insight-title">{title}</p>
    <p className="insight-value">{value}</p>
    <p className="muted">{description}</p>
  </div>
);

interface ResourceTableProps {
  resources: Resource[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const ResourceTable = ({
  resources,
  selectedId,
  onSelect,
}: ResourceTableProps) => (
  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Resource</th>
          <th>Penyedia</th>
          <th>Expiry</th>
          <th>Channel</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {resources.map((resource) => (
          <tr
            key={resource.id}
            className={resource.id === selectedId ? 'selected' : ''}
            onClick={() => onSelect(resource.id)}
          >
            <td>
              <div className="resource-cell">
                <span className="resource-icon">
                  {resourceIcon[resource.type]}
                </span>
                <div>
                  <p className="resource-name">{resource.label}</p>
                  <p className="muted">{resource.hostname}</p>
                </div>
              </div>
            </td>
            <td>
              <p>{resource.provider}</p>
              <p className="muted">
                Cek {formatTimeAgo(resource.lastChecked)}
              </p>
            </td>
            <td>
              <p>{dateFormatter.format(new Date(resource.expiryDate))}</p>
              <p className="muted">
                {getDaysUntil(resource.expiryDate)} hari lagi
              </p>
            </td>
            <td>
              <p>Telegram</p>
              <p className="muted">Broadcast otomatis</p>
            </td>
            <td>
              <span className={statusClass[resource.status]}>
                {statusLabel[resource.status]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface TimelineProps {
  timeline: Array<Reminder & { resource?: Resource }>;
  limit?: number;
  onAction: (
    action: 'preview' | 'snooze' | 'mark_done',
    reminder: Reminder & { resource?: Resource }
  ) => void;
  actionPending: boolean;
}

const Timeline = ({ timeline, limit, onAction, actionPending }: TimelineProps) => (
  <ul className="timeline-list">
    {timeline.slice(0, limit ?? timeline.length).map((item) => (
      <li key={item.id}>
        <div className="timeline-date">
          <p>{item.dueInDays >= 0 ? `T-${item.dueInDays}` : `+${Math.abs(item.dueInDays)}`}</p>
          <span>{shortFormatter.format(new Date(item.scheduledFor))}</span>
        </div>
        <div className="timeline-card">
          <div className="timeline-top">
            <p>{item.resource?.label ?? 'Resource'}</p>
            <span className={severityClass[item.severity]}>
              {severityLabel[item.severity]}
            </span>
          </div>
          <p className="muted">{item.message}</p>
          <div className="timeline-footer">
            <span>{typeLabels[item.resource?.type ?? 'domain']}</span>
            <div className="timeline-actions">
              <button
                className="ghost small"
                disabled={actionPending}
                onClick={() => onAction('preview', item)}
              >
                Preview
              </button>
              <button
                className="ghost small"
                disabled={actionPending}
                onClick={() => onAction('snooze', item)}
              >
                Snooze 3d
              </button>
              <button
                className="ghost small"
                disabled={actionPending}
                onClick={() => onAction('mark_done', item)}
              >
                Mark done
              </button>
            </div>
          </div>
        </div>
      </li>
    ))}
  </ul>
);

interface CalendarBoardProps {
  calendarDays: CalendarResponse['days'];
}

const CalendarBoard = ({ calendarDays }: CalendarBoardProps) => {
  if (!calendarDays.length) {
    return <p className="muted">Belum ada agenda.</p>;
  }

  return (
    <ul className="calendar-list">
      {calendarDays.map(({ date, events }: CalendarResponse['days'][number]) => (
        <li key={date}>
          <div className="calendar-date">
            <p>{shortFormatter.format(new Date(date))}</p>
            <span>{events.length} agenda</span>
          </div>
          <div className="calendar-events">
            {events.slice(0, 2).map((item) => (
              <div key={item.id} className="calendar-event">
                <p>{item.resource?.label ?? 'Resource'}</p>
                <span className={`badge severity-${item.severity}`}>
                  {item.channel}
                </span>
              </div>
            ))}
            {events.length > 2 && (
              <p className="muted">+{events.length - 2} lainnya</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

const TelegramPreview = ({
  reminder,
  actionPending,
  onAction,
}: {
  reminder: (Reminder & { resource?: Resource }) | null;
  actionPending: boolean;
  onAction: (
    action: 'preview' | 'snooze' | 'mark_done',
    reminder: Reminder & { resource?: Resource } | null
  ) => void;
}) => {
  if (!reminder) {
    return (
      <div className="telegram-preview">
        <p className="muted">Belum ada reminder yang dijadwalkan.</p>
      </div>
    );
  }

  return (
    <div className="telegram-preview">
      <div className="telegram-header">
        <p>Telegram Bot</p>
        <span>draft</span>
      </div>
      <div className="telegram-body">
        <p>
          [Reminder] {reminder.resource?.label ?? reminder.resourceId}{' '}
          akan kedaluwarsa{' '}
          {shortFormatter.format(new Date(reminder.scheduledFor))}. Status:{' '}
          {statusLabel[reminder.resource?.status ?? 'due-soon']}
        </p>
        <p className="muted">{reminder.message}</p>
      </div>
      <div className="telegram-actions">
        <button
          className="ghost small"
          disabled={actionPending}
          onClick={() => onAction('mark_done', reminder)}
        >
          Mark done
        </button>
        <button
          className="ghost small"
          disabled={actionPending}
          onClick={() => onAction('snooze', reminder)}
        >
          Snooze 3 hari
        </button>
        <button
          className="primary"
          disabled={actionPending}
          onClick={() => onAction('preview', reminder)}
        >
          {actionPending ? 'Mengirim...' : 'Kirim preview'}
        </button>
      </div>
    </div>
  );
};

interface QuickAddFormProps {
  formState: {
    type: ResourceType;
    label: string;
    provider: string;
    expiryDate: string;
  };
  setFormState: React.Dispatch<
    React.SetStateAction<{
      type: ResourceType;
      label: string;
      provider: string;
      expiryDate: string;
    }>
  >;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  alert: string | null;
  pending: boolean;
}

const QuickAddForm = ({
  formState,
  setFormState,
  onSubmit,
  alert,
  pending,
}: QuickAddFormProps) => (
  <form className="quick-form" onSubmit={onSubmit}>
    <label>
      Jenis
      <select
        value={formState.type}
        onChange={(event) =>
          setFormState((prev) => ({
            ...prev,
            type: event.target.value as ResourceType,
          }))
        }
      >
        {Object.entries(typeLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
    <label>
      Nama Resource
      <input
        type="text"
        placeholder="contoh: Portal Member"
        value={formState.label}
        onChange={(event) =>
          setFormState((prev) => ({ ...prev, label: event.target.value }))
        }
      />
    </label>
    <label>
      Provider
      <input
        type="text"
        placeholder="Cloudflare, Niagahoster, dll"
        value={formState.provider}
        onChange={(event) =>
          setFormState((prev) => ({ ...prev, provider: event.target.value }))
        }
      />
    </label>
    <label>
      Tanggal Expiry
      <input
        type="date"
        value={formState.expiryDate}
        onChange={(event) =>
          setFormState((prev) => ({ ...prev, expiryDate: event.target.value }))
        }
      />
    </label>
    {alert && <p className="form-alert">{alert}</p>}
    <button className="primary" type="submit" disabled={pending}>
      {pending ? 'Menyimpan...' : 'Simpan Draft Reminder'}
    </button>
  </form>
);

const AlertingPanel = ({
  prefs,
  onChange,
  onTest,
  pending,
}: {
  prefs: AlertPreference;
  onChange: (patch: Partial<AlertPreference>) => void;
  onTest: (channel: 'email' | 'slack') => void;
  pending: boolean;
}) => (
  <div className="alerting-panel">
    <section>
      <label className="toggle-row">
        <span>Email alert</span>
        <input
          type="checkbox"
          checked={prefs.emailEnabled}
          onChange={(event) =>
            onChange({ emailEnabled: event.target.checked })
          }
        />
      </label>
      <input
        type="email"
        placeholder="ops@company.id"
        value={prefs.email}
        onChange={(event) => onChange({ email: event.target.value })}
        disabled={!prefs.emailEnabled}
      />
      <button
        className="ghost small"
        disabled={!prefs.emailEnabled || pending}
        onClick={() => onTest('email')}
      >
        {pending ? 'Mengirim...' : 'Kirim test email'}
      </button>
    </section>
    <section>
      <label className="toggle-row">
        <span>Slack alert</span>
        <input
          type="checkbox"
          checked={prefs.slackEnabled}
          onChange={(event) =>
            onChange({ slackEnabled: event.target.checked })
          }
        />
      </label>
      <input
        type="text"
        placeholder="#ops-alert"
        value={prefs.slackChannel}
        onChange={(event) => onChange({ slackChannel: event.target.value })}
        disabled={!prefs.slackEnabled}
      />
      <button
        className="ghost small"
        disabled={!prefs.slackEnabled || pending}
        onClick={() => onTest('slack')}
      >
        {pending ? 'Mengirim...' : 'Ping Slack'}
      </button>
    </section>
  </div>
);

const AlertHistoryList = ({ items }: { items: AlertHistoryItem[] }) => {
  if (!items.length) {
    return <p className="muted">Belum ada alert yang dikirim.</p>;
  }
  return (
    <ul className="alert-history">
      {items.map((item) => (
        <li key={item.id}>
          <div>
            <p className="resource-name">
              {item.channel.toUpperCase()} • {item.target}
            </p>
            <p className="muted">
              {new Date(item.sentAt).toLocaleString('id-ID')} • {item.status}
            </p>
          </div>
          {item.error && <span className="error-text">{item.error}</span>}
        </li>
      ))}
    </ul>
  );
};

const UserAccessCard = ({
  users,
  currentUserId,
  onLogin,
  onLogout,
}: {
  users: User[];
  currentUserId: string;
  onLogin: (id: string) => void;
  onLogout: () => void;
}) => (
  <div className="card">
    <div className="card-head">
      <div>
        <p className="eyebrow">Multi user access</p>
        <h2>Login & Permissions</h2>
      </div>
    </div>
    <div className="session-list">
      {users.map((user) => {
        const isActive = user.id === currentUserId;
        return (
          <div key={user.id} className={`session-item ${isActive ? 'active' : ''}`}>
            <div className="owner-inline">
              <div className="avatar small">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  <span>{getInitials(user.name)}</span>
                )}
              </div>
              <div>
                <p className="resource-name">{user.name}</p>
                <p className="muted">
                  {user.role}
                  {user.isAdmin ? ' • Admin' : ''}
                </p>
              </div>
            </div>
            {isActive ? (
              <button className="ghost small" onClick={onLogout}>
                Logout
              </button>
            ) : (
              <button className="ghost small" onClick={() => onLogin(user.id)}>
                Login
              </button>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const LoginPanel = ({
  users,
  onLogin,
  pending,
}: {
  users: User[];
  onLogin: (id: string) => void;
  pending: boolean;
}) => (
  <div className="login-overlay">
    <div className="login-card">
      <h2>Pilih akun untuk mulai</h2>
      <p className="muted">
        Hubungkan dashboard dengan user Telegram yang memiliki izin.
      </p>
      <div className="login-card-grid">
        {users.map((user) => (
          <button
            key={user.id}
            className="login-option"
            onClick={() => onLogin(user.id)}
            disabled={pending}
          >
            <div className="owner-inline">
              <div className="avatar small">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  <span>{getInitials(user.name)}</span>
                )}
              </div>
              <div>
                <p className="resource-name">{user.name}</p>
                <p className="muted">
                  {user.role}
                  {user.isAdmin ? ' • Admin' : ''}
                </p>
              </div>
            </div>
            <span>Login</span>
          </button>
        ))}
      </div>
      {pending && <p className="muted">Memproses...</p>}
    </div>
  </div>
);

interface ResourceDetailProps {
  resource: Resource;
  currentUser: User | null;
  getDaysUntil: (iso: string) => number;
}

const ResourceDetail = ({
  resource,
  currentUser,
  getDaysUntil,
}: ResourceDetailProps) => (
  <div className="resource-detail">
    <div className="detail-row">
      <p className="detail-label">Hostname</p>
      <p className="detail-value">{resource.hostname}</p>
    </div>
    <div className="detail-row">
      <p className="detail-label">Penyedia</p>
      <p className="detail-value">{resource.provider}</p>
    </div>
    <div className="detail-row">
      <p className="detail-label">Expiry</p>
      <p className="detail-value">
        {dateFormatter.format(new Date(resource.expiryDate))} •{' '}
        {getDaysUntil(resource.expiryDate)} hari lagi
      </p>
    </div>
    <div className="detail-row">
      <p className="detail-label">Terakhir dicek</p>
      <p className="detail-value">
        {dateFormatter.format(new Date(resource.lastChecked))}
      </p>
    </div>
    <div className="detail-row">
      <p className="detail-label">Hak akses</p>
      <p className="detail-value">
        {currentUser
          ? `${currentUser.name} • ${
              currentUser.isAdmin ? 'Admin' : 'Standard user'
            }`
          : 'Belum login'}
      </p>
    </div>
    <div className="detail-row">
      <p className="detail-label">Renewal Link</p>
      <a className="detail-link" href={resource.renewalUrl} target="_blank">
        Buka portal provider ↗
      </a>
    </div>
    <div className="detail-note">
      <p className="detail-label">Catatan Operasional</p>
      <p>{resource.notes}</p>
    </div>
    <div className="detail-tags">
      {resource.tags.map((tag) => (
        <span key={tag} className="chip small">
          #{tag}
        </span>
      ))}
    </div>
  </div>
);

const ActivityFeed = ({
  activityLog,
  onSelect,
}: {
  activityLog: ActivityItem[];
  onSelect?: (item: ActivityItem) => void;
}) => (
  <ul className="activity-list">
    {activityLog.map((item) => (
      <li
        key={item.id}
        className={onSelect ? 'clickable' : ''}
        onClick={() => onSelect?.(item)}
      >
        <div>
          <p>{item.label}</p>
          <p className="muted">
            {item.actor} • {formatTimeAgo(item.timestamp)}
          </p>
        </div>
        <span className={`activity-pill activity-${item.action}`}>
          {item.action}
        </span>
      </li>
    ))}
  </ul>
);

const ActivityModal = ({
  item,
  onClose,
}: {
  item: ActivityItem & { resource?: Resource };
  onClose: () => void;
}) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal" onClick={(event) => event.stopPropagation()}>
      <div className="modal-head">
        <h3>Audit Detail</h3>
        <button className="ghost small" onClick={onClose}>
          Tutup
        </button>
      </div>
      <div className="modal-body">
        <p className="muted">{formatTimeAgo(item.timestamp)}</p>
        <h4>{item.label}</h4>
        <p>
          Resource:{' '}
          {item.resource ? `${item.resource.label} (${item.resource.hostname})` : item.resourceId}
        </p>
        <p>Actor: {item.actor}</p>
        <p>Status: {item.action}</p>
      </div>
    </div>
  </div>
);

const Toast = ({
  status,
  onDismiss,
}: {
  status: { id: string; type: 'success' | 'error'; message: string };
  onDismiss: () => void;
}) => (
  <div className={`toast ${status.type}`}>
    <p>{status.message}</p>
    <button className="ghost small" onClick={onDismiss}>
      Tutup
    </button>
  </div>
);

export default App;
