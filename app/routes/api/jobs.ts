import { createFileRoute } from '@tanstack/react-router'
import { getJobs, getJobById, updateJob } from '../../../server/api/jobs'

export const Route = createFileRoute('/api/jobs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const result = await getJobs({
          query: url.searchParams.get('q') || undefined,
          source: url.searchParams.get('source') || undefined,
          contractType: url.searchParams.get('contractType') || undefined,
          location: url.searchParams.get('location') || undefined,
          isFavorite: url.searchParams.has('isFavorite')
            ? url.searchParams.get('isFavorite') === 'true'
            : undefined,
          isHidden: url.searchParams.has('isHidden')
            ? url.searchParams.get('isHidden') === 'true'
            : undefined,
          excludeInternships: url.searchParams.has('excludeInternships')
            ? url.searchParams.get('excludeInternships') === 'true'
            : undefined,
          page: Number(url.searchParams.get('page')) || 1,
          perPage: Number(url.searchParams.get('perPage')) || 20,
        })
        return Response.json(result)
      },
      DELETE: async () => {
        const { clearAllJobs } = await import('../../../server/api/jobs')
        const result = await clearAllJobs()
        return Response.json(result)
      },
    },
  },
})
