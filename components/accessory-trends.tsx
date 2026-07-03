"use client"

import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Dumbbell, TrendingUp, Calendar } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ACCESSORY_CATALOG } from "@/lib/accessory-catalog"
import { usePreferredUnit } from "@/hooks/use-preferred-unit"

// Mapa accessoryId → český název z katalogu
const ACCESSORY_NAMES: Record<string, string> = Object.fromEntries(
  ACCESSORY_CATALOG.map((e) => [e.id, e.name])
)

// Barva primary (orange)
const ACCENT_COLOR = "#f97316"

// Parse YYYY-MM-DD directly — new Date(str) parses as UTC midnight and renders
// one day early in negative-offset timezones.
function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-")
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.`
}

// Tooltip pro e1RM / reps trend
function AccessoryTooltip({
  active,
  payload,
  label,
  isBodyweight,
  unitLabel,
}: {
  active?: boolean
  payload?: Array<{ value: number; color: string }>
  label?: string
  isBodyweight: boolean
  unitLabel: string
}) {
  const { t } = useTranslation()

  if (!active || !payload || payload.length === 0) return null
  const val = payload[0].value
  return (
    <div className="bg-card border border-border rounded p-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xs font-bold" style={{ color: payload[0].color }}>
        {isBodyweight ? t("charts.reps", { n: val }) : `${val} ${unitLabel} e1RM`}
      </p>
    </div>
  )
}

// ============================================================================
// Hlavní komponenta
// ============================================================================

export function AccessoryTrends() {
  const { t } = useTranslation()
  const { toDisplay, label: unitLabel } = usePreferredUnit()
  const usedAccessories = useQuery(api.accessories.getUsedAccessories)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Filtrujeme jen ty, které jsou v katalogu
  const knownAccessories = useMemo(
    () => (usedAccessories ?? []).filter((id) => ACCESSORY_NAMES[id]),
    [usedAccessories]
  )

  // Efektivní vybraný cvik — user volba nebo první dostupný
  const currentId =
    selectedId && knownAccessories.includes(selectedId)
      ? selectedId
      : knownAccessories[0] ?? null

  const trendsData = useQuery(
    api.accessories.getAccessoryTrends,
    currentId ? { accessoryId: currentId } : "skip"
  )

  // Zpracování dat pro grafy — vždy voláme useMemo (bez podmínek)
  const rawChartData = useMemo(() => {
    if (!trendsData) return []
    return trendsData.map((d) => ({
      date: formatDate(d.date),
      e1rm: d.bestE1RM,
      reps: d.totalReps,
      volume: d.totalVolume,
      weight: d.topWeight,
    }))
  }, [trendsData])

  // Převod na zobrazovanou jednotku
  const chartData = rawChartData.map((d) => ({
    ...d,
    e1rm: toDisplay(d.e1rm),
    weight: toDisplay(d.weight),
  }))

  const isBodyweight = useMemo(() => {
    if (!trendsData || trendsData.length === 0) return false
    return trendsData.every((d) => d.bestE1RM === 0 && d.topWeight === 0)
  }, [trendsData])

  const summary = useMemo(() => {
    if (!trendsData || trendsData.length === 0) return null
    const last = trendsData[trendsData.length - 1]
    const best = isBodyweight
      ? trendsData.reduce((a, b) => (b.totalReps > a.totalReps ? b : a))
      : trendsData.reduce((a, b) => (b.bestE1RM > a.bestE1RM ? b : a))
    return {
      lastDate: last.date,
      lastValue: isBodyweight ? last.totalReps : last.bestE1RM,
      bestValue: isBodyweight ? best.totalReps : best.bestE1RM,
      bestDate: best.date,
      sessions: trendsData.length,
    }
  }, [trendsData, isBodyweight])

  // ---- Loading skeleton ----
  if (usedAccessories === undefined) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-40" />
        </div>
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
    )
  }

  // ---- Empty state — uživatel nemá žádné accessory logy ----
  if (knownAccessories.length === 0) {
    return null
  }

  const isLoadingTrends = trendsData === undefined

  return (
    <div className="space-y-4">
      {/* Selektor cviku */}
      <Select value={currentId ?? ""} onValueChange={setSelectedId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("accessoryTrends.selectPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {knownAccessories.map((id) => (
            <SelectItem key={id} value={id}>
              {ACCESSORY_NAMES[id] ?? id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Graf + přehled */}
      <div className="bg-card border border-border rounded-sm p-4 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-bold uppercase tracking-widest text-sm">
            {currentId ? (ACCESSORY_NAMES[currentId] ?? currentId) : ""}
          </h3>
        </div>

        {/* Graf */}
        {isLoadingTrends ? (
          <Skeleton className="h-48 w-full rounded-sm" />
        ) : chartData.length < 2 ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">
              {t("charts.needWorkouts2")}
            </p>
          </div>
        ) : isBodyweight ? (
          // Bodyweight: AreaChart totalReps v čase
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="accessoryRepsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT_COLOR} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={ACCENT_COLOR} stopOpacity={0} />
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
                />
                <Tooltip
                  content={<AccessoryTooltip isBodyweight={true} unitLabel={unitLabel} />}
                />
                <Area
                  type="monotone"
                  dataKey="reps"
                  stroke={ACCENT_COLOR}
                  strokeWidth={2}
                  fill="url(#accessoryRepsGradient)"
                  name={t("accessoryTrends.repsLabel")}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          // Weighted: LineChart bestE1RM v čase
          <div className="h-48">
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
                <Tooltip
                  content={<AccessoryTooltip isBodyweight={false} unitLabel={unitLabel} />}
                />
                <Line
                  type="monotone"
                  dataKey="e1rm"
                  stroke={ACCENT_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3, fill: ACCENT_COLOR }}
                  name="e1RM"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Mini přehled pod grafem */}
        {isLoadingTrends ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
            {/* Poslední výkon */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {t("accessoryTrends.last")}
                </span>
              </div>
              <div className="font-heading font-bold text-lg">
                {isBodyweight ? summary.lastValue : toDisplay(summary.lastValue)}
                <span className="text-xs text-muted-foreground ml-1">
                  {isBodyweight ? "rep" : unitLabel}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatDate(summary.lastDate)}
              </div>
            </div>

            {/* Nejlepší výkon */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {t("accessoryTrends.best")}
                </span>
              </div>
              <div className="font-heading font-bold text-lg text-primary">
                {isBodyweight ? summary.bestValue : toDisplay(summary.bestValue)}
                <span className="text-xs text-muted-foreground ml-1">
                  {isBodyweight ? "rep" : unitLabel}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatDate(summary.bestDate)}
              </div>
            </div>

            {/* Počet tréninků */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Dumbbell className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {t("accessoryTrends.sessions")}
                </span>
              </div>
              <div className="font-heading font-bold text-lg">
                {summary.sessions}
              </div>
              <div className="text-[10px] text-muted-foreground">{t("accessoryTrends.total")}</div>
            </div>
          </div>
        ) : (
          <div className="pt-3 border-t border-border">
            <p className="text-muted-foreground text-xs">
              {t("accessoryTrends.noData")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
