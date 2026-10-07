import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  mode: text('mode').notNull(),
  target: text('target').notNull(),
  source: text('source').notNull(),
  created: text('created').notNull(),
  payload: text('payload').notNull(),
  analysis: text('analysis'),
});
export const ledger = sqliteTable('ledger', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  cost: real('cost').notNull(),
  created: text('created').notNull(),
  note: text('note').notNull(),
});
export const outcomes = sqliteTable('outcomes', {
  id: text('id').primaryKey(),
  created: text('created').notNull(),
  payload: text('payload').notNull(),
});
