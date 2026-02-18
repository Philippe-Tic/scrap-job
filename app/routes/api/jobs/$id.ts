import { createFileRoute } from '@tanstack/react-router'
import { getJobById, updateJob } from '../../../../server/api/jobs'

export const Route = createFileRoute('/api/jobs/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const job = await getJobById(Number(params.id))
        if (!job) {
          return new Response(JSON.stringify({ error: 'Job not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return Response.json(job)
      },
      PATCH: async ({ request, params }) => {
        const body = await request.json()
        const patch: { isFavorite?: boolean; isHidden?: boolean; notes?: string } = {}
        if (typeof body.isFavorite === 'boolean') patch.isFavorite = body.isFavorite
        if (typeof body.isHidden === 'boolean') patch.isHidden = body.isHidden
        if (typeof body.notes === 'string') patch.notes = body.notes

        await updateJob(Number(params.id), patch)
        const job = await getJobById(Number(params.id))
        return Response.json(job)
      },
    },
  },
})
