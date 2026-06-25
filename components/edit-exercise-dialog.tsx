"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useTranslation } from "react-i18next"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

interface Exercise {
  id: string
  name: string
  rpe?: number
  sets: { weight: number; reps: number; completed: boolean }[]
}

interface Props {
  workoutId: Id<"workouts">
  exercise: Exercise
  onClose: () => void
}

export default function EditExerciseDialog({ workoutId, exercise, onClose }: Props) {
  const { t } = useTranslation()
  const updateExercise = useMutation(api.workouts.updateExercise)

  const [name, setName] = useState(exercise.name)
  const [weight, setWeight] = useState(String(exercise.sets[0]?.weight ?? ""))
  const [sets, setSets] = useState(String(exercise.sets.length))
  const [reps, setReps] = useState(String(exercise.sets[0]?.reps ?? ""))
  const [rpe, setRpe] = useState<number | null>(exercise.rpe ?? null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const setsCount = Math.max(1, parseInt(sets) || 1)
    const repsCount = Math.max(1, parseInt(reps) || 1)
    const weightValue = parseFloat(weight) || 0

    const setsArray = Array.from({ length: setsCount }, () => ({
      weight: weightValue,
      reps: repsCount,
    }))

    setLoading(true)
    try {
      await updateExercise({
        workoutId,
        exerciseId: exercise.id,
        name: name.trim(),
        rpe: rpe ?? undefined,
        sets: setsArray,
      })
      console.log("Exercise updated:", exercise.id, name)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border w-full max-w-md rounded p-6">
        <h2 className="font-heading font-extrabold uppercase tracking-widest text-xl mb-6">
          {t("exerciseDialog.titleEdit")}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
              {t("exerciseDialog.nameLabel")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors text-sm rounded-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
                {t("exerciseDialog.weightLabel")}
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                min="0"
                step="0.5"
                className="w-full bg-background border border-border px-3 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors text-sm rounded-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
                {t("exerciseDialog.setsLabel")}
              </label>
              <input
                type="number"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                min="1"
                max="20"
                className="w-full bg-background border border-border px-3 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors text-sm rounded-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
                {t("exerciseDialog.repsLabel")}
              </label>
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                min="1"
                max="100"
                className="w-full bg-background border border-border px-3 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors text-sm rounded-sm"
              />
            </div>
          </div>

          {/* RPE selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                RPE{" "}
                <span className="normal-case tracking-normal text-muted-foreground/60">
                  {t("exerciseDialog.rpeOptional")}
                </span>
              </label>
              {rpe !== null && (
                <button
                  type="button"
                  onClick={() => setRpe(null)}
                  className="text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors"
                >
                  {t("exerciseDialog.rpeClear")}
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                <button
                  key={val}
                  type="button"
                  title={t(`exerciseDialog.rpe.${val}`)}
                  onClick={() => setRpe(rpe === val ? null : val)}
                  className={`w-9 h-9 rounded text-xs font-bold font-heading transition-all ${
                    rpe === val
                      ? "bg-primary text-primary-foreground border-2 border-primary"
                      : "bg-background border border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            {rpe !== null && (
              <p className="text-xs text-primary mt-2 uppercase tracking-widest">
                RPE {rpe} — {t(`exerciseDialog.rpe.${rpe}`)}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border text-muted-foreground hover:text-foreground font-heading font-bold uppercase tracking-widest py-3 text-xs transition-colors rounded-sm"
            >
              {t("program.cancel")}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="flex-1 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest py-3 text-xs hover:opacity-90 transition-opacity disabled:opacity-40 rounded-sm"
            >
              {t("exerciseDialog.submitEdit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
