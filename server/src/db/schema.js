import { pgTable, integer, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  avatar: text('avatar'),
  isAdmin: boolean('is_admin').default(false).notNull(),
});

export const resources = pgTable('resources', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  hostname: text('hostname').notNull(),
  provider: text('provider').notNull(),
  expiryDate: text('expiry_date').notNull(),
  status: text('status').default('healthy'),
  renewalUrl: text('renewal_url'),
  notes: text('notes'),
  lastChecked: timestamp('last_checked', { withTimezone: true }),
});

export const reminders = pgTable('reminders', {
  id: text('id').primaryKey(),
  resourceId: text('resource_id').notNull(),
  dueInDays: integer('due_in_days'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  severity: text('severity').default('low'),
  channel: text('channel').default('telegram'),
  message: text('message'),
});

export const alertLogs = pgTable('alert_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  channel: text('channel').notNull(),
  target: text('target').notNull(),
  status: text('status').notNull(),
  payload: text('payload'),
  error: text('error'),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
});
