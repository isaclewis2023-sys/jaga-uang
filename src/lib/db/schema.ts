import { sql } from 'drizzle-orm'
import {
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['bank', 'cash', 'savings', 'investment', 'credit'] }).notNull(),
  balance: real('balance').notNull().default(0),
  color: text('color').notNull().default('#00ff41'),
  icon: text('icon').notNull().default('🏦'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  color: text('color').notNull().default('#00ff41'),
  icon: text('icon').notNull().default('📂'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  categoryId: text('category_id').notNull().references(() => categories.id),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  date: text('date').notNull(),
  notes: text('notes'),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
  recurringId: text('recurring_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const transfers = sqliteTable('transfers', {
  id: text('id').primaryKey(),
  fromAccountId: text('from_account_id').notNull().references(() => accounts.id),
  toAccountId: text('to_account_id').notNull().references(() => accounts.id),
  amount: real('amount').notNull(),
  description: text('description').notNull().default('Transfer'),
  date: text('date').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const recurringRules = sqliteTable('recurring_rules', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  categoryId: text('category_id').notNull().references(() => categories.id),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly', 'yearly'] }).notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  nextDue: text('next_due').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  amount: real('amount').notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmount: real('target_amount').notNull(),
  currentAmount: real('current_amount').notNull().default(0),
  deadline: text('deadline'),
  color: text('color').notNull().default('#00ff41'),
  icon: text('icon').notNull().default('🎯'),
  description: text('description'),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export type Setting = typeof settings.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Category = typeof categories.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type Transfer = typeof transfers.$inferSelect
export type RecurringRule = typeof recurringRules.$inferSelect
export type Budget = typeof budgets.$inferSelect
export type Goal = typeof goals.$inferSelect
