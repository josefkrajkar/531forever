"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import PlateDisplay from "./plate-display"
import {
  REST_TIMER_MAIN_SET,
  REST_TIMER_AMRAP,
  REST_TIMER_BBB,
} from "@/hooks/use-rest-timer"
import { usePreferredUnit } from "@/hooks/use-preferred-unit"
import { GlossaryTerm } from "@/components/glossary-term"

interface MainSet {
  weight: number
  targetReps: number
  isAmrap?: boolean
  percentage: number
}

interface BbbSet {
  weight: number
  reps: number
}

interface TemplateConfig {
  name: string
  sets: number
  reps: number
  shortDescription?: string
}

interface MainLiftCardProps {
  liftDisplayName: string
  tm: number | undefined
  completedCount: number
  totalSets: number
  displayMainSets: MainSet[]
  displayBbbSets: BbbSet[]
  completedMainSets: boolean[]
  completedBbbSets: boolean[]
  amrapSetIndex: number
  amrapSet: MainSet | null
  amrapReps: string
  amrapSaved: boolean
  savingAmrap: boolean
  isSeventhWeek: boolean
  isTMTest: boolean | undefined
  activeTemplateConfig: TemplateConfig | null
  onToggleMainSet: (index: number) => void
  onToggleBbbSet: (index: number) => void
  onAmrapRepsChange: (reps: string) => void
  onSaveAmrap: () => void
  /** Volitelné: spustí rest timer s danou délkou (sekundy) */
  onStartRestTimer?: (sec: number) => void
}

export default function MainLiftCard({
  liftDisplayName,
  tm,
  completedCount,
  totalSets,
  displayMainSets,
  displayBbbSets,
  completedMainSets,
  completedBbbSets,
  amrapSetIndex,
  amrapSet,
  amrapReps,
  amrapSaved,
  savingAmrap,
  isSeventhWeek,
  isTMTest,
  activeTemplateConfig,
  onToggleMainSet,
  onToggleBbbSet,
  onAmrapRepsChange,
  onSaveAmrap,
  onStartRestTimer,
}: MainLiftCardProps) {
  const { t } = useTranslation()
  const { toDisplay, label } = usePreferredUnit()
  // Index rozbaleného plate-displayu u hlavních setů (null = vše sbaleno)
  const [expandedMainPlate, setExpandedMainPlate] = useState<number | null>(null)
  // Zda je rozbalen plate-display BBB setů (všechny BBB sety mají stejnou váhu)
  const [bbbPlateExpanded, setBbbPlateExpanded] = useState(false)

  // Wrapper: při zaškrtnutí série (přechod false→true) → krátká vibrace + start timeru
  // AMRAP set: timer se spustí až po uložení AMRAP (handleSaveAmrap), ne při zaškrtnutí
  const handleToggleMainSet = (idx: number) => {
    const wasCompleted = completedMainSets[idx]
    onToggleMainSet(idx)
    if (!wasCompleted) {
      // Série právě zaškrtnuta
      navigator.vibrate?.(50)
      const isAmrapSet = displayMainSets[idx]?.isAmrap
      if (!isAmrapSet) {
        onStartRestTimer?.(REST_TIMER_MAIN_SET)
      }
    }
  }

  const handleToggleBbbSet = (idx: number) => {
    const wasCompleted = completedBbbSets[idx]
    onToggleBbbSet(idx)
    if (!wasCompleted) {
      navigator.vibrate?.(50)
      onStartRestTimer?.(REST_TIMER_BBB)
    }
  }

  // Po uložení AMRAP spustíme 5-minutový timer (zadání: 300 s po uložení AMRAP)
  const handleSaveAmrap = () => {
    onSaveAmrap()
    onStartRestTimer?.(REST_TIMER_AMRAP)
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {t("workout.mainLift")}
          </p>
          <h2 className="font-heading font-extrabold uppercase tracking-wide text-2xl">
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(liftDisplayName + " powerlifting form")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              {liftDisplayName}
            </a>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">TM: {tm !== undefined ? toDisplay(tm) : "—"} {label}</p>
        </div>
        <div className="text-right bg-secondary rounded px-3 py-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">{t("workout.sets")}</p>
          <p className="font-heading font-bold text-xl">
            <span className="text-primary">{completedCount}</span>
            <span className="text-muted-foreground">/{totalSets}</span>
          </p>
        </div>
      </div>

      {/* Main sets */}
      <div className="space-y-2 mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          {isSeventhWeek && isTMTest
            ? <GlossaryTerm term="tm_test">{t("workout.tmTestSets")}</GlossaryTerm>
            : isSeventhWeek
              ? <GlossaryTerm term="deload">{t("workout.deloadSets")}</GlossaryTerm>
              : t("workout.workingSets")}
        </p>
        {displayMainSets.map((set, idx) => (
          <div key={idx} className="space-y-1">
            {/* div s role="button" místo <button> — uvnitř je interaktivní toggle kotoučů a <button> nesmí obsahovat interaktivní potomky */}
            <div
              role="button"
              tabIndex={0}
              aria-pressed={completedMainSets[idx]}
              onClick={() => handleToggleMainSet(idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handleToggleMainSet(idx)
                }
              }}
              className={`w-full flex items-center justify-between p-3 rounded border transition-all cursor-pointer select-none ${
                completedMainSets[idx]
                  ? "bg-primary/20 border-primary"
                  : "bg-background border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    completedMainSets[idx]
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {completedMainSets[idx] && "✓"}
                </div>
                <div className="text-left">
                  {/* Tap na váhu togglene plate display — velký touch target */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedMainPlate(expandedMainPlate === idx ? null : idx)
                    }}
                    className="font-heading font-bold text-lg hover:text-primary transition-colors touch-manipulation min-h-[44px] flex items-center"
                    aria-expanded={expandedMainPlate === idx}
                    aria-label={t("workout.expandPlates", { weight: set.weight })}
                  >
                    {toDisplay(set.weight)} {label} × {set.targetReps}
                    {set.isAmrap ? "+" : ""}
                    <span className="ml-1 text-xs text-muted-foreground/60">
                      {expandedMainPlate === idx ? "▲" : "▼"}
                    </span>
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {set.percentage}% <GlossaryTerm term="tm">TM</GlossaryTerm>
                    {set.isAmrap && <> · <GlossaryTerm term="amrap">AMRAP</GlossaryTerm></>}
                  </p>
                </div>
              </div>
              {set.isAmrap && (
                <span className="text-xs text-primary uppercase tracking-widest">{t("workout.amrapMax")}</span>
              )}
            </div>
            {/* Rozbalený plate display */}
            {expandedMainPlate === idx && (
              <div className="px-3 pb-2">
                <PlateDisplay weight={set.weight} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* AMRAP input (if applicable and set is completed) */}
      {amrapSet && completedMainSets[amrapSetIndex] && !amrapSaved && (
        <div className="bg-primary/10 border border-primary/30 rounded p-4 mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
            <GlossaryTerm term="amrap">{t("workout.amrapQuestion")}</GlossaryTerm>
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={amrapReps}
              onChange={(e) => onAmrapRepsChange(e.target.value)}
              placeholder={t("workout.amrapPlaceholder")}
              min="1"
              className="flex-1 bg-background border border-border rounded px-4 py-2 text-lg font-heading font-bold focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleSaveAmrap}
              disabled={!amrapReps || savingAmrap}
              className="bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest px-6 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {savingAmrap ? "..." : t("workout.saveAmrap")}
            </button>
          </div>
        </div>
      )}

      {/* AMRAP saved confirmation */}
      {amrapSaved && (
        <div className="bg-green-500/10 border border-green-500/30 rounded p-3 mb-4 text-center">
          <p className="text-sm text-green-400">{t("workout.amrapSaved", { reps: amrapReps })}</p>
        </div>
      )}

      {/* Supplemental sets (not on deload/7th week) */}
      {!isSeventhWeek && displayBbbSets.length > 0 && (
        <div className="space-y-2 mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {activeTemplateConfig
              ? `${t(activeTemplateConfig.name)} — ${activeTemplateConfig.sets}×${activeTemplateConfig.reps}`
              : "BBB (Boring But Big) — 5×10 @ 50%"}
          </p>
          <div className="flex gap-2 flex-wrap">
            {displayBbbSets.map((set, idx) => (
              <button
                key={idx}
                onClick={() => handleToggleBbbSet(idx)}
                className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center font-heading font-bold ${
                  completedBbbSets[idx]
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-transparent border-border hover:border-primary text-muted-foreground hover:text-foreground"
                }`}
                title={`${toDisplay(set.weight)} ${label} × ${set.reps}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          {/* Tap na váhu BBB togglene plate display */}
          <button
            type="button"
            onClick={() => setBbbPlateExpanded(!bbbPlateExpanded)}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors touch-manipulation text-left flex items-center gap-1"
            aria-expanded={bbbPlateExpanded}
            aria-label={t("workout.expandPlates", { weight: displayBbbSets[0]?.weight })}
          >
            {displayBbbSets[0] ? toDisplay(displayBbbSets[0].weight) : ""} {label} × {displayBbbSets[0]?.reps} {t("workout.repsSuffix")}
            <span className="text-[10px]">{bbbPlateExpanded ? "▲" : "▼"}</span>
          </button>
          {bbbPlateExpanded && displayBbbSets[0] && (
            <div className="pt-1">
              <PlateDisplay weight={displayBbbSets[0].weight} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
