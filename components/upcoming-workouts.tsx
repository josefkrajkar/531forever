"use client"

import { useTranslation } from "react-i18next"
import {
  getUpcomingWorkouts,
  getWeekLabel,
  getPhaseLabelShort,
  type ProgramSnapshot,
  type UpcomingWorkout,
} from "@/lib/upcoming"
// ============================================================================
// Typy pro props
// ============================================================================

interface UpcomingWorkoutsProps {
  program: ProgramSnapshot
  count?: number
}

// ============================================================================
// Helper: barva fáze
// ============================================================================

function phaseColor(phase: string): string {
  switch (phase) {
    case "leader1":
    case "leader2":
      return "text-blue-400"
    case "anchor":
      return "text-orange-400"
    case "seventh_week":
      return "text-purple-400"
    default:
      return "text-muted-foreground"
  }
}

// ============================================================================
// Helper: badge pro 7. týden protokol
// ============================================================================

function SeventhWeekBadge({ protocol }: { protocol: string | null }) {
  const { t } = useTranslation()

  if (!protocol) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-heading font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
        {t("upcoming.protocolNotSelected")}
      </span>
    )
  }
  if (protocol === "tm_test") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-heading font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30">
        {t("upcoming.tmTest")}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-heading font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
      {t("upcoming.deload")}
    </span>
  )
}

// ============================================================================
// Karta jednoho nadcházejícího tréninku
// ============================================================================

function WorkoutCard({ workout }: { workout: UpcomingWorkout }) {
  const { t } = useTranslation()
  const weekLabel = getWeekLabel(workout.week, workout.isSeventhWeek)
  const phaseLabel = getPhaseLabelShort(workout.phase)

  return (
    <article
      className="bg-card border border-border rounded-lg p-4 space-y-3"
      aria-label={t("upcoming.workoutAriaLabel", { name: t(workout.liftDisplayName) })}
    >
      {/* Hlavička: lift + fáze */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading font-extrabold uppercase tracking-wide text-base leading-tight">
            {t(workout.liftDisplayName)}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs font-heading font-bold uppercase tracking-wider ${phaseColor(workout.phase)}`}>
              {t(phaseLabel)}
            </span>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {t(weekLabel)}
            </span>
          </div>
        </div>

        {/* Top set nebo 7th week badge */}
        {workout.isSeventhWeek ? (
          <SeventhWeekBadge protocol={workout.seventhWeekProtocol} />
        ) : workout.topSetWeight !== null ? (
          <div className="text-right bg-secondary rounded px-3 py-2 shrink-0">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">{t("upcoming.topSet")}</p>
            <p className="font-heading font-bold text-lg leading-tight">
              {workout.topSetWeight}
              <span className="text-sm font-normal text-muted-foreground"> kg</span>
            </p>
          </div>
        ) : null}
      </div>

      {/* Hlavní série (u 7. týdne jen pokud je znám protokol) */}
      {workout.mainSets.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {workout.mainSets.map((set, idx) => (
            <span
              key={idx}
              className={`text-xs font-heading font-bold px-2 py-1 rounded border ${
                set.isAmrap
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-secondary border-transparent text-foreground"
              }`}
            >
              {set.weight} × {set.targetReps}{set.isAmrap ? "+" : ""}
            </span>
          ))}
        </div>
      )}

      {/* TM may change hint */}
      {workout.tmMayChange && (
        <p className="text-xs text-muted-foreground/60 italic">
          {t("upcoming.tmMayChange")}
        </p>
      )}
    </article>
  )
}

// ============================================================================
// Hlavní komponenta
// ============================================================================

export default function UpcomingWorkouts({ program, count = 8 }: UpcomingWorkoutsProps) {
  const { t } = useTranslation()
  const workouts = getUpcomingWorkouts(program, count)

  if (workouts.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground text-sm uppercase tracking-widest">
          {t("upcoming.noWorkouts")}
        </p>
      </div>
    )
  }

  return (
    <section aria-label={t("upcoming.sectionAriaLabel")}>
      <div className="space-y-3">
        {workouts.map((workout) => (
          <WorkoutCard key={workout.index} workout={workout} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground/40 text-center mt-4 uppercase tracking-widest">
        {t("upcoming.footer")}
      </p>
    </section>
  )
}

// Re-exportujeme typ pro workout-page
export type { ProgramSnapshot }
