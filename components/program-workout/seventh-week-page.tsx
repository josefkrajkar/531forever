"use client"

import { useTranslation } from "react-i18next"
import { type SeventhWeekType } from "@/lib/531"
import { PhaseBadge } from "@/components/template-selector"
import SeventhWeekSelector from "@/components/seventh-week-selector"
import ResetConfirmDialog from "./reset-confirm-dialog"

interface SeventhWeekPageProps {
  programPhase: string
  macrocycleNumber: number | undefined
  selectedSeventhWeekType: SeventhWeekType | null
  savingSeventhWeekType: boolean
  showResetConfirm: boolean
  onSeventhWeekTypeSelect: (type: SeventhWeekType) => void
  onShowResetConfirm: () => void
  onCloseResetConfirm: () => void
  onResetProgram: () => void
}

export default function SeventhWeekPage({
  programPhase,
  macrocycleNumber,
  selectedSeventhWeekType,
  savingSeventhWeekType,
  showResetConfirm,
  onSeventhWeekTypeSelect,
  onShowResetConfirm,
  onCloseResetConfirm,
  onResetProgram,
}: SeventhWeekPageProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      {/* Forever phase indicator */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PhaseBadge
              phase={programPhase}
              phaseWeek={1}
              phaseWeekLimit={1}
            />
            <div>
              <p className="text-sm font-medium">{t("seventhWeek.title")}</p>
              <p className="text-xs text-muted-foreground">
                {t("workout.macrocycle", { number: macrocycleNumber || 1 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <SeventhWeekSelector
          selected={selectedSeventhWeekType}
          onSelect={onSeventhWeekTypeSelect}
          disabled={savingSeventhWeekType}
        />
      </div>

      {/* Reset program link */}
      <button
        onClick={onShowResetConfirm}
        className="w-full text-center text-xs text-muted-foreground/50 hover:text-muted-foreground uppercase tracking-widest py-2 transition-colors"
      >
        {t("program.reset")}
      </button>

      <ResetConfirmDialog
        open={showResetConfirm}
        onClose={onCloseResetConfirm}
        onConfirm={onResetProgram}
      />
    </div>
  )
}
