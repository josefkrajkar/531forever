"use client"

import { useQuery } from "convex/react"
import { useTranslation } from "react-i18next"
import { api } from "@/convex/_generated/api"
import Link from "next/link"
import { ArrowLeft, User, TrendingUp, Award, Dumbbell, Scale, Target, Activity, PieChart, BarChart3, Layers, Weight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  E1RMProgressChart,
  WilksTrendChart,
  AmrapPerformanceChart,
  WeeklyVolumeChart,
  LiftDistributionChart,
  BodyweightChart,
} from "./statistics-charts"
import { AccessoryTrends } from "./accessory-trends"
import { ReadinessTrendChart } from "./readiness-trend-chart"
import {
  calculateWilks,
  calculateDOTS,
  calculateBWMultiple,
  getStrengthLevel,
  getStrengthStandards,
  calculateTotal,
  getWilksDescription,
  type Gender,
} from "@/lib/strength-calculations"

type Lift = "squat" | "bench" | "deadlift" | "press"

export default function StatisticsPageContent() {
  const { t } = useTranslation()
  const currentUser = useQuery(api.users.currentLoggedInUser)
  const currentProgram = useQuery(api.programs.getCurrentProgram)
  const statsData = useQuery(api.statistics.getStatisticsData)
  const bodyweightHistory = useQuery(api.bodyweight.getBodyweightHistory)
  const readinessHistory = useQuery(api.readiness.getReadinessHistory)

  const athleteProfile = currentUser?.athleteProfile
  const bodyweight = athleteProfile?.weight ?? 0
  const gender = (athleteProfile?.gender as Gender) ?? "Muž"

  // Calculate e1RMs from Training Maxes (TM = 90% of e1RM, so e1RM = TM / 0.9)
  // Or use e1rmHistory if available
  const getE1RM = (lift: Lift): number => {
    // First try e1rmHistory (most accurate)
    const history = currentProgram?.e1rmHistory?.[lift]
    if (history && history.length > 0) {
      return history[history.length - 1]
    }
    // Fall back to TM / 0.9
    const tm = currentProgram?.trainingMaxes?.[lift]
    if (tm) {
      return Math.round(tm / 0.9)
    }
    return 0
  }

  const e1rms = {
    squat: getE1RM("squat"),
    bench: getE1RM("bench"),
    deadlift: getE1RM("deadlift"),
    press: getE1RM("press"),
  }

  const sbdTotal = calculateTotal(e1rms.squat, e1rms.bench, e1rms.deadlift)
  const wilks = calculateWilks(sbdTotal, bodyweight, gender)
  const dots = calculateDOTS(sbdTotal, bodyweight, gender)

  const hasProfile = bodyweight > 0
  const hasProgram = currentProgram?.status === "active"
  const hasData = hasProfile && hasProgram && sbdTotal > 0

  // Aktuální váha: poslední log nebo fallback na profil
  const bwLogs = bodyweightHistory ?? []
  const lastBwLog = bwLogs.length > 0 ? bwLogs[bwLogs.length - 1] : null
  const readinessLogs = readinessHistory ?? []

  // Loading state
  if (
    currentUser === undefined ||
    currentProgram === undefined ||
    statsData === undefined ||
    bodyweightHistory === undefined ||
    readinessHistory === undefined
  ) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Header skeleton */}
        <header className="border-b border-border sticky top-0 bg-background z-10">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
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
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border border-border rounded-sm p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-48 w-full rounded-sm" />
              </div>
            ))}
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

          {/* Accessory trends skeleton */}
          <div className="space-y-4 pt-6 border-t border-border">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-10 w-full" />
            <div className="bg-card border border-border rounded-sm p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-48 w-full rounded-sm" />
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/app"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-heading font-extrabold text-xl uppercase tracking-widest">
              {t("stats.title")}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Missing profile warning */}
        {!hasProfile && (
          <div className="bg-card border border-border rounded-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-heading font-bold uppercase tracking-widest text-sm mb-2">
                  {t("stats.missingProfileTitle")}
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  {t("stats.missingProfileDesc")}
                </p>
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest px-4 py-2 text-xs hover:opacity-90 transition-opacity"
                >
                  {t("stats.missingProfileBtn")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Missing program warning */}
        {hasProfile && !hasProgram && (
          <div className="bg-card border border-border rounded-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Dumbbell className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-heading font-bold uppercase tracking-widest text-sm mb-2">
                  {t("stats.missingProgramTitle")}
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  {t("stats.missingProgramDesc")}
                </p>
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest px-4 py-2 text-xs hover:opacity-90 transition-opacity"
                >
                  {t("stats.missingProgramBtn")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main stats */}
        {hasData && (
          <>
            {/* Hero stats - Wilks & DOTS */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-sm p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground uppercase tracking-widest">Wilks</span>
                  </div>
                  <div className="font-heading font-extrabold text-4xl text-foreground mb-1">
                    {wilks.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(getWilksDescription(wilks))}
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-sm p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground uppercase tracking-widest">DOTS</span>
                  </div>
                  <div className="font-heading font-extrabold text-4xl text-foreground mb-1">
                    {dots.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("stats.ipfStandard")}
                  </div>
                </div>
              </div>
            </div>

            {/* SBD Total */}
            <div className="bg-card border border-border rounded-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground uppercase tracking-widest">SBD Total</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {bodyweight} kg @ {gender}
                </div>
              </div>
              <div className="font-heading font-extrabold text-5xl text-foreground mb-2">
                {sbdTotal} <span className="text-xl text-muted-foreground">kg</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>S: {e1rms.squat}</span>
                <span className="text-border">|</span>
                <span>B: {e1rms.bench}</span>
                <span className="text-border">|</span>
                <span>D: {e1rms.deadlift}</span>
              </div>
            </div>

            {/* Per-lift stats */}
            <div className="space-y-3">
              <h2 className="font-heading font-bold uppercase tracking-widest text-sm text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                {t("stats.perLiftTitle")}
              </h2>
              
              {(["squat", "bench", "deadlift", "press"] as Lift[]).map((lift) => {
                const e1rm = e1rms[lift]
                const bwMultiple = calculateBWMultiple(e1rm, bodyweight)
                const level = getStrengthLevel(lift, e1rm, bodyweight, gender)
                const standards = getStrengthStandards(lift, gender)
                
                // Calculate progress percentage for bar
                const maxStandard = standards[standards.length - 1]
                const progressPercent = Math.min(100, (bwMultiple / maxStandard.minMultiple) * 100)

                return (
                  <div key={lift} className="bg-card border border-border rounded-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-heading font-bold uppercase tracking-widest text-sm">
                        {t(`lifts.${lift}`)}
                      </span>
                      <span
                        className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded"
                        style={{ backgroundColor: level.color + "20", color: level.color }}
                      >
                        {t(level.level)}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-3 mb-3">
                      <span className="font-heading font-extrabold text-2xl">
                        {e1rm} <span className="text-base text-muted-foreground">kg</span>
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t("stats.bwMultiple", { value: bwMultiple.toFixed(2) })}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: level.color,
                        }}
                      />
                      {/* Level markers */}
                      {standards.slice(1).map((std) => (
                        <div
                          key={std.level}
                          className="absolute top-0 w-0.5 h-full bg-background/50"
                          style={{
                            left: `${(std.minMultiple / maxStandard.minMultiple) * 100}%`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Legend */}
                    <div className="flex justify-between mt-2 text-[10px] text-muted-foreground/60">
                      {standards.map((std) => (
                        <span key={std.level} style={{ color: std.color }}>
                          {std.minMultiple}×
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Profile summary */}
            <div className="bg-card/50 border border-border/50 rounded-sm p-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>
                  {athleteProfile?.gender}, {athleteProfile?.age} let, {bodyweight} kg
                </span>
                <span className="text-border">•</span>
                <span>{athleteProfile?.experience}</span>
              </div>
            </div>

            {/* Charts Section */}
            {statsData && (
              <div className="space-y-6 pt-6 border-t border-border">
                <h2 className="font-heading font-bold uppercase tracking-widest text-lg text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  {t("stats.chartsTitle")}
                </h2>

                {/* e1RM Progress Chart */}
                <div className="bg-card border border-border rounded-sm p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h3 className="font-heading font-bold uppercase tracking-widest text-sm">
                      {t("stats.e1rmProgressTitle")}
                    </h3>
                  </div>
                  <E1RMProgressChart amrapResults={statsData.amrapResults} />
                </div>

                {/* Wilks Trend Chart */}
                <div className="bg-card border border-border rounded-sm p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="w-4 h-4 text-primary" />
                    <h3 className="font-heading font-bold uppercase tracking-widest text-sm">
                      {t("stats.wilksTrendTitle")}
                    </h3>
                  </div>
                  <WilksTrendChart
                    amrapResults={statsData.amrapResults}
                    bodyweight={bodyweight}
                    gender={gender}
                    bodyweightLogs={bwLogs}
                  />
                </div>

                {/* AMRAP Performance Chart */}
                <div className="bg-card border border-border rounded-sm p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="font-heading font-bold uppercase tracking-widest text-sm">
                      {t("stats.amrapPerformanceTitle")}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t("stats.amrapPerformanceDesc")}
                  </p>
                  <AmrapPerformanceChart amrapResults={statsData.amrapResults} />
                </div>

                {/* Weekly Volume Chart */}
                <div className="bg-card border border-border rounded-sm p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <h3 className="font-heading font-bold uppercase tracking-widest text-sm">
                      {t("stats.weeklyVolumeTitle")}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t("stats.weeklyVolumeDesc")}
                  </p>
                  <WeeklyVolumeChart weeklyVolume={statsData.weeklyVolume} />
                </div>

                {/* Lift Distribution Chart */}
                <div className="bg-card border border-border rounded-sm p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <PieChart className="w-4 h-4 text-primary" />
                    <h3 className="font-heading font-bold uppercase tracking-widest text-sm">
                      {t("stats.liftDistributionTitle")}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t("stats.liftDistributionDesc")}
                  </p>
                  <LiftDistributionChart distribution={statsData.liftDistribution} />
                </div>

                {/* Bodyweight Chart — zobraz jen pokud ≥ 2 logy */}
                {bwLogs.length >= 2 && (
                  <div className="bg-card border border-border rounded-sm p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Weight className="w-4 h-4 text-primary" />
                        <h3 className="font-heading font-bold uppercase tracking-widest text-sm">
                          {t("stats.bodyweightTitle")}
                        </h3>
                      </div>
                      {lastBwLog && (
                        <span className="text-xs text-muted-foreground">
                          {t("stats.bodyweightLast", { weight: lastBwLog.weightKg, date: lastBwLog.date })}
                        </span>
                      )}
                    </div>
                    <BodyweightChart logs={bwLogs} />
                  </div>
                )}

                {/* Readiness trend — zobraz jen pokud ≥ 2 záznamy */}
                {readinessLogs.length >= 2 && (
                  <div className="bg-card border border-border rounded-sm p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-4 h-4 text-primary" />
                      <h3 className="font-heading font-bold uppercase tracking-widest text-sm">
                        {t("stats.readinessTrendTitle")}
                      </h3>
                    </div>
                    <ReadinessTrendChart history={readinessLogs} />
                  </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-sm p-4 text-center">
                    <div className="text-3xl font-heading font-extrabold text-primary">
                      {statsData.totalWorkouts}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                      {t("stats.totalWorkoutsLabel")}
                    </div>
                  </div>
                  <div className="bg-card border border-border rounded-sm p-4 text-center">
                    <div className="text-3xl font-heading font-extrabold text-primary">
                      {statsData.currentCycle}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                      {t("stats.currentCycleLabel")}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Accessory Trends Section */}
            <div className="space-y-4 pt-6 border-t border-border">
              <h2 className="font-heading font-bold uppercase tracking-widest text-lg text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                {t("stats.accessorySectionTitle")}
              </h2>
              <AccessoryTrends />
            </div>
          </>
        )}

        {/* Info about calculations */}
        <div className="text-xs text-muted-foreground/60 space-y-2 pt-4 border-t border-border/50">
          <p>{t("stats.footnoteWilks")}</p>
          <p>{t("stats.footnoteStrengthLevel")}</p>
          <p>{t("stats.footnoteE1rm")}</p>
        </div>
      </main>
    </div>
  )
}
