import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "lucide-react"

export default function StatisticsLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <Skeleton className="h-6 w-32" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Hero stats — Wilks & DOTS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-sm p-5 space-y-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="bg-card border border-border rounded-sm p-5 space-y-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* SBD Total */}
        <div className="bg-card border border-border rounded-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-14 w-40" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* Per-lift skeletons — 4 lifty */}
        <div className="space-y-3">
          <Skeleton className="h-3 w-36" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
              <div className="flex items-baseline gap-3">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex justify-between">
                {[0, 1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="h-2.5 w-6" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Profile summary */}
        <div className="bg-card/50 border border-border/50 rounded-sm p-4">
          <Skeleton className="h-3 w-56" />
        </div>

        {/* Charts section */}
        <div className="space-y-6 pt-6 border-t border-border">
          <Skeleton className="h-5 w-40" />

          {/* 5 grafových ploch */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-48 w-full rounded-sm" />
            </div>
          ))}

          {/* Quick stats — 2 karty */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-sm p-4 flex flex-col items-center gap-2">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="bg-card border border-border rounded-sm p-4 flex flex-col items-center gap-2">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
