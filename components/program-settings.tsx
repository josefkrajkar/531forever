"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import { roundToPlate } from "@/lib/531"
import { TEMPLATES } from "@/lib/templates"
import type { SupplementalTemplate } from "@/lib/templates"
import { Doc } from "@/convex/_generated/dataModel"
import TemplateSelector from "./template-selector"

type Program = Doc<"programs">
type Lift = "squat" | "bench" | "deadlift" | "press"

// ─── Trend pomocí posledních e1RM hodnot ─────────────────────────────────────

function e1rmTrend(history: number[]): "up" | "flat" | "down" | null {
  if (history.length < 2) return null
  const last = history[history.length - 1]
  const prev = history[history.length - 2]
  if (last > prev) return "up"
  if (last < prev) return "down"
  return "flat"
}

function TrendIcon({ trend }: { trend: "up" | "flat" | "down" | null }) {
  if (!trend) return null
  const map = { up: "↗", flat: "→", down: "↘" }
  const color = { up: "text-green-400", flat: "text-muted-foreground", down: "text-red-400" }
  return (
    <span className={`text-base leading-none ${color[trend]}`} aria-label={trend}>
      {map[trend]}
    </span>
  )
}

// ─── Stagnační indikátor ──────────────────────────────────────────────────────

function MissesIndicator({ misses }: { misses: number }) {
  const { t } = useTranslation()
  if (misses === 0) return null
  if (misses === 1) {
    return (
      <p className="text-xs text-yellow-400 mt-1">
        {t("settings.missesOne")}
      </p>
    )
  }
  return (
    <p className="text-xs text-red-400 font-medium mt-1">
      {t("settings.missesMany")}
    </p>
  )
}

// ─── Inline editor pro jeden lift ────────────────────────────────────────────

interface TMEditorProps {
  lift: Lift
  currentTM: number
  rounding: number
  onSave: (lift: Lift, newTM: number) => Promise<void>
  onCancel: () => void
}

function TMEditor({ lift, currentTM, rounding, onSave, onCancel }: TMEditorProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState<string>(String(currentTM))
  const [saving, setSaving] = useState(false)

  const parsed = parseFloat(value)
  const isValid = Number.isFinite(parsed) && parsed >= 20 && parsed <= 1000
  const preview = isValid ? roundToPlate(parsed, rounding) : null

  const quick = [
    { label: "−10 %", factor: 0.9 },
    { label: "−5 %", factor: 0.95 },
  ]

  const handleSave = async () => {
    if (!isValid || preview === null) return
    setSaving(true)
    try {
      await onSave(lift, preview)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
      {/* Rychlé volby */}
      <div className="flex gap-2 flex-wrap">
        {quick.map(({ label, factor }) => {
          const quickVal = roundToPlate(currentTM * factor, rounding)
          return (
            <button
              key={label}
              type="button"
              onClick={() => setValue(String(quickVal))}
              className="text-xs bg-secondary hover:bg-secondary/80 border border-border rounded px-3 py-1.5 transition-colors"
            >
              {label} → {quickVal} kg
            </button>
          )
        })}
      </div>

      {/* Vlastní hodnota */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={rounding}
          min={20}
          max={1000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 bg-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label={t("settings.newTM")}
        />
        <span className="text-xs text-muted-foreground">kg</span>
        {preview !== null && preview !== parsed && (
          <span className="text-xs text-muted-foreground">
            {t("settings.roundedTo")} <strong>{preview} kg</strong>
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground/70">
        {t("settings.changesFromNext")}
      </p>

      {/* Tlačítka */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || saving}
          className={`px-4 py-2 text-xs font-heading font-bold uppercase tracking-widest rounded transition-all ${
            isValid && !saving
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
          style={{ minHeight: "44px" }}
        >
          {saving ? t("settings.saveBtn") : t("settings.confirmBtn")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-xs font-heading font-bold uppercase tracking-widest rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
          style={{ minHeight: "44px" }}
        >
          {t("settings.cancelBtn")}
        </button>
      </div>
    </div>
  )
}

// ─── Karta jednoho liftu ──────────────────────────────────────────────────────

interface LiftCardProps {
  lift: Lift
  currentTM: number
  misses: number
  e1rmHistory: number[]
  rounding: number
  onSave: (lift: Lift, newTM: number) => Promise<void>
}

function LiftCard({ lift, currentTM, misses, e1rmHistory, rounding, onSave }: LiftCardProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const trend = e1rmTrend(e1rmHistory)

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold uppercase tracking-wider text-sm">
            {t(`lifts.${lift}`)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-bold font-heading">{currentTM} kg</span>
            <TrendIcon trend={trend} />
          </div>
          <MissesIndicator misses={misses} />
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 text-xs font-heading font-bold uppercase tracking-widest border border-border rounded px-3 py-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            style={{ minHeight: "44px" }}
          >
            {t("settings.editBtn")}
          </button>
        )}
      </div>

      {editing && (
        <TMEditor
          lift={lift}
          currentTM={currentTM}
          rounding={rounding}
          onSave={async (l, v) => {
            await onSave(l, v)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  )
}

// ─── Sekce šablony ────────────────────────────────────────────────────────────

function TemplateSection({
  currentTemplate,
  phase,
}: {
  currentTemplate: SupplementalTemplate
  phase: string | null | undefined
}) {
  const { t } = useTranslation()
  const [showSelector, setShowSelector] = useState(false)
  const config = TEMPLATES[currentTemplate]

  const isLeaderPhase = phase === "leader1" || phase === "leader2"
  const isAnchorPhase = phase === "anchor"

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {t("template.supplementalLabel")}
          </p>
          <p className="font-heading font-bold uppercase tracking-wider text-sm">
            {t(config.name)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{t(config.shortDescription)}</p>
        </div>
        {!showSelector && (
          <button
            type="button"
            onClick={() => setShowSelector(true)}
            className="shrink-0 text-xs font-heading font-bold uppercase tracking-widest border border-border rounded px-3 py-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            style={{ minHeight: "44px" }}
          >
            {t("settings.changeBtn")}
          </button>
        )}
      </div>

      {/* Doporučení Forever */}
      {(isLeaderPhase || isAnchorPhase) && (
        <p className="text-xs text-muted-foreground/70 border-l-2 border-primary/30 pl-2">
          {isLeaderPhase
            ? t("settings.leaderRecommendation")
            : t("settings.anchorRecommendation")}
        </p>
      )}

      {showSelector && (
        <div className="mt-2">
          <TemplateSelector
            selectedTemplate={currentTemplate}
            onSelect={() => setShowSelector(false)}
            mode="selection"
          />
          <button
            type="button"
            onClick={() => setShowSelector(false)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors"
          >
            {t("settings.closeBtn")}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sekce pauzy ─────────────────────────────────────────────────────────────

function PauseSection({ onPause }: { onPause: () => Promise<void> }) {
  const { t } = useTranslation()
  const [pausing, setPausing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handlePause = async () => {
    setPausing(true)
    try {
      await onPause()
    } finally {
      setPausing(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
        {t("settings.programStatus")}
      </p>

      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="text-xs font-heading font-bold uppercase tracking-widest border border-border rounded px-4 py-2 text-muted-foreground hover:text-foreground hover:border-yellow-500/50 transition-colors"
          style={{ minHeight: "44px" }}
        >
          {t("settings.pauseProgram")}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t("settings.pauseConfirm")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePause}
              disabled={pausing}
              className="text-xs font-heading font-bold uppercase tracking-widest border border-yellow-500/50 rounded px-4 py-2 text-yellow-400 hover:bg-yellow-500/10 transition-colors disabled:opacity-50"
              style={{ minHeight: "44px" }}
            >
              {pausing ? t("settings.pausingLabel") : t("settings.pauseConfirmBtn")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={pausing}
              className="text-xs font-heading font-bold uppercase tracking-widest border border-border rounded px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              style={{ minHeight: "44px" }}
            >
              {t("settings.cancelBtn")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Hlavní komponenta ────────────────────────────────────────────────────────

interface ProgramSettingsProps {
  program: Program
}

export default function ProgramSettings({ program }: ProgramSettingsProps) {
  const { t } = useTranslation()
  const setTrainingMax = useMutation(api.programs.setTrainingMax)
  const pauseProgram = useMutation(api.programs.pauseProgram)

  const lifts = (program.split as Lift[]).filter((l): l is Lift =>
    ["squat", "bench", "deadlift", "press"].includes(l)
  )

  const misses = (program.misses ?? { squat: 0, bench: 0, deadlift: 0, press: 0 }) as Record<Lift, number>
  const e1rmHistory = (program.e1rmHistory ?? { squat: [], bench: [], deadlift: [], press: [] }) as Record<Lift, number[]>

  const handleSaveTM = async (lift: Lift, newTM: number) => {
    try {
      await setTrainingMax({ lift, newTM })
      toast.success(t("settings.tmSavedSuccess", { liftName: t(`lifts.${lift}`), value: newTM }))
    } catch (err) {
      console.error("[program-settings] setTrainingMax error:", err)
      toast.error(t("settings.tmSaveFailed"))
    }
  }

  const handlePause = async () => {
    try {
      await pauseProgram({})
      toast.success(t("settings.pauseSuccess"))
    } catch (err) {
      console.error("[program-settings] pauseProgram error:", err)
      toast.error(t("settings.pauseFailed"))
    }
  }

  const isForeverProgram = !!(program.programPhase && program.supplementalTemplate)

  return (
    <section className="space-y-4 mt-6" aria-label={t("settings.programSettings")}>
      <h2 className="font-heading font-extrabold uppercase tracking-widest text-sm text-muted-foreground">
        {t("settings.programSettings")}
      </h2>

      {/* Training Maxy */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          {t("settings.trainingMaxes")}
        </p>
        {lifts.map((lift) => {
          const currentTM = (program.trainingMaxes[lift] as number | undefined) ?? 0
          return (
            <LiftCard
              key={lift}
              lift={lift}
              currentTM={currentTM}
              misses={misses[lift] ?? 0}
              e1rmHistory={e1rmHistory[lift] ?? []}
              rounding={program.rounding}
              onSave={handleSaveTM}
            />
          )
        })}
      </div>

      {/* Supplemental šablona — jen pro Forever programy */}
      {isForeverProgram && program.supplementalTemplate && (
        <TemplateSection
          currentTemplate={program.supplementalTemplate as SupplementalTemplate}
          phase={program.programPhase}
        />
      )}

      {/* Pauza */}
      <PauseSection onPause={handlePause} />
    </section>
  )
}
