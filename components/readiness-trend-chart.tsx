"use client"

/**
 * readiness-trend-chart.tsx — vývoj readiness skóre v čase.
 *
 * Pro každý den spočítá deterministické readiness skóre (lib/readiness) s
 * baseline z předchozích dnů a vykreslí ho (0–100) vedle křivky síly na
 * stránce statistik. Transparentní — žádná predikce.
 */

import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import {
  computeReadinessScore,
  computeBaseline,
  type ReadinessSignals,
  type ReadinessHistoryEntry,
} from "@/lib/readiness"

interface ReadinessDoc {
  date: string
  hrvMs?: number
  restingHrBpm?: number
  sleepHours?: number
  sleepQuality?: number
  subjectiveFeel?: "great" | "normal" | "bad"
}

interface Props {
  history: ReadinessDoc[]
}

function toSignals(doc: ReadinessDoc): ReadinessSignals {
  return {
    hrvMs: doc.hrvMs,
    restingHrBpm: doc.restingHrBpm,
    sleepHours: doc.sleepHours,
    sleepQuality: doc.sleepQuality,
    subjectiveFeel: doc.subjectiveFeel,
  }
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-")
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.`
}

export function ReadinessTrendChart({ history }: Props) {
  const { t } = useTranslation()

  const chartData = useMemo(() => {
    const entries: ReadinessHistoryEntry[] = history.map((d) => ({
      date: d.date,
      signals: toSignals(d),
    }))
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))

    const data: Array<{ date: string; score: number }> = []
    for (const entry of sorted) {
      const baseline = computeBaseline(sorted, entry.date)
      const score = computeReadinessScore(entry.signals, baseline)
      if (score !== null) data.push({ date: formatDate(entry.date), score: score.total })
    }
    return data
  }, [history])

  if (chartData.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("charts.needReadiness2")}</p>
      </div>
    )
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
            domain={[0, 100]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          {/* Orientační prahy pásem */}
          <ReferenceLine y={40} stroke="hsl(var(--border))" strokeDasharray="2 2" />
          <ReferenceLine y={80} stroke="hsl(var(--border))" strokeDasharray="2 2" />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload[0]) return null
              return (
                <div className="bg-card border border-border rounded p-2 shadow-lg">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-xs text-primary">{t("readiness.title")}: {payload[0].value}</p>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--primary))" }}
            name="readiness"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
