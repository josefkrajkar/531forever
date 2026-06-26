import { v } from "convex/values"
import { internalQuery, mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"

export const getDraftWorkout = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    return await ctx.db
      .query("workouts")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "building"))
      .first()
  },
})

export const getCompletedWorkouts = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    // Default cap: 200 most recent workouts. Callers can pass a smaller limit.
    const cap = Math.min(args.limit ?? 200, 500)
    return await ctx.db
      .query("workouts")
      .withIndex("by_user_status_date", (q) =>
        q.eq("userId", userId).eq("status", "completed")
      )
      .order("desc")
      .take(cap)
  },
})

export const createDraft = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const existing = await ctx.db
      .query("workouts")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "building"))
      .first()
    if (existing) return existing._id

    const today = new Date().toISOString().split("T")[0]
    return await ctx.db.insert("workouts", {
      userId,
      date: today,
      status: "building",
      exercises: [],
    })
  },
})

export const addExercise = mutation({
  args: {
    workoutId: v.id("workouts"),
    name: v.string(),
    rpe: v.optional(v.number()),
    sets: v.array(
      v.object({
        weight: v.number(),
        reps: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validace vstupů
    if (args.name.length < 1 || args.name.length > 200) {
      throw new Error("Název cviku musí mít 1–200 znaků")
    }
    if (args.sets.length > 20) {
      throw new Error("Maximálně 20 sérií na cvik")
    }
    for (const set of args.sets) {
      if (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 1000) {
        throw new Error("Váha musí být číslo v rozsahu 0–1000 kg")
      }
      if (!Number.isInteger(set.reps) || set.reps < 0 || set.reps > 100) {
        throw new Error("Počet opakování musí být celé číslo v rozsahu 0–100")
      }
    }

    const workout = await ctx.db.get(args.workoutId)
    if (!workout || workout.userId !== userId) throw new Error("Workout not found")

    if (workout.exercises.length >= 30) {
      throw new Error("Maximálně 30 cviků na trénink")
    }

    const newExercise = {
      id: crypto.randomUUID(),
      name: args.name,
      rpe: args.rpe,
      sets: args.sets.map((s) => ({ ...s, completed: false })),
    }

    await ctx.db.patch(args.workoutId, {
      exercises: [...workout.exercises, newExercise],
    })
  },
})

export const updateExercise = mutation({
  args: {
    workoutId: v.id("workouts"),
    exerciseId: v.string(),
    name: v.string(),
    rpe: v.optional(v.number()),
    sets: v.array(
      v.object({
        weight: v.number(),
        reps: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validace vstupů
    if (args.name.length < 1 || args.name.length > 200) {
      throw new Error("Název cviku musí mít 1–200 znaků")
    }
    if (args.sets.length > 20) {
      throw new Error("Maximálně 20 sérií na cvik")
    }
    for (const set of args.sets) {
      if (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 1000) {
        throw new Error("Váha musí být číslo v rozsahu 0–1000 kg")
      }
      if (!Number.isInteger(set.reps) || set.reps < 0 || set.reps > 100) {
        throw new Error("Počet opakování musí být celé číslo v rozsahu 0–100")
      }
    }

    const workout = await ctx.db.get(args.workoutId)
    if (!workout || workout.userId !== userId) throw new Error("Workout not found")

    const exercises = workout.exercises.map((exercise) => {
      if (exercise.id !== args.exerciseId) return exercise
      const newSets = args.sets.map((s, idx) => ({
        ...s,
        completed: exercise.sets[idx]?.completed ?? false,
      }))
      return { ...exercise, name: args.name, rpe: args.rpe, sets: newSets }
    })

    await ctx.db.patch(args.workoutId, { exercises })
  },
})

export const updateSetReps = mutation({
  args: {
    workoutId: v.id("workouts"),
    exerciseId: v.string(),
    setIndex: v.number(),
    reps: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const workout = await ctx.db.get(args.workoutId)
    if (!workout || workout.userId !== userId) throw new Error("Workout not found")

    const exercises = workout.exercises.map((exercise) => {
      if (exercise.id !== args.exerciseId) return exercise
      const sets = exercise.sets.map((set, idx) => {
        if (idx !== args.setIndex) return set
        return { ...set, reps: args.reps }
      })
      return { ...exercise, sets }
    })

    await ctx.db.patch(args.workoutId, { exercises })
  },
})

export const setExerciseRpe = mutation({
  args: {
    workoutId: v.id("workouts"),
    exerciseId: v.string(),
    rpe: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const workout = await ctx.db.get(args.workoutId)
    if (!workout || workout.userId !== userId) throw new Error("Workout not found")

    const exercises = workout.exercises.map((exercise) => {
      if (exercise.id !== args.exerciseId) return exercise
      return { ...exercise, rpe: args.rpe }
    })

    await ctx.db.patch(args.workoutId, { exercises })
  },
})

export const removeExercise = mutation({
  args: {
    workoutId: v.id("workouts"),
    exerciseId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const workout = await ctx.db.get(args.workoutId)
    if (!workout || workout.userId !== userId) throw new Error("Workout not found")

    await ctx.db.patch(args.workoutId, {
      exercises: workout.exercises.filter((e) => e.id !== args.exerciseId),
    })
  },
})

export const toggleSetCompletion = mutation({
  args: {
    workoutId: v.id("workouts"),
    exerciseId: v.string(),
    setIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const workout = await ctx.db.get(args.workoutId)
    if (!workout || workout.userId !== userId) throw new Error("Workout not found")

    const exercises = workout.exercises.map((exercise) => {
      if (exercise.id !== args.exerciseId) return exercise
      const sets = exercise.sets.map((set, idx) => {
        if (idx !== args.setIndex) return set
        return { ...set, completed: !set.completed }
      })
      return { ...exercise, sets }
    })

    await ctx.db.patch(args.workoutId, { exercises })
  },
})

export const completeWorkout = mutation({
  args: {
    workoutId: v.id("workouts"),
    note: v.optional(v.string()),
    rating: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validace délky poznámky
    if (args.note !== undefined && args.note.length > 2000) {
      throw new Error("Poznámka nesmí přesáhnout 2000 znaků")
    }

    const workout = await ctx.db.get(args.workoutId)
    if (!workout || workout.userId !== userId) throw new Error("Workout not found")

    const today = new Date().toISOString().split("T")[0]
    await ctx.db.patch(args.workoutId, {
      status: "completed",
      note: args.note,
      rating: args.rating,
      date: today,
    })
  },
})

export const copyWorkoutToDraft = mutation({
  args: {
    workoutId: v.id("workouts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const existingDraft = await ctx.db
      .query("workouts")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "building"))
      .first()
    if (existingDraft) {
      await ctx.db.delete(existingDraft._id)
    }

    const source = await ctx.db.get(args.workoutId)
    if (!source || source.userId !== userId) throw new Error("Workout not found")

    const today = new Date().toISOString().split("T")[0]
    return await ctx.db.insert("workouts", {
      userId,
      date: today,
      status: "building",
      exercises: source.exercises.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        sets: e.sets.map((s) => ({ ...s, completed: false })),
      })),
    })
  },
})

export const deleteDraft = mutation({
  args: {
    workoutId: v.id("workouts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const workout = await ctx.db.get(args.workoutId)
    if (!workout || workout.userId !== userId) throw new Error("Workout not found")

    await ctx.db.delete(args.workoutId)
  },
})

export const updateCompletedWorkout = mutation({
  args: {
    workoutId: v.id("workouts"),
    exercises: v.array(
      v.object({
        id: v.string(),
        sets: v.array(
          v.object({
            weight: v.number(),
            reps: v.number(),
            completed: v.boolean(),
          })
        ),
      })
    ),
    note: v.optional(v.string()),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const workout = await ctx.db.get(args.workoutId)
    if (!workout || workout.userId !== userId) throw new Error("Workout not found")
    if (workout.status !== "completed") {
      throw new Error("Editovat lze pouze dokončené tréninky")
    }

    // Validace počtu cviků
    if (args.exercises.length > 30) {
      throw new Error("Maximálně 30 cviků na trénink")
    }

    // Validace sétů a hodnot
    for (const exercise of args.exercises) {
      if (exercise.sets.length > 20) {
        throw new Error("Maximálně 20 sérií na cvik")
      }
      for (const set of exercise.sets) {
        if (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 1000) {
          throw new Error("Váha musí být číslo v rozsahu 0–1000 kg")
        }
        if (!Number.isInteger(set.reps) || set.reps < 0 || set.reps > 100) {
          throw new Error("Počet opakování musí být celé číslo v rozsahu 0–100")
        }
      }
    }

    // Validace délky poznámky
    if (args.note !== undefined && args.note.length > 2000) {
      throw new Error("Poznámka nesmí přesáhnout 2000 znaků")
    }

    // Validace ratingu
    if (args.rating !== undefined && (!Number.isFinite(args.rating) || args.rating < 0 || args.rating > 5)) {
      throw new Error("Hodnocení musí být v rozsahu 0–5")
    }

    // Sloučení: zachováme název a rpe z původního workoutu, přepíšeme sety
    const updatedExercises = workout.exercises.map((originalExercise) => {
      const updated = args.exercises.find((e) => e.id === originalExercise.id)
      if (!updated) return originalExercise
      return {
        ...originalExercise,
        sets: updated.sets,
      }
    })

    const patch: {
      exercises: typeof updatedExercises
      note?: string
      rating?: number
    } = { exercises: updatedExercises }

    if (args.note !== undefined) patch.note = args.note
    if (args.rating !== undefined) patch.rating = args.rating

    await ctx.db.patch(args.workoutId, patch)
  },
})

// Internal query — checks if user has an active draft with at least one exercise
export const getExistingDraftForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workouts")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "building"))
      .first()
  },
})

