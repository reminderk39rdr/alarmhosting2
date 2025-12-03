export type ResourceType = 'domain' | 'hosting' | 'ssl' | 'email';

export interface Owner {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

export interface Resource {
  id: string;
  type: ResourceType;
  label: string;
  hostname: string;
  provider: string;
  expiryDate: string; // ISO string
  ownerId: string;
  cadence: string;
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
