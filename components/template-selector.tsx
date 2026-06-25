"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { TEMPLATES, SupplementalTemplate } from "@/lib/templates"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Dumbbell, Target, Zap, Weight } from "lucide-react"

interface Props {
  selectedTemplate?: SupplementalTemplate
  onSelect?: (template: SupplementalTemplate) => void
  mode?: "selection" | "display"  // selection = clickable cards, display = readonly
}

const TEMPLATE_ICONS: Record<SupplementalTemplate, typeof Dumbbell> = {
  bbb: Dumbbell,    // Hypertrophy
  fsl: Target,      // Precision/technique
  ssl: Zap,         // Intensity
  bbs: Weight,      // Strength + volume
}

const TEMPLATE_COLORS: Record<SupplementalTemplate, string> = {
  bbb: "bg-primary/20 border-primary/30 hover:border-primary/50",
  fsl: "bg-blue-500/20 border-blue-500/30 hover:border-blue-500/50",
  ssl: "bg-orange-500/20 border-orange-500/30 hover:border-orange-500/50",
  bbs: "bg-purple-500/20 border-purple-500/30 hover:border-purple-500/50",
}

const TEMPLATE_BADGE_COLORS: Record<SupplementalTemplate, string> = {
  bbb: "bg-primary/30 text-primary-foreground",
  fsl: "bg-blue-500/30 text-blue-100",
  ssl: "bg-orange-500/30 text-orange-100",
  bbs: "bg-purple-500/30 text-purple-100",
}

export default function TemplateSelector({ selectedTemplate, onSelect, mode = "selection" }: Props) {
  const { t } = useTranslation()
  const setTemplate = useMutation(api.programs.setSupplementalTemplate)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleSelect = async (template: SupplementalTemplate) => {
    if (mode === "display") return
    if (template === selectedTemplate) return

    setIsUpdating(true)
    try {
      await setTemplate({ template })
      onSelect?.(template)
      console.log("[template-selector] Selected template:", template)
    } catch (err) {
      console.error("[template-selector] Error selecting template:", err)
    } finally {
      setIsUpdating(false)
    }
  }

  const templates = Object.entries(TEMPLATES) as [SupplementalTemplate, typeof TEMPLATES.bbb][]

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-1">{t("template.selectTitle")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("template.selectSubtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map(([id, config]) => {
          const Icon = TEMPLATE_ICONS[id]
          const isSelected = selectedTemplate === id
          const isLeader = config.isLeaderTemplate
          const isAnchor = config.isAnchorTemplate

          return (
            <Card
              key={id}
              className={`cursor-pointer transition-all duration-200 ${
                TEMPLATE_COLORS[id]
              } ${
                isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
              } ${mode === "display" ? "cursor-default" : ""}`}
              onClick={() => handleSelect(id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <CardTitle className="text-base">{t(config.name)}</CardTitle>
                  </div>
                  {isSelected && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>
                <CardDescription className="text-xs">
                  {t(config.shortDescription)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  {t(config.description)}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {isLeader && (
                    <Badge variant="outline" className={TEMPLATE_BADGE_COLORS[id]}>
                      Leader
                    </Badge>
                  )}
                  {isAnchor && (
                    <Badge variant="outline" className={TEMPLATE_BADGE_COLORS[id]}>
                      Anchor
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {mode === "selection" && selectedTemplate && (
        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            {t("template.selected")} <strong>{t(TEMPLATES[selectedTemplate].name)}</strong>
          </p>
        </div>
      )}

      {isUpdating && (
        <div className="text-center text-sm text-muted-foreground">
          {t("template.saving")}
        </div>
      )}
    </div>
  )
}

// Compact version for display in workout header
export function TemplateDisplay({ template }: { template: SupplementalTemplate }) {
  const { t } = useTranslation()
  const config = TEMPLATES[template]
  const Icon = TEMPLATE_ICONS[template]

  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4" />
      <span>{t(config.name)}</span>
      <span className="text-muted-foreground">({t(config.shortDescription)})</span>
    </div>
  )
}

// Phase indicator badge
export function PhaseBadge({
  phase,
  phaseWeek,
  phaseWeekLimit
}: {
  phase: string
  phaseWeek: number
  phaseWeekLimit: number
}) {
  const { t } = useTranslation()

  const phaseColors: Record<string, string> = {
    leader1: "bg-blue-500/20 text-blue-200 border-blue-500/30",
    leader2: "bg-indigo-500/20 text-indigo-200 border-indigo-500/30",
    anchor: "bg-orange-500/20 text-orange-200 border-orange-500/30",
    seventh_week: "bg-green-500/20 text-green-200 border-green-500/30",
  }

  const knownPhases = ["leader1", "leader2", "anchor", "seventh_week"]
  const isSeventhWeek = phase === "seventh_week"
  const label = knownPhases.includes(phase)
    ? t(`program.phases.${phase}`)
    : phase

  return (
    <Badge
      variant="outline"
      className={`${phaseColors[phase] || "bg-muted"} font-medium`}
    >
      {label}
      {!isSeventhWeek && ` (${phaseWeek}/${phaseWeekLimit})`}
    </Badge>
  )
}
