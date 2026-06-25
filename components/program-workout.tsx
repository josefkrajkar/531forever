"use client"

import { useState, useEffect } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useTranslation } from "react-i18next"
import {
  buildDailyWorkoutForever,
  buildSeventhWeekWorkout,
  getWeekName,
  Lift,
  getPhaseName,
  getTemplateName,
  type ProgramPhase,
  type SupplementalTemplate,
} from "@/lib/531"
import { TEMPLATES } from "@/lib/templates"
import { Doc } from "@/convex/_generated/dataModel"
import CycleReviewModal from "./cycle-review-modal"
import AccessoryPicker from "./accessory-picker"
import { PhaseBadge } from "./template-selector"
import { SeventhWeekBadge } from "./seventh-week-selector"
import { FlaskConical } from "lucide-react"

// Sub-components
import ResetConfirmDialog from "./program-workout/reset-confirm-dialog"
import FinishConfirmDialog from "./program-workout/finish-confirm-dialog"
import UpgradeModal from "./program-workout/upgrade-modal"
import AutoregulationToggle from "./program-workout/autoregulation-toggle"
import SeventhWeekPage from "./program-workout/seventh-week-page"
import MainLiftCard from "./program-workout/main-lift-card"
import AccessorySection from "./program-workout/accessory-section"

// Hooks
import { useAmrap } from "./program-workout/use-amrap"
import { useAccessories } from "./program-workout/use-accessories"
import { useFinishWorkout } from "./program-workout/use-finish-workout"
import { useSeventhWeek } from "./program-workout/use-seventh-week"
import { useUpgrade } from "./program-workout/use-upgrade"
import { useRestTimer } from "@/hooks/use-rest-timer"
import { useWakeLock } from "@/hooks/use-wake-lock"
import RestTimerBar from "./program-workout/rest-timer-bar"

type Program = Doc<"programs">

interface Props {
  program: Program
  onResetProgram: () => void
}

export default function ProgramWorkout({ program, onResetProgram }: Props) {
  const { t } = useTranslation()
  const accessorySettings = useQuery(api.accessories.getAccessorySettings)

  // Completed-set tracking (must live here — reset via workoutKey effect)
  const [completedMainSets, setCompletedMainSets] = useState<boolean[]>([])
  const [completedBbbSets, setCompletedBbbSets] = useState<boolean[]>([])
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [autoregulated, setAutoregulated] = useState(false)
  const [deviationNote, setDeviationNote] = useState("")

  // Feature hooks
  const { amrapReps, amrapSaved, savingAmrap, setAmrapReps, resetAmrap, handleSaveAmrap } = useAmrap()
  const { showAccessoryPicker, accessoryLogs, accessoriesSaved, setShowAccessoryPicker, resetAccessories, handleAccessoryComplete } = useAccessories()
  const { showFinishConfirm, finishing, showCycleReview, progressionSummary, setShowFinishConfirm, setShowCycleReview, handleFinishWorkout } = useFinishWorkout()
  const { selectedSeventhWeekType, savingSeventhWeekType, handleSeventhWeekTypeSelect } = useSeventhWeek({ programSeventhWeekType: program.seventhWeekType })
  const { showUpgradeModal, selectedUpgradeTemplate, upgrading, setShowUpgradeModal, setSelectedUpgradeTemplate, handleUpgradeToForever } = useUpgrade()

  // Rest timer + wake lock
  const restTimer = useRestTimer()
  const wakeLock = useWakeLock()

  // Forever program metadata
  const isForeverProgram = !!(program.programPhase && program.supplementalTemplate)
  const phaseName = isForeverProgram ? t(getPhaseName(program.programPhase!)) : null
  const templateName = isForeverProgram ? t(getTemplateName(program.supplementalTemplate!)) : null
  const isSeventhWeek = isForeverProgram && program.programPhase === "seventh_week"
  const seventhWeekTypeSelected = isSeventhWeek && selectedSeventhWeekType !== null

  // Build 7th-week workout (null when not applicable)
  const seventhWeekWorkout =
    isSeventhWeek && seventhWeekTypeSelected
      ? buildSeventhWeekWorkout(
          program.trainingMaxes as Record<Lift, number | undefined>,
          program.split,
          program.dayIndex,
          selectedSeventhWeekType!,
          program.rounding
        )
      : null

  // Build the regular daily workout (Forever only — legacy buildDailyWorkout removed)
  const workout = isForeverProgram
    ? buildDailyWorkoutForever(
        program.trainingMaxes as Record<Lift, number | undefined>,
        program.split,
        program.week,
        program.cycle,
        program.dayIndex,
        program.programPhase as ProgramPhase,
        program.phaseWeek || program.week,
        program.supplementalTemplate as SupplementalTemplate,
        program.rounding
      )
    : null

  // Derive display sets before early returns (Rules of Hooks)
  const displayMainSets = seventhWeekWorkout ? seventhWeekWorkout.sets : (workout?.mainSets ?? [])
  const displayBbbSets = seventhWeekWorkout ? [] : (workout?.bbbSets ?? [])

  // Reset completed arrays when workout slot changes (cycle-week-day key).
  // setState inside useEffect is intentional here: we synchronise derived
  // UI state with the new workout slot *after* the program advances on the
  // server — calling it during render would be a React anti-pattern in
  // concurrent mode.  The original implementation was explicitly fixed to
  // use this effect instead of an inline render-phase setState.
  const workoutKey = `${program.cycle}-${program.week}-${program.dayIndex}`
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCompletedMainSets(Array(displayMainSets.length).fill(false))
    setCompletedBbbSets(Array(displayBbbSets.length).fill(false))
  }, [workoutKey, displayMainSets.length, displayBbbSets.length])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Early return: 7th week type not yet selected
  if (isSeventhWeek && !seventhWeekTypeSelected) {
    return (
      <SeventhWeekPage
        programPhase={program.programPhase!}
        macrocycleNumber={program.macrocycleNumber}
        selectedSeventhWeekType={selectedSeventhWeekType}
        savingSeventhWeekType={savingSeventhWeekType}
        showResetConfirm={showResetConfirm}
        onSeventhWeekTypeSelect={handleSeventhWeekTypeSelect}
        onShowResetConfirm={() => setShowResetConfirm(true)}
        onCloseResetConfirm={() => setShowResetConfirm(false)}
        onResetProgram={onResetProgram}
      />
    )
  }

  if (!workout) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">{t("workout.loadError")}</p>
      </div>
    )
  }

  const { lift, liftDisplayName, mainSets, bbbSets, week, cycle } = workout
  const tm = program.trainingMaxes[lift as Lift]
  const activeTemplateConfig = isForeverProgram && program.supplementalTemplate
    ? TEMPLATES[program.supplementalTemplate as SupplementalTemplate]
    : null
  const todayAccessories =
    accessorySettings?.perDay?.[lift as "squat" | "bench" | "deadlift" | "press"] || []

  const amrapSetIndex = displayMainSets.findIndex((s) => s.isAmrap)
  const amrapSet = amrapSetIndex >= 0 ? displayMainSets[amrapSetIndex] : null
  const totalSets = displayMainSets.length + displayBbbSets.length
  const completedCount = completedMainSets.filter(Boolean).length + completedBbbSets.filter(Boolean).length
  const canFinish = completedCount === totalSets && (!amrapSet || amrapSaved)

  const toggleMainSet = (index: number) =>
    setCompletedMainSets((prev) => { const next = [...prev]; next[index] = !next[index]; return next })
  const toggleBbbSet = (index: number) =>
    setCompletedBbbSets((prev) => { const next = [...prev]; next[index] = !next[index]; return next })

  const onFinishConfirmed = () =>
    handleFinishWorkout(
      { workout: { liftDisplayName: t(liftDisplayName), mainSets, bbbSets }, completedMainSets, completedBbbSets, amrapReps, autoregulated, deviationNote, accessoryLogs, programWeek: program.week, programDayIndex: program.dayIndex, programCycle: program.cycle },
      () => { setCompletedMainSets([]); setCompletedBbbSets([]); resetAmrap(); setAutoregulated(false); setDeviationNote(""); resetAccessories() }
    )

  return (
    <div className="space-y-4">
      {/* Forever phase indicator */}
      {isForeverProgram && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PhaseBadge phase={program.programPhase!} phaseWeek={program.phaseWeek || week} phaseWeekLimit={isSeventhWeek ? 1 : 3} />
              <div>
                <p className="text-sm font-medium">{phaseName}</p>
                {isSeventhWeek && selectedSeventhWeekType ? (
                  <SeventhWeekBadge type={selectedSeventhWeekType} />
                ) : (
                  <p className="text-xs text-muted-foreground">{t("workout.templateLabel", { name: templateName })}</p>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{t("workout.macrocycle", { number: program.macrocycleNumber || 1 })}</p>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade to Forever banner (legacy programs only) */}
      {!isForeverProgram && (
        <button onClick={() => setShowUpgradeModal(true)} className="w-full bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg p-4 text-left hover:border-primary/50 transition-colors group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">{t("upgrade.bannerTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("upgrade.bannerSubtitle")}</p>
              </div>
            </div>
            <span className="text-xs text-primary uppercase tracking-widest group-hover:underline">{t("upgrade.bannerCta")}</span>
          </div>
        </button>
      )}

      <UpgradeModal open={showUpgradeModal} selectedTemplate={selectedUpgradeTemplate} upgrading={upgrading} onSelectTemplate={setSelectedUpgradeTemplate} onClose={() => setShowUpgradeModal(false)} onConfirm={handleUpgradeToForever} />

      {/* Program status bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-widest">
        <span>{t("workout.cycleLabel", { cycle })}</span>
        <span>{t("workout.weekLabel", { week })} {t(getWeekName(week))}</span>
        <div className="flex items-center gap-2">
          <span>{t("workout.dayLabel", { day: program.dayIndex + 1 })}</span>
          {wakeLock.supported && (
            <button
              onClick={wakeLock.toggle}
              title={wakeLock.enabled ? t("workout.wakeLockOn") : t("workout.wakeLockOff")}
              aria-pressed={wakeLock.enabled}
              className={`text-base leading-none transition-opacity touch-manipulation ${
                wakeLock.enabled ? "opacity-100" : "opacity-40"
              }`}
            >
              {wakeLock.enabled ? "🔆" : "🔅"}
            </button>
          )}
        </div>
      </div>

      <MainLiftCard
        liftDisplayName={t(liftDisplayName)} tm={tm} completedCount={completedCount} totalSets={totalSets}
        displayMainSets={displayMainSets} displayBbbSets={displayBbbSets}
        completedMainSets={completedMainSets} completedBbbSets={completedBbbSets}
        amrapSetIndex={amrapSetIndex} amrapSet={amrapSet}
        amrapReps={amrapReps} amrapSaved={amrapSaved} savingAmrap={savingAmrap}
        isSeventhWeek={isSeventhWeek} isTMTest={seventhWeekWorkout?.isTMTest}
        activeTemplateConfig={activeTemplateConfig}
        onToggleMainSet={toggleMainSet} onToggleBbbSet={toggleBbbSet}
        onAmrapRepsChange={setAmrapReps}
        onSaveAmrap={() => amrapSet && handleSaveAmrap({ lift, amrapSetWeight: amrapSet.weight, amrapSetTargetReps: amrapSet.targetReps, autoregulated })}
        onStartRestTimer={restTimer.start}
      />

      <AccessorySection
        todayAccessories={todayAccessories} accessoryLogs={accessoryLogs} accessoriesSaved={accessoriesSaved}
        onOpenPicker={() => setShowAccessoryPicker(true)} onComplete={handleAccessoryComplete}
      />

      <AutoregulationToggle autoregulated={autoregulated} deviationNote={deviationNote} onToggle={() => setAutoregulated(!autoregulated)} onNoteChange={setDeviationNote} />

      {/* Finish workout button */}
      <button
        onClick={() => setShowFinishConfirm(true)}
        disabled={!canFinish}
        className={`w-full font-heading font-bold uppercase tracking-widest py-4 text-sm transition-all ${canFinish ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"}`}
      >
        {canFinish ? t("workout.finishWorkout") : !amrapSaved && amrapSet && completedMainSets[amrapSetIndex] ? t("workout.enterAmrap") : t("workout.setsRemaining", { count: totalSets - completedCount })}
      </button>

      {/* Reset program link */}
      <button onClick={() => setShowResetConfirm(true)} className="w-full text-center text-xs text-muted-foreground/50 hover:text-muted-foreground uppercase tracking-widest py-2 transition-colors">
        {t("program.reset")}
      </button>

      <FinishConfirmDialog open={showFinishConfirm} finishing={finishing} onClose={() => setShowFinishConfirm(false)} onConfirm={onFinishConfirmed} />
      <ResetConfirmDialog open={showResetConfirm} onClose={() => setShowResetConfirm(false)} onConfirm={onResetProgram} />

      {/* Cycle review modal — read-only přehled, TM bylo aplikováno server-side */}
      {showCycleReview && progressionSummary !== null && (
        <CycleReviewModal
          progressionSummary={progressionSummary}
          onClose={() => setShowCycleReview(false)}
        />
      )}

      <AccessoryPicker open={showAccessoryPicker} onClose={() => setShowAccessoryPicker(false)} lift={lift} currentAccessories={todayAccessories} />

      {/* Rest timer sticky bar */}
      <RestTimerBar
        running={restTimer.running}
        remainingSec={restTimer.remainingSec}
        totalSec={restTimer.totalSec}
        onAddTime={restTimer.addTime}
        onStop={restTimer.stop}
      />
    </div>
  )
}
