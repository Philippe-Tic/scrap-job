import { SearchX } from 'lucide-react'
import { JobCard } from '~/components/job-card'
import type { Job } from '~/lib/types'

interface JobListProps {
  jobs: Job[]
  onToggleFavorite: (id: number, current: boolean) => void
  onToggleHidden: (id: number) => void
}

export function JobList({ jobs, onToggleFavorite, onToggleHidden }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-10 text-center text-muted-foreground">
        <SearchX className="size-10 opacity-40" />
        <p className="text-lg font-medium">Aucune offre trouvée</p>
        <p className="text-sm">
          Essayez de modifier votre recherche ou lancez un scrape pour collecter de nouvelles offres.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onToggleFavorite={onToggleFavorite}
          onToggleHidden={onToggleHidden}
        />
      ))}
    </div>
  )
}
