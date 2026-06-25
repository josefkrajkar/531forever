"use client"

import { useTranslation } from "react-i18next"
import { SEVENTH_WEEK_PROTOCOLS, type SeventhWeekType } from "@/lib/templates"
import { FlaskConical, Battery } from "lucide-react"

interface SeventhWeekSelectorProps {
  selected: SeventhWeekType | null
  onSelect: (type: SeventhWeekType) => void
  disabled?: boolean
}

export default function SeventhWeekSelector({
  selected,
  onSelect,
  disabled = false,
}: SeventhWeekSelectorProps) {
  const { t } = useTranslation()
  const protocols = Object.values(SEVENTH_WEEK_PROTOCOLS)

  const getIcon = (id: SeventhWeekType) => {
    switch (id) {
      case "tm_test":
        return <FlaskConical className="w-6 h-6" />
      case "deload":
        return <Battery className="w-6 h-6" />
      default:
        return null
    }
  }

  const getTip = () => {
    if (selected === "tm_test") return t("seventhWeek.tipTmTest")
    if (selected === "deload") return t("seventhWeek.tipDeload")
    return t("seventhWeek.tipDefault")
  }

  return (
    <div className="space-y-3">
      <div className="text-center mb-4">
        <h3 className="font-heading font-bold uppercase tracking-widest text-lg">
          {t("seventhWeek.title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("seventhWeek.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {protocols.map((protocol) => {
          const isSelected = selected === protocol.id
          return (
            <button
              key={protocol.id}
              onClick={() => onSelect(protocol.id)}
              disabled={disabled}
              className={`
                p-4 rounded-lg border-2 text-left transition-all
                ${isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 bg-card"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`
                  p-2 rounded-lg
                  ${isSelected ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}
                `}>
                  {getIcon(protocol.id)}
                </div>
                <div className="flex-1">
                  <h4 className="font-heading font-bold text-base">
                    {t(protocol.name)}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(protocol.description)}
                  </p>
                </div>
              </div>

              {/* Sets preview */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                  {t("seventhWeek.sets")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {protocol.sets.map((set, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-secondary px-2 py-1 rounded"
                    >
                      {Math.round(set.percent * 100)}% × {set.reps}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Recommendation */}
      <div className="bg-secondary/50 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground">
          <span className="text-primary font-medium">{t("seventhWeek.tip")}</span>{" "}
          {getTip()}
        </p>
      </div>
    </div>
  )
}

// Compact badge for displaying current 7th week type
export function SeventhWeekBadge({ type }: { type: SeventhWeekType }) {
  const { t } = useTranslation()
  const protocol = SEVENTH_WEEK_PROTOCOLS[type]
  const Icon = type === "tm_test" ? FlaskConical : Battery

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium">{t(protocol.name)}</span>
    </div>
  )
}
