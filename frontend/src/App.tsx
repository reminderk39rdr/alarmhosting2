import { useMemo, useState } from 'react';
import './App.css';
import { activityLog, owners, reminders, resources } from './mockData';
import type { Resource, ResourceType } from './types';

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

const severityClass = {
  low: 'timeline-chip low',
  medium: 'timeline-chip medium',
  high: 'timeline-chip high',
};

const severityLabel = {
  low: 'Pengingat awal',
  medium: 'Prioritas menengah',
  high: 'Segera tindakan',
};

const formatTimeAgo = (iso: string) => {
  const diff = getDaysUntil(iso) * -1;
  if (diff === 0) return 'Hari ini';
  return diff === 1 ? 'Kemarin' : `${diff} hari lalu`;
};

function App() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(resources[0]?.id ?? '');
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    type: 'domain' as ResourceType,
    label: '',
    provider: '',
    expiryDate: '',
    ownerId: owners[0]?.id ?? '',
    cadence: '60/30/14/7/3/1',
  });

  const ownerMap = useMemo(
    () => Object.fromEntries(owners.map((owner) => [owner.id, owner])),
    []
  );

  const filteredResources = useMemo(() => {
    if (!query.trim()) return resources;
    const lower = query.toLowerCase();
    return resources.filter(
      (res) =>
        res.label.toLowerCase().includes(lower) ||
        res.hostname.toLowerCase().includes(lower) ||
        res.provider.toLowerCase().includes(lower)
    );
  }, [query]);

  const sortedResources = useMemo(
    () =>
      [...filteredResources].sort(
        (a, b) =>
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      ),
    [filteredResources]
  );

  const selectedResource =
    resources.find((item) => item.id === selectedId) ?? resources[0];

  const stats = useMemo(() => {
    const total = resources.length;
    const dueThisWeek = resources.filter(
      (res) => res.status !== 'overdue' && getDaysUntil(res.expiryDate) <= 7
    ).length;
    const overdue = resources.filter((res) => res.status === 'overdue').length;
    const unassigned = resources.filter((res) => !res.ownerId).length;
    return { total, dueThisWeek, overdue, unassigned };
  }, []);

  const timeline = useMemo(
    () =>
      reminders
        .slice()
        .sort((a, b) => a.dueInDays - b.dueInDays)
        .map((item) => ({
          ...item,
          resource: resources.find((res) => res.id === item.resourceId),
        })),
    []
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
  }, []);

  const onSubmitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.label || !formState.expiryDate || !formState.provider) {
      setFormAlert('Lengkapi nama resource, provider, dan tanggal.');
      return;
    }
    setFormAlert(
      `Draft reminder ${formState.label} siap dikirim ke bot Telegram.`
    );
    setFormState((prev) => ({
      ...prev,
      label: '',
      provider: '',
      expiryDate: '',
    }));
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">⏰</div>
          <div>
            <p className="brand-title">Alarm Hosting</p>
            <p className="brand-caption">Reminder Command Center</p>
          </div>
        </div>
        <nav>
          <p className="nav-label">Monitor</p>
          <button className="nav-item active">Dashboard</button>
          <button className="nav-item">Calendar</button>
          <button className="nav-item">Telegram Bot</button>
          <p className="nav-label spacer">Resources</p>
          <button className="nav-item">Domains</button>
          <button className="nav-item">Hosting</button>
          <button className="nav-item">SSL & Layanan</button>
        </nav>
        <div className="sidebar-card">
          <p>Progress migrasi Niagahoster</p>
          <h3>3/6 layanan sudah aman</h3>
          <p className="muted">
            Update lagi sebelum akhir minggu supaya tim tahu statusnya.
          </p>
          <button className="secondary-btn">Laporkan perkembangan</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="page-header">
          <div>
            <p className="eyebrow">Operational Reminder • Asia/Jakarta</p>
            <h1>Renewal Radar</h1>
          </div>
          <div className="header-actions">
            <div className="search-box">
              <span role="img" aria-label="search">
                🔍
              </span>
              <input
                type="text"
                placeholder="Cari domain, hosting, atau provider..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button className="primary-btn">+ Reminder Baru</button>
          </div>
        </header>

        <section className="stats-grid">
          <StatCard
            title="Total Resources"
            value={stats.total}
            detail={`${upcomingBuckets.month.length} jatuh tempo < 30 hari`}
          />
          <StatCard
            title="Due < 7 hari"
            value={stats.dueThisWeek}
            tone="warning"
            detail="Prioritas tinggi minggu ini"
          />
          <StatCard
            title="Overdue"
            value={stats.overdue}
            tone="danger"
            detail="Segera follow up via Telegram"
          />
          <StatCard
            title="Tanpa PIC"
            value={stats.unassigned}
            tone="muted"
            detail="Assign PIC sebelum reminder"
          />
        </section>

        <section className="content-grid">
          <div className="card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Upcoming Reminder</p>
                <h2>Prioritas 30 Hari</h2>
              </div>
              <div className="filter-chips">
                <span className="chip">Minggu ini {upcomingBuckets.week.length}</span>
                <span className="chip">30 hari {upcomingBuckets.month.length}</span>
                <span className="chip">&gt; 30 hari {upcomingBuckets.later.length}</span>
              </div>
            </div>
            <ResourceTable
              resources={sortedResources}
              selectedId={selectedId}
              ownerMap={ownerMap}
              onSelect={setSelectedId}
            />
          </div>

          <div className="timeline-column">
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Telegram Queue</p>
                  <h2>Jadwal Pengingat</h2>
                </div>
                <button className="ghost-btn">Manage cadence</button>
              </div>
              <Timeline timeline={timeline} />
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Tambah Reminder</p>
                  <h2>Resource Baru</h2>
                </div>
              </div>
              <QuickAddForm
                formState={formState}
                setFormState={setFormState}
                owners={owners}
                onSubmit={onSubmitForm}
                alert={formAlert}
              />
            </div>
          </div>

          <div className="detail-column">
            <div className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Detail Resource</p>
                  <h2>{selectedResource?.label ?? 'Pilih resource'}</h2>
                </div>
                <button className="ghost-btn">Kirim ke Telegram</button>
              </div>
              {selectedResource && (
                <ResourceDetail
                  resource={selectedResource}
                  owner={ownerMap[selectedResource.ownerId]}
                  getDaysUntil={getDaysUntil}
                />
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Aktivitas Terbaru</p>
                  <h2>Log Reminder</h2>
                </div>
                <button className="ghost-btn">Export</button>
              </div>
              <ActivityFeed />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

interface StatProps {
  title: string;
  value: number;
  detail: string;
  tone?: 'warning' | 'danger' | 'muted';
}

const StatCard = ({ title, value, detail, tone }: StatProps) => (
  <div className={`stat-card ${tone ?? ''}`}>
    <p className="stat-title">{title}</p>
    <p className="stat-value">{value}</p>
    <p className="stat-detail">{detail}</p>
  </div>
);

interface ResourceTableProps {
  resources: Resource[];
  selectedId: string;
  onSelect: (id: string) => void;
  ownerMap: Record<string, (typeof owners)[number]>;
}

const ResourceTable = ({
  resources,
  selectedId,
  onSelect,
  ownerMap,
}: ResourceTableProps) => (
  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Resource</th>
          <th>Penyedia</th>
          <th>Expiry</th>
          <th>Owner</th>
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
              <p className="muted">{resource.cadence} harian</p>
            </td>
            <td>
              <p>{dateFormatter.format(new Date(resource.expiryDate))}</p>
              <p className="muted">{getDaysUntil(resource.expiryDate)} hari lagi</p>
            </td>
            <td>
              <div className="owner-cell">
                {ownerMap[resource.ownerId]?.avatar ? (
                  <img
                    src={ownerMap[resource.ownerId].avatar}
                    alt={ownerMap[resource.ownerId].name}
                  />
                ) : (
                  <div className="avatar-fallback">?</div>
                )}
                <div>
                  <p>{ownerMap[resource.ownerId]?.name ?? 'Belum ada'}</p>
                  <p className="muted">
                    {ownerMap[resource.ownerId]?.role ?? 'Assign PIC'}
                  </p>
                </div>
              </div>
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
  timeline: Array<
    (typeof reminders)[number] & { resource?: Resource }
  >;
}

const Timeline = ({ timeline }: TimelineProps) => (
  <ul className="timeline-list">
    {timeline.map((item) => (
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
            <button className="ghost-btn">Edit cadence</button>
          </div>
        </div>
      </li>
    ))}
  </ul>
);

interface QuickAddFormProps {
  formState: {
    type: ResourceType;
    label: string;
    provider: string;
    expiryDate: string;
    ownerId: string;
    cadence: string;
  };
  setFormState: React.Dispatch<
    React.SetStateAction<{
      type: ResourceType;
      label: string;
      provider: string;
      expiryDate: string;
      ownerId: string;
      cadence: string;
    }>
  >;
  owners: typeof owners;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  alert: string | null;
}

const QuickAddForm = ({
  formState,
  setFormState,
  owners,
  onSubmit,
  alert,
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
    <label>
      PIC Reminder
      <select
        value={formState.ownerId}
        onChange={(event) =>
          setFormState((prev) => ({ ...prev, ownerId: event.target.value }))
        }
      >
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name} • {owner.role}
          </option>
        ))}
      </select>
    </label>
    <label>
      Cadence (hari)
      <input
        type="text"
        value={formState.cadence}
        onChange={(event) =>
          setFormState((prev) => ({ ...prev, cadence: event.target.value }))
        }
      />
    </label>
    {alert && <p className="form-alert">{alert}</p>}
    <button className="primary-btn" type="submit">
      Simpan Draft Reminder
    </button>
  </form>
);

interface ResourceDetailProps {
  resource: Resource;
  owner: (typeof owners)[number] | undefined;
  getDaysUntil: (iso: string) => number;
}

const ResourceDetail = ({ resource, owner, getDaysUntil }: ResourceDetailProps) => (
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
      <p className="detail-label">Cadence</p>
      <p className="detail-value">{resource.cadence} hari</p>
    </div>
    <div className="detail-row">
      <p className="detail-label">PIC di Telegram</p>
      <div className="owner-inline">
        {owner?.avatar ? (
          <img src={owner.avatar} alt={owner.name} />
        ) : (
          <div className="avatar-fallback">?</div>
        )}
        <div>
          <p>{owner?.name ?? 'Belum ditentukan'}</p>
          <p className="muted">{owner?.role ?? 'Assign terlebih dahulu'}</p>
        </div>
      </div>
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

const ActivityFeed = () => (
  <ul className="activity-list">
    {activityLog.map((item) => (
      <li key={item.id}>
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

export default App;
