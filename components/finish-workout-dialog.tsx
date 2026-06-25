"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

interface Props {
  workoutId: Id<"workouts">
  onClose: () => void
  onCompleted: () => void
}

export default function FinishWorkoutDialog({ workoutId, onClose, onCompleted }: Props) {
  const { t } = useTranslation()
  const completeWorkout = useMutation(api.workouts.completeWorkout)
  const [note, setNote] = useState("")
  const [rating, setRating] = useState(4)
  const [hovered, setHovered] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await completeWorkout({
        workoutId,
        note: note.trim() || undefined,
        rating,
      })
      console.log("Workout completed with rating:", rating)
      onCompleted()
    } finally {
      setLoading(false)
    }
  }

  const displayRating = hovered || rating

  const ratingLabels: Record<number, string> = {
    1: t("finishDialog.rating.1"),
    2: t("finishDialog.rating.2"),
    3: t("finishDialog.rating.3"),
    4: t("finishDialog.rating.4"),
    5: t("finishDialog.rating.5"),
  }

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border w-full max-w-md rounded p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3 select-none">💪</div>
          <h2 className="font-heading font-extrabold uppercase tracking-widest text-xl">
            {t("finishDialog.title")}
          </h2>
          <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
            {t("finishDialog.subtitle")}
          </p>
        </div>

        <div className="space-y-5">
          {/* Star rating */}
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-3 text-center">
              {t("finishDialog.ratingLabel")}
            </label>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className={`text-4xl transition-all hover:scale-110 active:scale-95 select-none ${
                    star <= displayRating ? "text-primary" : "text-muted-foreground/40"
                  }`}
                  aria-label={t("finishDialog.ratingStarAria", { star, total: 5 })}
                >
                  ★
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2 uppercase tracking-widest">
              {ratingLabels[rating]}
            </p>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
              {t("finishDialog.notesLabel")}{" "}
              <span className="text-muted-foreground/50">{t("finishDialog.notesOptional")}</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("finishDialog.notesPlaceholder")}
              rows={3}
              className="w-full bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors resize-none text-sm rounded-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 border border-border text-muted-foreground hover:text-foreground font-heading font-bold uppercase tracking-widest py-3 text-xs transition-colors rounded-sm"
            >
              {t("finishDialog.back")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest py-3 text-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 rounded-sm"
            >
              {loading ? t("finishDialog.saving") : t("finishDialog.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
