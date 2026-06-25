"use client"

/**
 * readiness-card.tsx — ranní readiness check (Plán tab).
 *
 * Zobrazí dnešní readiness skóre (z lib/readiness deterministicky) + 5/3/1-native
 * doporučení. Doporučení je vždy NÁVRH — nikdy nemodifikuje TM ani plán a NIKDY
 * nedoporučuje snižovat předepsanou váhu (doktrína 5/3/1: váhy jsou posvátné,
 * flexuje se jen úsilí na + sérii). Opt-in, nenápadné.
 */

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Activity } from "lucide-react"
import {
  computeReadinessScore,
  computeBaseline,
  type ReadinessBand,
  type ReadinessRecommendation,
  type ReadinessSignals,
  type ReadinessHistoryEntry,
} from "@/lib/readiness"
import ReadinessManualInput from "./readiness-manual-input"

/** Záznam readiness z Convexu (subset doc) */
interface ReadinessDoc {
  date: string
  hrvMs?: number
  restingHrBpm?: number
  sleepHours?: number
  sleepQuality?: number
  subjectiveFeel?: "great" | "normal" | "bad"
}

const BAND_COLORS: Record<ReadinessBand, { color: string; bar: string }> = {
  high: { color: "text-emerald-400", bar: "bg-emerald-500" },
  good: { color: "text-primary", bar: "bg-primary" },
  moderate: { color: "text-amber-400", bar: "bg-amber-500" },
  low: { color: "text-destructive", bar: "bg-destructive" },
}

/** Mapuje Convex doc na čisté ReadinessSignals pro lib */
function toSignals(doc: ReadinessDoc): ReadinessSignals {
  return {
    hrvMs: doc.hrvMs,
    restingHrBpm: doc.restingHrBpm,
    sleepHours: doc.sleepHours,
    sleepQuality: doc.sleepQuality,
    subjectiveFeel: doc.subjectiveFeel,
  }
}

export default function ReadinessCard() {
  const { t } = useTranslation()
  const [inputOpen, setInputOpen] = useState(false)
  // Dnešní datum z klienta (komponenta je client-only pod AuthWrapper)
  const today = useMemo(() => new Date().toISOString().split("T")[0], [])

  const todayDoc = useQuery(api.readiness.getReadinessForDate, { date: today }) as
    | ReadinessDoc
    | null
    | undefined
  const history = useQuery(api.readiness.getReadinessHistory) as ReadinessDoc[] | undefined

  const loading = todayDoc === undefined || history === undefined

  const score = (() => {
    if (loading || !todayDoc) return null
    const entries: ReadinessHistoryEntry[] = (history ?? []).map((d) => ({
      date: d.date,
      signals: toSignals(d),
    }))
    const baseline = computeBaseline(entries, today)
    return computeReadinessScore(toSignals(todayDoc), baseline)
  })()

  return (
    <div className="bg-card border border-border rounded-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-bold uppercase tracking-widest text-sm">{t("readiness.title")}</h3>
        </div>
        <button
          onClick={() => setInputOpen(true)}
          className="text-xs font-heading font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:border-primary hover:text-primary transition-colors"
          style={{ minHeight: "36px" }}
        >
          {todayDoc ? t("readiness.editBtn") : t("readiness.enterBtn")}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground animate-pulse py-3">{t("readiness.loading")}</p>
      ) : score === null ? (
        <p className="text-sm text-muted-foreground leading-relaxed py-1">
          {t("readiness.noDataHint")}
        </p>
      ) : (
        <div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className={`font-heading font-extrabold text-4xl leading-none ${BAND_COLORS[score.band].color}`}>
              {score.total}
            </span>
            <span className={`font-heading font-bold uppercase tracking-widest text-xs ${BAND_COLORS[score.band].color}`}>
              {t(`readiness.bands.${score.band}`)}
            </span>
          </div>
          {/* Lišta skóre */}
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mb-3">
            <div
              className={`h-full ${BAND_COLORS[score.band].bar} transition-all`}
              style={{ width: `${score.total}%` }}
            />
          </div>
          <p className="text-sm text-foreground leading-relaxed mb-2">
            {t(`readiness.recommendations.${score.recommendation}`)}
          </p>
          <p className="text-xs text-muted-foreground/60 leading-relaxed">
            {t("readiness.disclaimer")}
          </p>
        </div>
      )}

      {inputOpen && (
        <ReadinessManualInput
          date={today}
          initial={todayDoc ?? undefined}
          onClose={() => setInputOpen(false)}
        />
      )}
    </div>
  )
}
