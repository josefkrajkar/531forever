"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Lift, getLiftDisplayName, calibrateStartTM, DEFAULT_SPLIT, SupplementalTemplate } from "@/lib/531"
import TemplateSelector from "./template-selector"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { usePreferredUnit } from "@/hooks/use-preferred-unit"
import { GlossaryTerm } from "@/components/glossary-term"

interface CalibrationFlowProps {
  onComplete: () => void
}

type CalibrationStep = "template" | "lifts"

const LIFT_ORDER: Lift[] = DEFAULT_SPLIT

export default function CalibrationFlow({ onComplete }: CalibrationFlowProps) {
  const { t } = useTranslation()
  const program = useQuery(api.programs.getCalibratingProgram)
  const saveCalibrationSet = useMutation(api.programs.saveCalibrationSet)
  const activateProgram = useMutation(api.programs.activateProgram)
  const setSupplementalTemplate = useMutation(api.programs.setSupplementalTemplate)

  const [step, setStep] = useState<CalibrationStep>("template")
  const [selectedTemplate, setSelectedTemplate] = useState<SupplementalTemplate>("bbb")
  const [currentLiftIndex, setCurrentLiftIndex] = useState(0)
  const [weight, setWeight] = useState("")
  const [reps, setReps] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Calculate which lifts are already calibrated
  const calibratedLifts = program?.calibration
    ? (Object.keys(program.calibration) as Lift[]).filter(
        (k) => program.calibration?.[k]?.weight
      )
    : []

  // Skip to first uncalibrated lift
  const currentLift = LIFT_ORDER[currentLiftIndex]
  const isLastLift = currentLiftIndex === LIFT_ORDER.length - 1
  
  // Check if all lifts before current are calibrated (to know if we can finish)
  const allPreviousCalibrated = LIFT_ORDER.slice(0, currentLiftIndex).every(
    (lift) => calibratedLifts.includes(lift)
  )
  const canFinish = isLastLift || (allPreviousCalibrated && calibratedLifts.length === LIFT_ORDER.length - 1)

  const { toDisplay, fromDisplay, label: unitLabel } = usePreferredUnit()

  // Show preview of TM that will be calculated
  // weight state je v preferované jednotce; pro výpočet konvertujeme na kg
  const weightNum = parseFloat(weight) || 0
  const repsNum = parseInt(reps) || 0
  const weightNumKg = weightNum > 0 ? fromDisplay(weightNum) : 0
  const previewTMkg = weightNumKg > 0 && repsNum > 0
    ? calibrateStartTM({ weight: weightNumKg, reps: repsNum })
    : null
  const previewTM = previewTMkg !== null ? toDisplay(previewTMkg) : null

  // Handle clicking on already calibrated lift to edit it
  const handleEditLift = (lift: Lift) => {
    const liftIndex = LIFT_ORDER.indexOf(lift)
    const cal = program?.calibration?.[lift]
    
    setCurrentLiftIndex(liftIndex)
    
    // Pre-fill with existing values (DB je v kg, zobrazíme v preferované jednotce)
    if (cal) {
      setWeight(toDisplay(cal.weight).toString())
      setReps(cal.reps.toString())
    }
    
    setError("")
    console.log("[calibration] Editing lift:", lift)
  }

  const handleSaveSet = async () => {
    const wDisplay = parseFloat(weight)
    const r = parseInt(reps)

    if (!wDisplay || wDisplay <= 0) {
      setError(t("calibration.errorWeight"))
      return
    }
    if (!r || r <= 0) {
      setError(t("calibration.errorReps"))
      return
    }

    // Konverze na kg pro uložení
    const wKg = fromDisplay(wDisplay)

    setError("")
    setSaving(true)

    try {
      await saveCalibrationSet({
        lift: currentLift,
        weight: wKg,
        reps: r,
      })

      console.log("[calibration] Saved", currentLift, wKg, "kg x", r)

      // Build the definitive calibrated-lifts set synchronously:
      // don't wait for the query to refetch — treat the just-saved lift as
      // calibrated immediately so navigation is deterministic regardless of
      // refetch timing.
      const calibratedAfterSave = calibratedLifts.includes(currentLift)
        ? new Set(calibratedLifts)
        : new Set([...calibratedLifts, currentLift])

      if (calibratedAfterSave.size === LIFT_ORDER.length) {
        // All lifts calibrated — activate program
        await activateProgram({})
        console.log("[calibration] Program activated!")
        onComplete()
      } else {
        // Find next uncalibrated lift (after current index)
        const nextUncalibrated = LIFT_ORDER.findIndex(
          (lift, i) => i > currentLiftIndex && !calibratedAfterSave.has(lift)
        )

        if (nextUncalibrated !== -1) {
          // Move to next uncalibrated lift
          setCurrentLiftIndex(nextUncalibrated)
        } else {
          // Wrap around — find first uncalibrated from start
          const firstUncalibrated = LIFT_ORDER.findIndex(
            (lift) => !calibratedAfterSave.has(lift)
          )
          if (firstUncalibrated !== -1) {
            setCurrentLiftIndex(firstUncalibrated)
          }
        }

        setWeight("")
        setReps("")
      }
    } catch (err) {
      console.error("[calibration] Error:", err)
      setError(t("calibration.errorSave"))
    } finally {
      setSaving(false)
    }
  }

  if (!program) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-muted-foreground text-xs uppercase tracking-widest animate-pulse">
          {t("app.loading")}
        </div>
      </div>
    )
  }

  // Template selection step
  if (step === "template") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="font-heading font-extrabold uppercase tracking-widest text-xl mb-2">
            5/3/1 Forever
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("calibration.templateSubtitle")}
          </p>
        </div>

        {/* Template selector */}
        <TemplateSelector
          selectedTemplate={selectedTemplate}
          onSelect={async (template) => {
            setSelectedTemplate(template)
            try {
              await setSupplementalTemplate({ template })
              console.log("[calibration] Template set:", template)
            } catch (err) {
              console.error("[calibration] Error setting template:", err)
            }
          }}
          mode="selection"
        />

        {/* Program structure info */}
        <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold">{t("template.howItWorks")}</h4>
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="flex gap-3">
              <span className="text-primary font-bold"><GlossaryTerm term="leader">Leader</GlossaryTerm></span>
              <span>{t("template.leaderPhase")}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-orange-400 font-bold"><GlossaryTerm term="seventh_week">{t("program.phases.seventh_week")}</GlossaryTerm></span>
              <span>{t("template.seventhWeekProtocol")}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-primary font-bold"><GlossaryTerm term="leader">Leader</GlossaryTerm></span>
              <span>{t("template.leaderPhase2")}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-orange-400 font-bold"><GlossaryTerm term="seventh_week">{t("program.phases.seventh_week")}</GlossaryTerm></span>
              <span>{t("template.seventhWeekProtocol")}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-green-400 font-bold"><GlossaryTerm term="anchor">{t("program.phases.anchor")}</GlossaryTerm></span>
              <span>{t("template.anchorPhase")}</span>
            </div>
          </div>
        </div>

        {/* Continue button */}
        <button
          onClick={() => setStep("lifts")}
          className="w-full bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest py-4 text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {t("calibration.continueToCalibration")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  const getSubmitLabel = () => {
    if (saving) return t("calibration.savingLabel")
    const lastOrOnlyUncalibrated =
      calibratedLifts.length === LIFT_ORDER.length - 1 ||
      (calibratedLifts.length === LIFT_ORDER.length && calibratedLifts.includes(currentLift))
    if (lastOrOnlyUncalibrated) {
      return calibratedLifts.includes(currentLift)
        ? t("calibration.saveChangesAndFinish")
        : t("calibration.finishCalibration")
    }
    if (calibratedLifts.includes(currentLift)) return t("calibration.saveChanges")
    return t("calibration.saveAndContinue", {
      liftName: t(getLiftDisplayName(LIFT_ORDER[currentLiftIndex + 1])),
    })
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => setStep("template")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("calibration.backToTemplate")}
      </button>

      {/* Header */}
      <div className="text-center">
        <h2 className="font-heading font-extrabold uppercase tracking-widest text-xl mb-2">
          {t("calibration.title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("calibration.subtitle")}
        </p>
      </div>

      {/* Progress */}
      <div className="flex justify-center gap-2">
        {LIFT_ORDER.map((lift, i) => {
          const isCalibrated = calibratedLifts.includes(lift)
          const isCurrent = i === currentLiftIndex
          return (
            <div
              key={lift}
              className={`w-3 h-3 rounded-full transition-all ${
                isCalibrated
                  ? "bg-primary"
                  : isCurrent
                  ? "bg-primary/50 scale-125"
                  : "bg-border"
              }`}
            />
          )
        })}
      </div>

      {/* Current lift card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="text-center mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {t("calibration.liftNumber", {
              current: currentLiftIndex + 1,
              total: LIFT_ORDER.length,
            })}
          </p>
          <h3 className="font-heading font-bold uppercase tracking-wide text-2xl text-primary">
            {t(getLiftDisplayName(currentLift))}
          </h3>
        </div>

        {/* Instructions */}
        <div className="bg-secondary/50 rounded p-4 mb-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t(`calibration.tips.${currentLift}`)}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            <GlossaryTerm term="rpe">{t("calibration.rpeHint")}</GlossaryTerm>
          </p>
        </div>

        {/* Input form */}
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">
                {t("calibration.weightLabel")}
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={t("calibration.weightPlaceholder")}
                className="w-full bg-background border border-border rounded px-4 py-3 text-lg font-heading font-bold focus:border-primary focus:outline-none transition-colors"
                min="0"
                step={unitLabel === "lb" ? "5" : "2.5"}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">
                {t("calibration.repsLabel")}
              </label>
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder={t("calibration.repsPlaceholder")}
                className="w-full bg-background border border-border rounded px-4 py-3 text-lg font-heading font-bold focus:border-primary focus:outline-none transition-colors"
                min="1"
                step="1"
              />
            </div>
          </div>

          {/* TM Preview */}
          {previewTM && (
            <div className="bg-primary/10 border border-primary/30 rounded p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                {t("calibration.startingTM")}
              </p>
              <p className="font-heading font-extrabold text-3xl text-primary">
                {previewTM} {unitLabel}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {t("calibration.conservativeStart")}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          {/* Submit button */}
          <button
            onClick={handleSaveSet}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest py-4 text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {getSubmitLabel()}
          </button>
        </div>
      </div>

      {/* Already calibrated lifts */}
      {calibratedLifts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {t("calibration.alreadyCalibrated")}{" "}
            <span className="text-muted-foreground/50">{t("calibration.editHint")}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {calibratedLifts.map((lift) => {
              const cal = program.calibration?.[lift]
              if (!cal) return null
              const tmKg = calibrateStartTM({ weight: cal.weight, reps: cal.reps })
              const isEditing = LIFT_ORDER[currentLiftIndex] === lift
              return (
                <button
                  key={lift}
                  onClick={() => handleEditLift(lift)}
                  disabled={isEditing}
                  className={`rounded px-3 py-2 flex justify-between items-center transition-all text-left ${
                    isEditing
                      ? "bg-primary/20 border border-primary/50 cursor-default"
                      : "bg-secondary hover:bg-secondary/80 hover:border-primary/30 border border-transparent active:scale-[0.98]"
                  }`}
                >
                  <span className="text-sm">{t(getLiftDisplayName(lift))}</span>
                  <span className="font-heading font-bold text-primary">{toDisplay(tmKg)} {unitLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Info about the program */}
      <div className="text-center text-xs text-muted-foreground/50 space-y-1">
        <p>{t("calibration.programInfo", { template: selectedTemplate.toUpperCase() })}</p>
        <p>{t("program.fourDaysPerWeek")}</p>
      </div>
    </div>
  )
}
