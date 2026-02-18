// Stub — will query the database via Drizzle

export async function getJobs(params: { query?: string } = {}) {
  // TODO: implement actual DB query with search/filter
  return {
    jobs: [],
    total: 0,
    query: params.query ?? '',
  }
}
