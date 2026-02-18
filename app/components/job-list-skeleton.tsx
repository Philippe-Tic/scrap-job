import { Card, CardContent } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

function JobCardSkeleton() {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-3">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />
        {/* Meta info */}
        <div className="flex gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Badges */}
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        {/* Actions */}
        <div className="flex gap-1 pt-1">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}

export function JobListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search bar skeleton */}
      <Skeleton className="h-9 w-full rounded-md" />
      {/* Cards */}
      <div className="grid gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
