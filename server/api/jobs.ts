import { eq, like, or, and, desc, sql } from 'drizzle-orm'
import { db } from '../../lib/db'
import { jobs, scrapeRuns } from '../../lib/db/schema'
import type { JobOffer } from '../../lib/scrapers/types'

export interface GetJobsParams {
  query?: string
  source?: string
  contractType?: string
  location?: string
  isFavorite?: boolean
  isHidden?: boolean
  page?: number
  perPage?: number
}

export async function getJobs(params: GetJobsParams = {}) {
  const { query, source, contractType, location, isFavorite, isHidden, page = 1, perPage = 20 } = params

  const conditions = []

  if (query) {
    const pattern = `%${query}%`
    conditions.push(
      or(
        like(jobs.title, pattern),
        like(jobs.company, pattern),
        like(jobs.description, pattern),
      ),
    )
  }

  if (source) {
    conditions.push(eq(jobs.sourceId, source))
  }

  if (contractType) {
    conditions.push(eq(jobs.contractType, contractType))
  }

  if (location) {
    conditions.push(like(jobs.location, `%${location}%`))
  }

  if (isFavorite !== undefined) {
    conditions.push(eq(jobs.isFavorite, isFavorite))
  }

  // By default, hide hidden jobs unless explicitly requesting them
  if (isHidden !== undefined) {
    conditions.push(eq(jobs.isHidden, isHidden))
  } else {
    conditions.push(eq(jobs.isHidden, false))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [jobRows, countResult] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(where)
      .orderBy(desc(jobs.publishedAt), desc(jobs.firstSeenAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(where),
  ])

  return {
    jobs: jobRows,
    total: countResult[0].count,
    page,
    perPage,
    totalPages: Math.ceil(countResult[0].count / perPage),
  }
}

export async function getJobById(id: number) {
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  return result[0] ?? null
}

export async function insertJobs(offers: JobOffer[]): Promise<{ inserted: number; updated: number }> {
  const now = new Date().toISOString()
  let inserted = 0
  let updated = 0

  for (const offer of offers) {
    const result = db
      .insert(jobs)
      .values({
        sourceId: offer.sourceId,
        externalId: offer.externalId,
        title: offer.title,
        company: offer.company,
        location: offer.location,
        url: offer.url,
        publishedAt: offer.publishedAt?.toISOString() ?? null,
        contractType: offer.contractType ?? null,
        salary: offer.salary ?? null,
        description: offer.description ?? null,
        tags: offer.tags ? JSON.stringify(offer.tags) : null,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: [jobs.sourceId, jobs.externalId],
        set: {
          title: offer.title,
          company: offer.company,
          location: offer.location,
          url: offer.url,
          publishedAt: offer.publishedAt?.toISOString() ?? null,
          contractType: offer.contractType ?? null,
          salary: offer.salary ?? null,
          description: offer.description ?? null,
          tags: offer.tags ? JSON.stringify(offer.tags) : null,
          lastSeenAt: now,
          isActive: true,
        },
      })
      .run()

    if (result.changes > 0) {
      // Check if it was an insert or update by looking at lastInsertRowid
      // If the rowid changed, it was a new insert
      const existing = db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.sourceId, offer.sourceId),
            eq(jobs.externalId, offer.externalId),
            eq(jobs.firstSeenAt, now),
          ),
        )
        .get()

      if (existing) {
        inserted++
      } else {
        updated++
      }
    }
  }

  return { inserted, updated }
}

export async function updateJob(
  id: number,
  patch: { isFavorite?: boolean; isHidden?: boolean; notes?: string },
) {
  return db.update(jobs).set(patch).where(eq(jobs.id, id)).run()
}

export async function insertScrapeRun(sourceId: string) {
  const result = db
    .insert(scrapeRuns)
    .values({
      sourceId,
      startedAt: new Date().toISOString(),
    })
    .run()

  return result.lastInsertRowid as number
}

export async function updateScrapeRun(
  id: number,
  data: {
    success: boolean
    jobsFound: number
    jobsNew: number
    errors?: string[]
  },
) {
  return db
    .update(scrapeRuns)
    .set({
      completedAt: new Date().toISOString(),
      success: data.success,
      jobsFound: data.jobsFound,
      jobsNew: data.jobsNew,
      errors: data.errors ? JSON.stringify(data.errors) : null,
    })
    .where(eq(scrapeRuns.id, id))
    .run()
}

export async function clearAllJobs() {
  const deletedJobs = db.delete(jobs).run()
  const deletedRuns = db.delete(scrapeRuns).run()
  return { deletedJobs: deletedJobs.changes, deletedRuns: deletedRuns.changes }
}

export async function getLatestScrapeRuns() {
  return db
    .select()
    .from(scrapeRuns)
    .orderBy(desc(scrapeRuns.startedAt))
    .limit(50)
}
