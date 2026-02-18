import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

const DATABASE_PATH = process.env.DATABASE_PATH ?? './data/jobs.db'

mkdirSync(dirname(DATABASE_PATH), { recursive: true })

const sqlite = new Database(DATABASE_PATH)
sqlite.pragma('journal_mode = WAL')

export const db = drizzle(sqlite, { schema })

migrate(db, { migrationsFolder: './lib/db/migrations' })
