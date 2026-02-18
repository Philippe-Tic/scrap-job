import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../../lib/db'
import { jobs, scrapeRuns } from '../../lib/db/schema'
import { SOURCE_DEFINITIONS } from '../../lib/scrapers/index'

export async function getSourceStatuses() {
  const jobCounts = db
    .select({
      sourceId: jobs.sourceId,
      count: sql<number>`count(*)`,
    })
    .from(jobs)
    .where(eq(jobs.isActive, true))
    .groupBy(jobs.sourceId)
    .all()

  const countMap = new Map(jobCounts.map((r) => [r.sourceId, r.count]))

  const latestRuns = db
    .select()
    .from(scrapeRuns)
    .orderBy(desc(scrapeRuns.startedAt))
    .all()

  const runMap = new Map<string, typeof latestRuns[0]>()
  for (const run of latestRuns) {
    if (!runMap.has(run.sourceId)) {
      runMap.set(run.sourceId, run)
    }
  }

  return SOURCE_DEFINITIONS.map((source) => {
    const lastRun = runMap.get(source.id)
    return {
      id: source.id,
      name: source.name,
      baseUrl: source.baseUrl,
      status: lastRun
        ? lastRun.completedAt
          ? lastRun.success
            ? ('success' as const)
            : ('error' as const)
          : ('running' as const)
        : ('idle' as const),
      lastScrapeAt: lastRun?.startedAt ?? null,
      jobCount: countMap.get(source.id) ?? 0,
      lastErrors: lastRun?.errors ? JSON.parse(lastRun.errors) : null,
    }
  })
}
