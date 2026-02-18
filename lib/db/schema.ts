import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const jobs = sqliteTable(
  'jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: text('source_id').notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    company: text('company').notNull(),
    location: text('location').notNull(),
    url: text('url').notNull(),
    publishedAt: text('published_at'),
    contractType: text('contract_type'),
    salary: text('salary'),
    description: text('description'),
    tags: text('tags'), // JSON stringifié
    firstSeenAt: text('first_seen_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
    isHidden: integer('is_hidden', { mode: 'boolean' }).default(false),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('idx_source_external').on(table.sourceId, table.externalId),
  ],
)

export const scrapeRuns = sqliteTable('scrape_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: text('source_id').notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  success: integer('success', { mode: 'boolean' }),
  jobsFound: integer('jobs_found'),
  jobsNew: integer('jobs_new'),
  errors: text('errors'), // JSON stringifié
})
