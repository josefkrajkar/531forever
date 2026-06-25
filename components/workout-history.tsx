"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"

// Per-exercise draft state for edit mode
type EditExerciseDraft = {
  id: string
  sets: { weight: string; reps: string; completed: boolean }[]
}

type EditDraft = {
  exercises: EditExerciseDraft[]
  note: string
  rating: number | undefined
}

function buildEditDraft(workout: {
  exercises: { id: string; sets: { weight: number; reps: number; completed: boolean }[] }[]
  note?: string
  rating?: number
}): EditDraft {
  return {
    exercises: workout.exercises.map((ex) => ({
      id: ex.id,
      sets: ex.sets.map((s) => ({
        weight: String(s.weight),
        reps: String(s.reps),
        completed: s.completed,
      })),
    })),
    note: workout.note ?? "",
    rating: workout.rating,
  }
}

export default function WorkoutHistory() {
  const { t } = useTranslation()
  const workouts = useQuery(api.workouts.getCompletedWorkouts, {})
  const deleteWorkout = useMutation(api.workouts.deleteDraft)
  const updateWorkout = useMutation(api.workouts.updateCompletedWorkout)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<Id<"workouts"> | null>(null)
  const [editingId, setEditingId] = useState<Id<"workouts"> | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [savingId, setSavingId] = useState<Id<"workouts"> | null>(null)

  if (workouts === undefined) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-muted-foreground text-xs uppercase tracking-widest animate-pulse">
          {t("history.loading")}
        </div>
      </div>
    )
  }

  if (workouts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-5xl select-none">📋</div>
        <p className="text-muted-foreground uppercase tracking-widest text-xs text-center">
          {t("history.empty")}
        </p>
      </div>
    )
  }

  function handleStartEdit(workout: NonNullable<typeof workouts>[number]) {
    setEditingId(workout._id)
    setEditDraft(buildEditDraft(workout))
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  async function handleSaveEdit(workoutId: Id<"workouts">) {
    if (!editDraft) return
    setSavingId(workoutId)
    try {
      // Parse and validate draft values before sending
      const exercises = editDraft.exercises.map((ex) => ({
        id: ex.id,
        sets: ex.sets.map((s) => ({
          weight: parseFloat(s.weight) || 0,
          reps: parseInt(s.reps, 10) || 0,
          completed: s.completed,
        })),
      }))
      await updateWorkout({
        workoutId,
        exercises,
        note: editDraft.note || undefined,
        rating: editDraft.rating,
      })
      toast.success(t("history.savedSuccess"))
      setEditingId(null)
      setEditDraft(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("history.savedError")
      toast.error(msg)
    } finally {
      setSavingId(null)
    }
  }

  function updateDraftSet(
    exIdx: number,
    setIdx: number,
    field: "weight" | "reps" | "completed",
    value: string | boolean
  ) {
    if (!editDraft) return
    setEditDraft((prev) => {
      if (!prev) return prev
      const exercises = prev.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex
        const sets = ex.sets.map((s, si) => {
          if (si !== setIdx) return s
          return { ...s, [field]: value }
        })
        return { ...ex, sets }
      })
      return { ...prev, exercises }
    })
  }

  return (
    <div className="space-y-3">
      <p className="font-heading font-bold uppercase tracking-widest text-xs text-muted-foreground mb-4">
        {t("history.pastWorkouts", { count: workouts.length })}
      </p>

      {workouts.map((workout) => {
        const isExpanded = expandedId === workout._id
        const isEditing = editingId === workout._id
        const isSaving = savingId === workout._id
        const formattedDate = new Date(workout.date + "T12:00:00").toLocaleDateString("cs-CZ", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        const completedSets = workout.exercises
          .flatMap((e) => e.sets)
          .filter((s) => s.completed).length
        const totalSets = workout.exercises.flatMap((e) => e.sets).length

        return (
          <div
            key={workout._id}
            className="bg-card border border-border rounded overflow-hidden"
          >
            {/* Card header — click to expand */}
            <button
              onClick={() => {
                if (isEditing) return // don't collapse while editing
                setExpandedId(isExpanded ? null : workout._id)
              }}
              className="w-full p-4 text-left hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold uppercase tracking-wide text-sm capitalize">
                    {formattedDate}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1 truncate uppercase tracking-wider">
                    {workout.exercises.map((e) => e.name).join(" · ")}
                  </p>
                  {totalSets > 0 && (
                    <p className="text-muted-foreground text-xs mt-0.5 uppercase tracking-wider">
                      <span className="text-primary font-bold">{completedSets}</span>
                      /{totalSets} {t("history.setsSuffix")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {workout.rating !== undefined && workout.rating > 0 && (
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-sm ${
                            star <= workout.rating! ? "text-primary" : "text-muted-foreground/30"
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && !isEditing && (
              <div className="border-t border-border px-4 pb-5 pt-4">
                {/* Exercises */}
                <div className="space-y-4 mb-4">
                  {workout.exercises.map((exercise) => {
                    const doneCount = exercise.sets.filter((s) => s.completed).length
                    return (
                      <div key={exercise.id}>
                        <div className="flex justify-between items-baseline mb-1.5">
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-heading font-bold uppercase tracking-wide text-sm hover:text-primary transition-colors"
                            >
                              {exercise.name}
                            </a>
                            {exercise.rpe != null && (
                              <span className="text-xs font-bold font-heading bg-primary/20 text-primary px-2 py-0.5 rounded">
                                RPE {exercise.rpe}
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {exercise.sets[0]?.weight} kg &middot;{" "}
                            <span className="text-primary">{doneCount}</span>
                            /{exercise.sets.length} {t("history.setsSuffix")}
                          </span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {exercise.sets.map((set, idx) => (
                            <div
                              key={idx}
                              title={t("history.setTitle", { weight: set.weight, reps: set.reps })}
                              className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold font-heading ${
                                set.completed
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {set.reps}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Note */}
                {workout.note && (
                  <div className="border-t border-border pt-3 mb-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
                      {t("history.noteLabel")}
                    </p>
                    <p className="text-sm text-foreground/80 italic leading-relaxed">
                      &ldquo;{workout.note}&rdquo;
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleStartEdit(workout)}
                    className="border border-border text-muted-foreground font-heading font-bold uppercase tracking-widest px-4 py-2.5 text-xs hover:border-primary hover:text-primary transition-colors rounded-sm flex items-center gap-2"
                    aria-label={t("history.editAriaLabel")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    {t("history.editLabel")}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(workout._id)}
                    className="border border-border text-muted-foreground font-heading font-bold uppercase tracking-widest px-4 py-2.5 text-xs hover:border-destructive hover:text-destructive transition-colors rounded-sm flex items-center gap-2"
                    aria-label={t("history.deleteAriaLabel")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                    {t("history.deleteLabel")}
                  </button>
                </div>
              </div>
            )}

            {/* Edit mode */}
            {isExpanded && isEditing && editDraft && (
              <div className="border-t border-border px-4 pb-5 pt-4">
                {/* Warning note */}
                <p className="text-xs text-muted-foreground bg-secondary/40 border border-border rounded px-3 py-2 mb-4 leading-relaxed">
                  {t("history.editWarning")}
                </p>

                {/* Exercises edit */}
                <div className="space-y-5 mb-4">
                  {workout.exercises.map((exercise, exIdx) => {
                    const draft = editDraft.exercises[exIdx]
                    if (!draft) return null
                    return (
                      <div key={exercise.id}>
                        <p className="font-heading font-bold uppercase tracking-wide text-sm mb-2">
                          {exercise.name}
                          {exercise.rpe != null && (
                            <span className="ml-2 text-xs font-bold font-heading bg-primary/20 text-primary px-2 py-0.5 rounded">
                              RPE {exercise.rpe}
                            </span>
                          )}
                        </p>
                        <div className="space-y-2">
                          {draft.sets.map((set, setIdx) => (
                            <div key={setIdx} className="flex items-center gap-2">
                              <span className="text-muted-foreground text-xs w-5 text-right flex-shrink-0">
                                {setIdx + 1}.
                              </span>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={set.weight}
                                min={0}
                                max={1000}
                                step={0.5}
                                aria-label={t("history.setWeightAria", { name: exercise.name, num: setIdx + 1 })}
                                onChange={(e) => updateDraftSet(exIdx, setIdx, "weight", e.target.value)}
                                className="w-20 bg-background border border-border rounded px-2 py-1.5 text-sm text-right font-heading font-bold focus:outline-none focus:border-primary transition-colors"
                              />
                              <span className="text-muted-foreground text-xs">kg</span>
                              <span className="text-muted-foreground text-xs mx-1">×</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={set.reps}
                                min={0}
                                max={100}
                                step={1}
                                aria-label={t("history.setRepsAria", { name: exercise.name, num: setIdx + 1 })}
                                onChange={(e) => updateDraftSet(exIdx, setIdx, "reps", e.target.value)}
                                className="w-16 bg-background border border-border rounded px-2 py-1.5 text-sm text-right font-heading font-bold focus:outline-none focus:border-primary transition-colors"
                              />
                              <span className="text-muted-foreground text-xs">rep</span>
                              <label className="flex items-center gap-1.5 ml-1 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={set.completed}
                                  onChange={(e) => updateDraftSet(exIdx, setIdx, "completed", e.target.checked)}
                                  className="w-4 h-4 accent-primary cursor-pointer"
                                  aria-label={t("history.setCompletedAria", { name: exercise.name, num: setIdx + 1 })}
                                />
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                                  ok
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Note edit */}
                <div className="mb-4">
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
                    {t("history.noteEditLabel")}
                  </label>
                  <textarea
                    value={editDraft.note}
                    onChange={(e) => setEditDraft((prev) => prev ? { ...prev, note: e.target.value } : prev)}
                    rows={2}
                    placeholder={t("history.notePlaceholder")}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>

                {/* Rating edit */}
                <div className="mb-5">
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
                    {t("history.ratingLabel")}
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setEditDraft((prev) =>
                            prev
                              ? { ...prev, rating: prev.rating === star ? 0 : star }
                              : prev
                          )
                        }
                        className={`text-2xl transition-colors ${
                          (editDraft.rating ?? 0) >= star
                            ? "text-primary"
                            : "text-muted-foreground/30 hover:text-muted-foreground/60"
                        }`}
                        aria-label={t("history.ratingStarAria", { star })}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save / Cancel */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex-1 border border-border text-muted-foreground hover:text-foreground font-heading font-bold uppercase tracking-widest py-3 text-xs transition-colors rounded-sm disabled:opacity-50"
                  >
                    {t("history.cancelLabel")}
                  </button>
                  <button
                    onClick={() => handleSaveEdit(workout._id)}
                    disabled={isSaving}
                    className="flex-1 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest py-3 text-xs hover:opacity-90 transition-opacity rounded-sm disabled:opacity-50"
                  >
                    {isSaving ? t("history.savingLabel") : t("history.saveLabel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Confirm delete dialog */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setConfirmDeleteId(null)}
        >
          <div className="bg-card border border-border w-full max-w-sm rounded p-6">
            <h2 className="font-heading font-extrabold uppercase tracking-widest text-xl mb-2">
              {t("history.deleteConfirm")}
            </h2>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              {t("history.deleteConfirmDescription")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 border border-border text-muted-foreground hover:text-foreground font-heading font-bold uppercase tracking-widest py-3 text-xs transition-colors rounded-sm"
              >
                {t("history.backLabel")}
              </button>
              <button
                onClick={async () => {
                  await deleteWorkout({ workoutId: confirmDeleteId })
                  console.log("Workout deleted from history:", confirmDeleteId)
                  setConfirmDeleteId(null)
                  setExpandedId(null)
                }}
                className="flex-1 bg-destructive text-destructive-foreground font-heading font-bold uppercase tracking-widest py-3 text-xs hover:opacity-90 transition-opacity rounded-sm"
              >
                {t("history.deleteLabel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
