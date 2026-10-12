import { sqliteTable, text, real, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull(),
    active: integer('active').notNull().default(1),
    created: text('created').notNull(),
  },
  (table) => [
    check('users_role', sql`${table.role} IN ('admin','user')`),
    check('users_active', sql`${table.active} IN (0,1)`),
  ],
);
export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    expires: integer('expires').notNull(),
  },
  (table) => [index('sessions_user').on(table.userId)],
);
export const authAttempts = sqliteTable('auth_attempts', {
  key: text('key').primaryKey(),
  window: integer('window').notNull(),
  attempts: integer('attempts').notNull(),
});
export const creditGrants = sqliteTable(
  'credit_grants',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id),
    amountMicros: integer('amount_micros').notNull(),
    note: text('note').notNull(),
    created: text('created').notNull(),
  },
  (table) => [
    index('grants_user').on(table.userId),
    check('grants_positive', sql`${table.amountMicros} > 0`),
  ],
);
export const runs = sqliteTable(
  'runs',
  {
    id: text('id').primaryKey(),
    mode: text('mode').notNull(),
    target: text('target').notNull(),
    source: text('source').notNull(),
    created: text('created').notNull(),
    payload: text('payload').notNull(),
    analysis: text('analysis'),
    userId: text('user_id').references(() => users.id),
  },
  (table) => [index('runs_user').on(table.userId, table.created)],
);
export const ledger = sqliteTable(
  'ledger',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    cost: real('cost').notNull(),
    created: text('created').notNull(),
    note: text('note').notNull(),
    userId: text('user_id').references(() => users.id),
    costMicros: integer('cost_micros').notNull().default(0),
    status: text('status').notNull().default('legacy'),
  },
  (table) => [
    index('ledger_user').on(table.userId, table.status),
    check('ledger_status', sql`${table.status} IN ('legacy','reserved','settled')`),
  ],
);
export const outcomes = sqliteTable(
  'outcomes',
  {
    id: text('id').primaryKey(),
    created: text('created').notNull(),
    payload: text('payload').notNull(),
    userId: text('user_id').references(() => users.id),
  },
  (table) => [index('outcomes_user').on(table.userId, table.created)],
);
