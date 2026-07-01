"use client"

import { Settings } from "lucide-react"
import { useTranslation } from "react-i18next"
import AccessoryTracker from "@/components/accessory-tracker"
import { type AccessorySetLog } from "@/lib/531"

interface AccessorySectionProps {
  todayAccessories: string[]
  accessoryLogs: Record<string, AccessorySetLog[]>
  accessoriesSaved: boolean
  onOpenPicker: () => void
  onComplete: (logs: Array<{ accessoryId: string; sets: AccessorySetLog[] }>) => void
  onStartRestTimer?: (sec: number) => void
}

export default function AccessorySection({
  todayAccessories,
  accessoryLogs,
  accessoriesSaved,
  onOpenPicker,
  onComplete,
  onStartRestTimer,
}: AccessorySectionProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {t("accessorySection.title")}
          </p>
          <p className="text-sm text-muted-foreground">
            {todayAccessories.length > 0
              ? `${t("accessorySection.exerciseCount", { count: todayAccessories.length })} ${t("accessorySection.forToday")}`
              : t("accessorySection.noneSelected")}
          </p>
        </div>
        <button
          onClick={onOpenPicker}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded transition-colors"
        >
          <Settings className="h-4 w-4" />
          {todayAccessories.length > 0 ? t("accessorySection.editBtn") : t("accessorySection.selectBtn")}
        </button>
      </div>

      {/* Accessory tracker (if accessories selected) */}
      {todayAccessories.length > 0 && !accessoriesSaved && (
        <div className="pt-4 border-t border-border">
          <AccessoryTracker
            accessoryIds={todayAccessories}
            onComplete={onComplete}
            onStartRestTimer={onStartRestTimer}
          />
        </div>
      )}

      {/* Accessories saved confirmation */}
      {accessoriesSaved && (
        <div className="bg-green-500/10 border border-green-500/30 rounded p-3 text-center">
          <p className="text-sm text-green-400">
            {t("accessorySection.savedConfirm", { count: Object.keys(accessoryLogs).length })}
          </p>
        </div>
      )}

      {/* Empty state */}
      {todayAccessories.length === 0 && (
        <div className="text-center py-6 bg-secondary/30 rounded">
          <p className="text-sm text-muted-foreground">
            {t("accessorySection.emptyHint")}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t("accessorySection.emptyNote")}
          </p>
        </div>
      )}
    </div>
  )
}
