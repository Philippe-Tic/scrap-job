import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { SearchBar } from '~/components/search-bar'
import { JobList } from '~/components/job-list'
import { JobListSkeleton } from '~/components/job-list-skeleton'
import { Pagination } from '~/components/pagination'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import type { Job } from '~/lib/types'
import { createServerFn } from '@tanstack/react-start'

const SOURCES = [
  { id: 'emploi-territorial', label: 'Emploi Territ.' },
  { id: 'hellowork', label: 'HelloWork' },
  { id: 'indeed', label: 'Indeed' },
  { id: 'isarta', label: 'Isarta' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'welcometothejungle', label: 'WTTJ' },
] as const

const fetchJobs = createServerFn({ method: 'GET' })
  .inputValidator(
    (input: unknown) => input as { query?: string; source?: string; page?: number; excludeInternships?: boolean },
  )
  .handler(async ({ data }) => {
    const { getJobs } = await import('../../server/api/jobs')
    return getJobs({
      query: data.query,
      source: data.source,
      page: data.page || 1,
      excludeInternships: data.excludeInternships,
    })
  })

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  source: z.string().optional().catch(undefined),
  page: z.number().int().positive().optional().catch(1),
  excludeInternships: z.boolean().optional().catch(true),
})

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    q: search.q,
    source: search.source,
    page: search.page,
    excludeInternships: search.excludeInternships,
  }),
  loader: async ({ deps }) => {
    return fetchJobs({ data: { query: deps.q, source: deps.source, page: deps.page, excludeInternships: deps.excludeInternships } })
  },
  pendingComponent: JobListSkeleton,
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const router = useRouter()
  const { q, source, page, excludeInternships } = Route.useSearch()
  const data = Route.useLoaderData()
  const [clearing, setClearing] = useState(false)

  // Optimistic overlay: Map<jobId, partial overrides>
  const [optimistic, setOptimistic] = useState<Map<number, Partial<Job>>>(
    () => new Map(),
  )

  // Track loader data identity to reset optimistic state
  const prevDataRef = useRef(data)
  useEffect(() => {
    if (prevDataRef.current !== data) {
      prevDataRef.current = data
      setOptimistic(new Map())
    }
  }, [data])

  // Apply optimistic overrides and filter out hidden jobs
  const jobs = data.jobs
    .map((job) => {
      const override = optimistic.get(job.id)
      return override ? { ...job, ...override } : job
    })
    .filter((job) => !job.isHidden)

  function handleToggleFavorite(id: number, current: boolean) {
    const newValue = !current
    setOptimistic((prev) => {
      const next = new Map(prev)
      next.set(id, { ...prev.get(id), isFavorite: newValue })
      return next
    })

    fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: newValue }),
    }).catch(() => {
      // Rollback on error
      setOptimistic((prev) => {
        const next = new Map(prev)
        const existing = next.get(id)
        if (existing) {
          const { isFavorite: _, ...rest } = existing
          if (Object.keys(rest).length === 0) {
            next.delete(id)
          } else {
            next.set(id, rest)
          }
        }
        return next
      })
    })
  }

  function handleToggleHidden(id: number) {
    setOptimistic((prev) => {
      const next = new Map(prev)
      next.set(id, { ...prev.get(id), isHidden: true })
      return next
    })

    fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden: true }),
    }).catch(() => {
      // Rollback on error
      setOptimistic((prev) => {
        const next = new Map(prev)
        const existing = next.get(id)
        if (existing) {
          const { isHidden: _, ...rest } = existing
          if (Object.keys(rest).length === 0) {
            next.delete(id)
          } else {
            next.set(id, rest)
          }
        }
        return next
      })
    })
  }

  async function handleClear() {
    if (!window.confirm('Vider toute la base de données ?')) return
    setClearing(true)
    try {
      const res = await fetch('/api/jobs', { method: 'DELETE' })
      const json = await res.json()
      console.log('[clear] result:', json)
      router.invalidate()
    } catch (err) {
      console.error('[clear] failed:', err)
    } finally {
      setClearing(false)
    }
  }

  function handleSearch(query: string) {
    navigate({
      to: '/',
      search: { q: query || undefined, source, page: undefined },
      replace: true,
    })
  }

  function handleSourceFilter(sourceId: string | undefined) {
    navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        source: sourceId,
        page: undefined,
      }),
    })
  }

  function handlePageChange(newPage: number) {
    navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        page: newPage > 1 ? newPage : undefined,
      }),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Offres d'emploi</h1>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" disabled={clearing} onClick={handleClear}>
            {clearing ? 'Suppression...' : 'Vider la base'}
          </Button>
        </div>
      </div>

      {/* Toolbar: search + filters */}
      <div className="space-y-3">
        <SearchBar value={q ?? ''} onSearch={handleSearch} />

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className="cursor-pointer"
            variant={!source ? 'default' : 'outline'}
            onClick={() => handleSourceFilter(undefined)}
          >
            Toutes
          </Badge>
          {SOURCES.map((s) => (
            <Badge
              key={s.id}
              className="cursor-pointer"
              variant={source === s.id ? 'default' : 'outline'}
              onClick={() => handleSourceFilter(s.id)}
            >
              {s.label}
            </Badge>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={excludeInternships !== false}
              onChange={(e) =>
                navigate({
                  to: '/',
                  search: (prev) => ({ ...prev, excludeInternships: e.target.checked ? undefined : false, page: undefined }),
                })
              }
              className="accent-primary"
            />
            Exclure stages / alternances
          </label>
        </div>
      </div>

      <JobList
        jobs={jobs}
        onToggleFavorite={handleToggleFavorite}
        onToggleHidden={handleToggleHidden}
      />

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        onPageChange={handlePageChange}
      />
    </div>
  )
}
