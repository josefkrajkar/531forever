"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import { getExerciseById } from "@/lib/accessory-catalog"
import { type AccessorySetLog, type CycleProgressionSummary } from "@/lib/531"
import { useConnectionState } from "@/hooks/use-connection-state"
import { useOfflineMutation } from "@/hooks/use-offline-mutation"

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

interface FinishWorkoutParams {
  workout: {
    liftDisplayName: string
    mainSets: MainSet[]
    bbbSets: BbbSet[]
  }
  completedMainSets: boolean[]
  completedBbbSets: boolean[]
  amrapReps: string
  autoregulated: boolean
  deviationNote: string
  accessoryLogs: Record<string, AccessorySetLog[]>
  programWeek: number
  programDayIndex: number
  programCycle: number
}

interface UseFinishWorkoutReturn {
  showFinishConfirm: boolean
  finishing: boolean
  showCycleReview: boolean
  progressionSummary: CycleProgressionSummary | null
  setShowFinishConfirm: (show: boolean) => void
  setShowCycleReview: (show: boolean) => void
  handleFinishWorkout: (params: FinishWorkoutParams, onReset: () => void) => Promise<void>
}

export function useFinishWorkout(): UseFinishWorkoutReturn {
  const completeWorkout = useMutation(api.programs.completeWorkout)
  const logMultipleAccessories = useMutation(api.accessories.logMultipleAccessories)

  const { isOnline } = useConnectionState()
  const { enqueueMutation } = useOfflineMutation()

  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [showCycleReview, setShowCycleReview] = useState(false)
  const [progressionSummary, setProgressionSummary] = useState<CycleProgressionSummary | null>(null)

  const handleFinishWorkout = async (params: FinishWorkoutParams, onReset: () => void) => {
    if (finishing) return

    const {
      workout,
      completedMainSets,
      completedBbbSets,
      amrapReps,
      autoregulated,
      deviationNote,
      accessoryLogs,
      programCycle,
      programWeek,
      programDayIndex,
    } = params

    setFinishing(true)

    try {
      // Build exercises array for history
      const exercises = [
        // Main lift
        {
          id: crypto.randomUUID(),
          name: workout.liftDisplayName,
          rpe: undefined,
          sets: workout.mainSets.map((set, idx) => ({
            weight: set.weight,
            reps: set.isAmrap && amrapReps ? parseInt(amrapReps) : set.targetReps,
            completed: completedMainSets[idx] || false,
          })),
        },
        // BBB sets as separate exercise entry
        ...(workout.bbbSets.length > 0
          ? [
              {
                id: crypto.randomUUID(),
                name: `${workout.liftDisplayName} (BBB)`,
                rpe: undefined,
                sets: workout.bbbSets.map((set, idx) => ({
                  weight: set.weight,
                  reps: set.reps,
                  completed: completedBbbSets[idx] || false,
                })),
              },
            ]
          : []),
        // Add accessories to exercise history
        ...Object.entries(accessoryLogs).map(([accessoryId, sets]) => {
          const exercise = getExerciseById(accessoryId)
          return {
            id: crypto.randomUUID(),
            name: exercise?.name || accessoryId,
            rpe: undefined,
            sets: sets.map((s) => ({
              weight: s.weight,
              reps: s.reps,
              completed: s.completed,
            })),
          }
        }),
      ]

      if (isOnline) {
        // ── ONLINE větev — PŘESNĚ stávající chování, nulová regrese ──────────

        // Save accessories to Convex
        if (Object.keys(accessoryLogs).length > 0) {
          await logMultipleAccessories({
            // Datum z klienta — offline replay zaloguje na správné datum (stejný vzor jako bodyweight)
            date: new Date().toISOString().split("T")[0],
            logs: Object.entries(accessoryLogs).map(([accessoryId, sets]) => ({
              accessoryId,
              sets,
            })),
          })
          console.log(
            "[program-workout] Accessories saved to Convex:",
            Object.keys(accessoryLogs).length,
            "exercises"
          )
        }

        const result = await completeWorkout({
          exercises,
          autoregulated,
          deviationNote: deviationNote || undefined,
          expectedCycle: programCycle,
          expectedWeek: programWeek,
          expectedDayIndex: programDayIndex,
        })
        console.log(
          "[program-workout] Workout completed and saved to history",
          autoregulated ? "(autoregulated)" : ""
        )

        // Reset local state via callback (caller resets its own state)
        onReset()
        setShowFinishConfirm(false)

        // Pokud server vrátil progressionSummary, zobrazíme modal s přehledem cyklu.
        // Data jsou předána explicitně — žádná závislost na stale realtime snapshotu.
        const summary = (result as { progressionSummary?: CycleProgressionSummary | null })
          .progressionSummary ?? null
        if (summary) {
          console.log(
            "[program-workout] Cyklus", summary.completedCycle, "dokončen — zobrazuji přehled TM"
          )
          setProgressionSummary(summary)
          setShowCycleReview(true)
        }
      } else {
        // ── OFFLINE větev — přes outbox, FIFO pořadí ─────────────────────────
        // FIFO: AMRAP (use-amrap) enqueued dřív → accessories → completeWorkout poslední

        // 1. Accessories nejdřív (pokud existují)
        if (Object.keys(accessoryLogs).length > 0) {
          await enqueueMutation("accessories.logMultipleAccessories", {
            date: new Date().toISOString().split("T")[0],
            logs: Object.entries(accessoryLogs).map(([accessoryId, sets]) => ({
              accessoryId,
              sets,
            })),
          })
          console.log(
            "[program-workout] Accessories enqueued offline:",
            Object.keys(accessoryLogs).length,
            "exercises"
          )
        }

        // 2. completeWorkout MUSÍ být poslední enqueued
        await enqueueMutation("programs.completeWorkout", {
          exercises,
          autoregulated,
          deviationNote: deviationNote || undefined,
          expectedCycle: programCycle,
          expectedWeek: programWeek,
          expectedDayIndex: programDayIndex,
        })
        console.log(
          "[program-workout] Workout enqueued offline",
          autoregulated ? "(autoregulated)" : ""
        )

        // Optimistická odezva — ŽÁDNÝ modal (progressionSummary offline k dispozici není)
        toast.success("Trénink uložen — synchronizuje se po připojení")
        onReset()
        setShowFinishConfirm(false)
      }
    } catch (err) {
      console.error("[program-workout] Complete error:", err)
      toast.error("Uložení tréninku se nezdařilo, zkus to znovu")
    } finally {
      setFinishing(false)
    }
  }

  return {
    showFinishConfirm,
    finishing,
    showCycleReview,
    progressionSummary,
    setShowFinishConfirm,
    setShowCycleReview,
    handleFinishWorkout,
  }
}
