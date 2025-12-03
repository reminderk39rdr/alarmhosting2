export type ResourceType = 'domain' | 'hosting' | 'ssl' | 'email';

export interface User {
  id: string;
  name: string;
  role: string;
  avatar: string;
  isAdmin: boolean;
}

export interface Resource {
  id: string;
  type: ResourceType;
  label: string;
  hostname: string;
  provider: string;
  expiryDate: string; // ISO string
  status: 'healthy' | 'due-soon' | 'overdue';
  renewalUrl: string;
  notes: string;
  lastChecked: string;
  tags: string[];
}

export interface Reminder {
  id: string;
  resourceId: string;
  dueInDays: number;
  scheduledFor: string;
  severity: 'low' | 'medium' | 'high';
  channel: 'telegram' | 'email';
  message: string;
}

export interface ActivityItem {
  id: string;
  label: string;
  timestamp: string;
  actor: string;
  resourceId: string;
  action: 'created' | 'reminder_sent' | 'acknowledged' | 'snoozed';
}

export interface SeedData {
  users: User[];
  resources: Resource[];
  reminders: Reminder[];
  activity: ActivityItem[];
}

export interface AlertPreference {
  emailEnabled: boolean;
  slackEnabled: boolean;
  email: string;
  slackChannel: string;
}

export interface CalendarDay {
  date: string;
  events: Array<Reminder & { resource?: Resource }>;
}

export interface CalendarResponse {
  range: number;
  count: number;
  days: CalendarDay[];
}

export interface AlertHistoryItem {
  id: string;
  channel: 'email' | 'slack' | 'telegram';
  target: string;
  status: 'queued' | 'sent' | 'failed';
  sentAt: string;
  error?: string;
  payload?: Record<string, unknown>;
}
