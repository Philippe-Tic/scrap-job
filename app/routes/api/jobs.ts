import { createFileRoute } from '@tanstack/react-router'
import { getJobs } from '../../../server/api/jobs'

export const Route = createFileRoute('/api/jobs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const q = url.searchParams.get('q') ?? ''
        const jobs = await getJobs({ query: q })
        return Response.json(jobs)
      },
    },
  },
})
