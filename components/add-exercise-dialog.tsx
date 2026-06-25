"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useTranslation } from "react-i18next"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

interface Props {
  workoutId: Id<"workouts">
  onClose: () => void
}

export default function AddExerciseDialog({ workoutId, onClose }: Props) {
  const { t } = useTranslation()
  const addExercise = useMutation(api.workouts.addExercise)
  const [name, setName] = useState("")
  const [weight, setWeight] = useState("")
  const [sets, setSets] = useState("3")
  const [reps, setReps] = useState("5")
  const [rpe, setRpe] = useState<number | null>(null)
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
      await addExercise({
        workoutId,
        name: name.trim(),
        rpe: rpe ?? undefined,
        sets: setsArray,
      })
      console.log("Exercise added:", name, setsCount, "sets", rpe ? `RPE ${rpe}` : "no RPE")
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
          {t("exerciseDialog.titleAdd")}
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
              placeholder={t("exerciseDialog.namePlaceholder")}
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
                placeholder="100"
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

          {/* Preview of sets */}
          {name && (
            <div className="bg-secondary/40 rounded p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                {t("exerciseDialog.preview")}
              </p>
              <div className="flex items-center gap-2 mb-2">
                <p className="font-heading font-bold uppercase tracking-wide text-sm">
                  {name}
                </p>
                {rpe !== null && (
                  <span className="text-xs font-bold font-heading bg-primary/20 text-primary px-2 py-0.5 rounded">
                    RPE {rpe}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {Array.from({ length: Math.min(Math.max(1, parseInt(sets) || 1), 20) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-border flex items-center justify-center text-xs font-bold font-heading text-muted-foreground"
                  >
                    {parseInt(reps) || 1}
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {t("exerciseDialog.submitAdd")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
