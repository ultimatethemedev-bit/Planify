export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-muted ${className}`}
    />
  )
}

export function EmployeeCardSkeleton() {
  return (
    <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
      <div className="flex flex-col items-center">
        <Skeleton className="size-20 rounded-full mb-4" />
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-4 w-40 mb-1" />
        <Skeleton className="h-4 w-28 mb-4" />
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-2 w-full">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function DashboardStatSkeleton() {
  return (
    <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50 text-center">
      <Skeleton className="size-12 rounded-full mx-auto mb-3" />
      <Skeleton className="h-7 w-16 mx-auto mb-2" />
      <Skeleton className="h-4 w-24 mx-auto" />
    </div>
  )
}

export function WeekPreviewSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[40px_1fr] gap-3">
        <div />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[40px_1fr] gap-3 items-center">
          <Skeleton className="size-8 rounded-full" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="h-7 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
