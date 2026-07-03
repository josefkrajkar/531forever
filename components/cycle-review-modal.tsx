"use client"

import { useTranslation } from "react-i18next"
import { Lift, getLiftDisplayName, DEFAULT_SPLIT } from "@/lib/531"
import type { CycleProgressionSummary } from "@/lib/531"
import { usePreferredUnit } from "@/hooks/use-preferred-unit"

interface Props {
  progressionSummary: CycleProgressionSummary
  onClose: () => void
}

/**
 * CycleReviewModal — read-only přehled dokončeného cyklu.
 *
 * TM progrese byla aplikována server-side v completeWorkout (atomicky se posunem pozice).
 * Modal pouze zobrazuje výsledek — nevolá žádnou mutaci.
 */
export default function CycleReviewModal({ progressionSummary, onClose }: Props) {
  const { t } = useTranslation()
  const { toDisplay, label: unitLabel } = usePreferredUnit()
  const { completedCycle, lifts } = progressionSummary

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full my-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📊</div>
          <h2 className="font-heading font-extrabold uppercase tracking-widest text-xl">
            {t("cycleReview.title", { cycle: completedCycle })}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {t("cycleReview.tmAutoSet")}
          </p>
        </div>

        {/* TM Progression Results */}
        <div className="mb-6">
          <h3 className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
            {t("cycleReview.newTrainingMaxes")}
          </h3>
          <div className="space-y-2">
            {DEFAULT_SPLIT.map((lift: Lift) => {
              const summary = lifts.find((l) => l.lift === lift)
              if (!summary) return null

              const actionBadge = {
                PROGRESS: { text: "↑", color: "bg-green-500/20 text-green-400" },
                HOLD: { text: "=", color: "bg-yellow-500/20 text-yellow-400" },
                RESET: { text: "↓", color: "bg-red-500/20 text-red-400" },
              }[summary.action]

              const reasonText = (() => {
                switch (summary.reason) {
                  case "standard":
                    return summary.reps !== undefined
                      ? t("cycleReview.reasons.standard", { reps: summary.reps })
                      : t("cycleReview.reasons.standardNoReps")
                  case "no_clean_signal":
                    return t("cycleReview.reasons.no_clean_signal")
                  case "first_miss":
                    return t("cycleReview.reasons.first_miss", { reps: summary.reps ?? 0 })
                  case "repeated_miss":
                    return t("cycleReview.reasons.repeated_miss")
                  case "e1rm_stall":
                    return t("cycleReview.reasons.e1rm_stall")
                  default:
                    return ""
                }
              })()

              return (
                <div
                  key={lift}
                  className="flex justify-between items-center py-2 px-3 bg-secondary/50 rounded"
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${actionBadge.color}`}>
                      {actionBadge.text}
                    </span>
                    <div>
                      <span className="text-sm font-medium">{t(getLiftDisplayName(lift))}</span>
                      <p className="text-xs text-muted-foreground">
                        {reasonText}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground text-sm">{toDisplay(summary.oldTM)} {unitLabel}</span>
                    <span className="text-muted-foreground mx-2">→</span>
                    <span
                      className={`font-heading font-bold ${
                        summary.change > 0
                          ? "text-green-400"
                          : summary.change < 0
                            ? "text-red-400"
                            : "text-yellow-400"
                      }`}
                    >
                      {toDisplay(summary.newTM)} {unitLabel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Action */}
        <button
          onClick={onClose}
          className="w-full bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest py-3 text-sm hover:opacity-90 rounded"
        >
          {t("cycleReview.continueBtn")}
        </button>
      </div>
    </div>
  )
}
