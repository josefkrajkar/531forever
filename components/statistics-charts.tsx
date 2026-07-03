"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { usePreferredUnit } from "@/hooks/use-preferred-unit"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { estimateE1RM, calculateWilks, type Gender } from "@/lib/strength-calculations"
import { weightAtDate } from "@/lib/bodyweight"

// Colors for lifts
const LIFT_COLORS = {
  squat: "#f97316", // orange (primary)
  bench: "#3b82f6", // blue
  deadlift: "#22c55e", // green
  press: "#a855f7", // purple
  accessories: "#6b7280", // gray
}

interface AmrapResult {
  cycle: number
  week: number
  lift: string
  weight: number
  targetReps: number
  actualReps: number
  autoregulated?: boolean
  date: string
}

interface E1RMChartProps {
  amrapResults: AmrapResult[]
}

/**
 * e1RM Progress Chart - shows estimated 1RM over time for each lift
 */
export function E1RMProgressChart({ amrapResults }: E1RMChartProps) {
  const { t } = useTranslation()
  const { toDisplay, label: unitLabel } = usePreferredUnit()

  const liftNames: Record<string, string> = {
    squat: t("lifts.squat"),
    bench: t("lifts.bench"),
    deadlift: t("lifts.deadlift"),
    press: t("lifts.press"),
    accessories: t("charts.accessory"),
  }

  const rawChartData = useMemo(() => {
    // Group by date and calculate e1RM for each lift
    const byDate: Record<string, Record<string, number>> = {}

    for (const result of amrapResults) {
      if (!byDate[result.date]) {
        byDate[result.date] = {}
      }
      const e1rm = estimateE1RM(result.weight, result.actualReps)
      byDate[result.date][result.lift] = e1rm
    }

    // Convert to array, carrying forward last known values
    const dates = Object.keys(byDate).sort()
    const data: Array<{ date: string; squat?: number; bench?: number; deadlift?: number; press?: number }> = []
    const lastKnown: Record<string, number> = {}

    for (const date of dates) {
      const entry = byDate[date]
      // Update last known values
      for (const [lift, e1rm] of Object.entries(entry)) {
        lastKnown[lift] = e1rm
      }
      data.push({
        date: formatDate(date),
        squat: lastKnown.squat,
        bench: lastKnown.bench,
        deadlift: lastKnown.deadlift,
        press: lastKnown.press,
      })
    }

    return data
  }, [amrapResults])

  const chartData = rawChartData.map((d) => ({
    ...d,
    squat: d.squat != null ? toDisplay(d.squat) : undefined,
    bench: d.bench != null ? toDisplay(d.bench) : undefined,
    deadlift: d.deadlift != null ? toDisplay(d.deadlift) : undefined,
    press: d.press != null ? toDisplay(d.press) : undefined,
  }))

  if (chartData.length < 2) {
    return <EmptyChartMessage message={t("charts.needAmrap2")} />
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            unit={` ${unitLabel}`}
          />
          <Tooltip content={<CustomTooltip unit={unitLabel} liftNames={liftNames} />} />
          <Legend
            formatter={(value) => liftNames[value] || value}
            wrapperStyle={{ fontSize: 11 }}
          />
          <Line type="monotone" dataKey="squat" stroke={LIFT_COLORS.squat} strokeWidth={2} dot={{ r: 3 }} name="squat" />
          <Line type="monotone" dataKey="bench" stroke={LIFT_COLORS.bench} strokeWidth={2} dot={{ r: 3 }} name="bench" />
          <Line type="monotone" dataKey="deadlift" stroke={LIFT_COLORS.deadlift} strokeWidth={2} dot={{ r: 3 }} name="deadlift" />
          <Line type="monotone" dataKey="press" stroke={LIFT_COLORS.press} strokeWidth={2} dot={{ r: 3 }} name="press" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface BodyweightLog {
  date: string
  weightKg: number
}

interface WilksTrendChartProps {
  amrapResults: AmrapResult[]
  bodyweight: number
  gender: Gender
  bodyweightLogs?: BodyweightLog[]
}

/**
 * Wilks Trend Chart - shows Wilks score over time
 * Používá historickou tělesnou váhu z bodyweightLogs (pokud jsou k dispozici)
 * pro přesnější výpočet Wilks bodů v každém bodě grafu.
 */
export function WilksTrendChart({ amrapResults, bodyweight, gender, bodyweightLogs = [] }: WilksTrendChartProps) {
  const { t } = useTranslation()

  const chartData = useMemo(() => {
    // Group by date and calculate total from e1RMs
    const byDate: Record<string, Record<string, number>> = {}

    for (const result of amrapResults) {
      if (!byDate[result.date]) {
        byDate[result.date] = {}
      }
      const e1rm = estimateE1RM(result.weight, result.actualReps)
      byDate[result.date][result.lift] = e1rm
    }

    const dates = Object.keys(byDate).sort()
    const data: Array<{ date: string; wilks: number; total: number }> = []
    const lastKnown: Record<string, number> = { squat: 0, bench: 0, deadlift: 0 }

    for (const date of dates) {
      const entry = byDate[date]
      for (const [lift, e1rm] of Object.entries(entry)) {
        if (lift in lastKnown) {
          lastKnown[lift] = e1rm
        }
      }

      // Only plot once all three SBD lifts have an e1RM — otherwise a missing
      // lift counts as 0 and the early points understate Wilks (false ramp-up).
      const hasAllLifts =
        lastKnown.squat > 0 && lastKnown.bench > 0 && lastKnown.deadlift > 0
      if (hasAllLifts) {
        const total = lastKnown.squat + lastKnown.bench + lastKnown.deadlift
        // Použij historickou váhu platnou k danému datu (nebo fallback na profil)
        const bwForDate = weightAtDate(bodyweightLogs, date, bodyweight)
        const wilks = calculateWilks(total, bwForDate, gender)
        data.push({
          date: formatDate(date),
          wilks: Math.round(wilks),
          total,
        })
      }
    }

    return data
  }, [amrapResults, bodyweight, gender, bodyweightLogs])

  if (chartData.length < 2) {
    return <EmptyChartMessage message={t("charts.needWilksData")} />
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="wilksGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={LIFT_COLORS.squat} stopOpacity={0.3} />
              <stop offset="95%" stopColor={LIFT_COLORS.squat} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            domain={["dataMin - 10", "dataMax + 10"]}
          />
          <Tooltip content={<CustomTooltip unit={t("charts.wilksUnit")} liftNames={{}} />} />
          <Area
            type="monotone"
            dataKey="wilks"
            stroke={LIFT_COLORS.squat}
            strokeWidth={2}
            fill="url(#wilksGradient)"
            name="Wilks"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface AmrapPerformanceChartProps {
  amrapResults: AmrapResult[]
}

/**
 * AMRAP Performance Chart - shows actual vs target reps
 */
export function AmrapPerformanceChart({ amrapResults }: AmrapPerformanceChartProps) {
  const { t } = useTranslation()

  const liftNames: Record<string, string> = {
    squat: t("lifts.squat"),
    bench: t("lifts.bench"),
    deadlift: t("lifts.deadlift"),
    press: t("lifts.press"),
    accessories: t("charts.accessory"),
  }

  const chartData = useMemo(() => {
    // Last 20 AMRAP results
    const recent = [...amrapResults]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-20)

    // Use first character of the lift key for axis label (not translated — fits narrow axis tick)
    return recent.map((r, i) => ({
      index: i + 1,
      label: `${r.lift?.[0]?.toUpperCase() ?? "?"} C${r.cycle}W${r.week}`,
      target: r.targetReps,
      actual: r.actualReps,
      diff: r.actualReps - r.targetReps,
      lift: r.lift,
    }))
  }, [amrapResults])

  if (chartData.length < 3) {
    return <EmptyChartMessage message={t("charts.needAmrap3")} />
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          <Tooltip content={<AmrapTooltip liftNames={liftNames} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="target" fill="hsl(var(--muted))" name={t("charts.target")} radius={[2, 2, 0, 0]} />
          <Bar dataKey="actual" name={t("charts.actual")} radius={[2, 2, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.diff >= 0 ? "#22c55e" : "#ef4444"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface WeeklyVolumeChartProps {
  weeklyVolume: Array<{
    week: string
    total: number
    squat: number
    bench: number
    deadlift: number
    press: number
    accessories: number
  }>
}

/**
 * Weekly Volume Chart - stacked area chart of training volume by lift
 */
export function WeeklyVolumeChart({ weeklyVolume }: WeeklyVolumeChartProps) {
  const { t } = useTranslation()

  const liftNames: Record<string, string> = {
    squat: t("lifts.squat"),
    bench: t("lifts.bench"),
    deadlift: t("lifts.deadlift"),
    press: t("lifts.press"),
    accessories: t("charts.accessory"),
  }

  const chartData = useMemo(() => {
    // kg → tonnes with 1 decimal. Rounding each lift to whole tons made small
    // lifts vanish (e.g. 400 kg → 0 t) and made the stacked lifts sum to less
    // than the true weekly total.
    const toTons = (kg: number) => Math.round(kg / 100) / 10
    return weeklyVolume.map((w) => ({
      ...w,
      week: formatWeek(w.week),
      total: toTons(w.total),
      squat: toTons(w.squat),
      bench: toTons(w.bench),
      deadlift: toTons(w.deadlift),
      press: toTons(w.press),
      accessories: toTons(w.accessories),
    }))
  }, [weeklyVolume])

  if (chartData.length < 2) {
    return <EmptyChartMessage message={t("charts.needWeeks2")} />
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            {Object.entries(LIFT_COLORS).map(([lift, color]) => (
              <linearGradient key={lift} id={`volume${lift}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.6} />
                <stop offset="95%" stopColor={color} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="week"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            unit=" t"
          />
          <Tooltip content={<VolumeTooltip liftNames={liftNames} weekLabel={t("charts.weekLabel")} totalLabel={t("charts.total")} />} />
          <Legend
            formatter={(value) => liftNames[value] || value}
            wrapperStyle={{ fontSize: 11 }}
          />
          <Area type="monotone" dataKey="squat" stackId="1" stroke={LIFT_COLORS.squat} fill={`url(#volumesquat)`} name="squat" />
          <Area type="monotone" dataKey="bench" stackId="1" stroke={LIFT_COLORS.bench} fill={`url(#volumebench)`} name="bench" />
          <Area type="monotone" dataKey="deadlift" stackId="1" stroke={LIFT_COLORS.deadlift} fill={`url(#volumedeadlift)`} name="deadlift" />
          <Area type="monotone" dataKey="press" stackId="1" stroke={LIFT_COLORS.press} fill={`url(#volumepress)`} name="press" />
          <Area type="monotone" dataKey="accessories" stackId="1" stroke={LIFT_COLORS.accessories} fill={`url(#volumeaccessories)`} name="accessories" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface LiftDistributionChartProps {
  distribution: {
    squat: number
    bench: number
    deadlift: number
    press: number
    accessories: number
  }
}

/**
 * Lift Distribution Chart - pie/donut chart of volume per lift
 */
export function LiftDistributionChart({ distribution }: LiftDistributionChartProps) {
  const { t } = useTranslation()

  const chartData = useMemo(() => {
    const total = Object.values(distribution).reduce((a, b) => a + b, 0)
    if (total === 0) return []

    return [
      { name: t("lifts.squat"), value: distribution.squat, color: LIFT_COLORS.squat },
      { name: t("lifts.bench"), value: distribution.bench, color: LIFT_COLORS.bench },
      { name: t("lifts.deadlift"), value: distribution.deadlift, color: LIFT_COLORS.deadlift },
      { name: t("lifts.press"), value: distribution.press, color: LIFT_COLORS.press },
      { name: t("charts.accessory"), value: distribution.accessories, color: LIFT_COLORS.accessories },
    ].filter((d) => d.value > 0)
  }, [distribution, t])

  if (chartData.length === 0) {
    return <EmptyChartMessage message={t("charts.noVolumeData")} />
  }

  return (
    <div className="h-64 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${(value / 1000).toFixed(1)} t`, t("charts.volumeLabel")]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "4px",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

interface BodyweightChartProps {
  logs: BodyweightLog[]
}

/**
 * Bodyweight Chart - zobrazí vývoj tělesné váhy v čase
 * Zobrazuje se jen pokud existují >= 2 záznamy.
 */
export function BodyweightChart({ logs }: BodyweightChartProps) {
  const { t } = useTranslation()
  const { toDisplay, label: unitLabel } = usePreferredUnit()

  const chartData = useMemo(() => {
    return logs
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => ({
        date: formatDate(l.date),
        weight: l.weightKg,
      }))
  }, [logs])

  const displayChartData = chartData.map((d) => ({ ...d, weight: toDisplay(d.weight) }))

  if (chartData.length < 2) {
    return <EmptyChartMessage message={t("charts.needBodyweight2")} />
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="bodyweightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            unit={` ${unitLabel}`}
            domain={["dataMin - 2", "dataMax + 2"]}
          />
          <Tooltip content={<CustomTooltip unit={unitLabel} liftNames={{}} />} />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--primary))" }}
            name="weight"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Recharts passes arbitrary payload shapes — we narrow only what we use
interface RechartsPayloadEntry {
  color?: string
  dataKey?: string
  name?: string
  value?: number
  payload?: Record<string, unknown>
}

// Helper components
function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="h-64 flex items-center justify-center">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
}

interface CustomTooltipProps {
  active?: boolean
  payload?: RechartsPayloadEntry[]
  label?: string
  unit: string
  liftNames: Record<string, string>
}

function CustomTooltip({ active, payload, label, unit, liftNames }: CustomTooltipProps) {
  if (!active || !payload) return null

  return (
    <div className="bg-card border border-border rounded p-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-xs" style={{ color: entry.color }}>
          {(entry.dataKey && liftNames[entry.dataKey]) || entry.name}: {entry.value} {unit}
        </p>
      ))}
    </div>
  )
}

interface AmrapPayload {
  lift: string
  label: string
  target: number
  actual: number
  diff: number
}

interface AmrapTooltipProps {
  active?: boolean
  payload?: Array<{ payload: AmrapPayload }>
  liftNames: Record<string, string>
}

function AmrapTooltip({ active, payload, liftNames }: AmrapTooltipProps) {
  const { t } = useTranslation()

  if (!active || !payload || !payload[0]) return null

  const data = payload[0].payload
  const diff = data.actual - data.target

  return (
    <div className="bg-card border border-border rounded p-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">
        {liftNames[data.lift]} - {t("charts.cycle")} {data.label.split("C")[1]?.split("W")[0]}
      </p>
      <p className="text-xs">{t("charts.tooltipTarget", { n: data.target })}</p>
      <p className="text-xs">{t("charts.tooltipActual", { n: data.actual })}</p>
      <p className={`text-xs font-bold ${diff >= 0 ? "text-green-500" : "text-red-500"}`}>
        {diff >= 0 ? "+" : ""}{diff} {t("charts.vsTarget")}
      </p>
    </div>
  )
}

interface VolumeTooltipProps {
  active?: boolean
  payload?: RechartsPayloadEntry[]
  label?: string
  liftNames: Record<string, string>
  weekLabel: string
  totalLabel: string
}

function VolumeTooltip({ active, payload, label, liftNames, weekLabel, totalLabel }: VolumeTooltipProps) {
  if (!active || !payload) return null

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0)

  return (
    <div className="bg-card border border-border rounded p-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{weekLabel} {label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-xs" style={{ color: entry.color }}>
          {(entry.dataKey && liftNames[entry.dataKey]) || entry.name}: {entry.value} t
        </p>
      ))}
      <p className="text-xs font-bold text-foreground mt-1 pt-1 border-t border-border">
        {totalLabel}: {total.toFixed(1)} t
      </p>
    </div>
  )
}

// Helpers
// Parse YYYY-MM-DD directly (do NOT use new Date(str), which parses as UTC
// midnight and then renders one day early in negative-offset timezones).
function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-")
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.`
}

// Week bucket key is also YYYY-MM-DD (Monday of the week) — same safe parse.
function formatWeek(dateStr: string): string {
  const [, m, d] = dateStr.split("-")
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.`
}
