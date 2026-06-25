import { query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"

// Get statistics data for charts
export const getStatisticsData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    // Get active program
    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    // Get completed workouts (last 90 days) — filtered directly via index range
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const cutoffDate = ninetyDaysAgo.toISOString().split("T")[0]

    const recentWorkouts = (await ctx.db
      .query("workouts")
      .withIndex("by_user_status_date", (q) =>
        q.eq("userId", userId).eq("status", "completed").gte("date", cutoffDate)
      )
      .order("asc")
      .take(500))  // hard cap — 500 workouts in 90 days is far beyond realistic

    // Calculate volume per workout
    interface VolumeEntry {
      date: string
      totalVolume: number
      squat: number
      bench: number
      deadlift: number
      press: number
      accessories: number
    }

    const volumeData: VolumeEntry[] = recentWorkouts.map((w) => {
      let totalVolume = 0
      const liftVolumes = {
        squat: 0,
        bench: 0,
        deadlift: 0,
        press: 0,
        accessories: 0,
      }

      for (const ex of w.exercises) {
        const exerciseVolume = ex.sets
          .filter((s) => s.completed)
          .reduce((sum, s) => sum + s.weight * s.reps, 0)

        totalVolume += exerciseVolume

        // Categorize by lift name
        const lowerName = ex.name.toLowerCase()
        if (lowerName.includes("squat") || lowerName.includes("dřep")) {
          liftVolumes.squat += exerciseVolume
        } else if (lowerName.includes("bench") || lowerName.includes("tlak na lavici")) {
          liftVolumes.bench += exerciseVolume
        } else if (lowerName.includes("deadlift") || lowerName.includes("mrtvý tah")) {
          liftVolumes.deadlift += exerciseVolume
        } else if (lowerName.includes("press") || lowerName.includes("tlak")) {
          liftVolumes.press += exerciseVolume
        } else {
          liftVolumes.accessories += exerciseVolume
        }
      }

      return {
        date: w.date,
        totalVolume: Math.round(totalVolume),
        squat: liftVolumes.squat,
        bench: liftVolumes.bench,
        deadlift: liftVolumes.deadlift,
        press: liftVolumes.press,
        accessories: liftVolumes.accessories,
      }
    })

    // Aggregate volume by week
    const weeklyVolume: Record<string, { 
      week: string
      total: number
      squat: number
      bench: number
      deadlift: number
      press: number
      accessories: number
    }> = {}

    for (const v of volumeData) {
      const date = new Date(v.date)
      // Get week start (Monday)
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1)
      const weekStart = new Date(date.setDate(diff))
      const weekKey = weekStart.toISOString().split("T")[0]

      if (!weeklyVolume[weekKey]) {
        weeklyVolume[weekKey] = {
          week: weekKey,
          total: 0,
          squat: 0,
          bench: 0,
          deadlift: 0,
          press: 0,
          accessories: 0,
        }
      }

      weeklyVolume[weekKey].total += v.totalVolume
      weeklyVolume[weekKey].squat += v.squat
      weeklyVolume[weekKey].bench += v.bench
      weeklyVolume[weekKey].deadlift += v.deadlift
      weeklyVolume[weekKey].press += v.press
      weeklyVolume[weekKey].accessories += v.accessories
    }

    const weeklyVolumeArray = Object.values(weeklyVolume).sort((a, b) => 
      a.week.localeCompare(b.week)
    )

    // Calculate lift distribution totals
    const liftDistribution = {
      squat: volumeData.reduce((sum, v) => sum + v.squat, 0),
      bench: volumeData.reduce((sum, v) => sum + v.bench, 0),
      deadlift: volumeData.reduce((sum, v) => sum + v.deadlift, 0),
      press: volumeData.reduce((sum, v) => sum + v.press, 0),
      accessories: volumeData.reduce((sum, v) => sum + v.accessories, 0),
    }

    // Training frequency (workouts per week)
    const frequencyData: Record<string, number> = {}
    for (const w of recentWorkouts) {
      const date = new Date(w.date)
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1)
      const weekStart = new Date(date.setDate(diff))
      const weekKey = weekStart.toISOString().split("T")[0]
      frequencyData[weekKey] = (frequencyData[weekKey] || 0) + 1
    }

    return {
      amrapResults: program?.amrapResults ?? [],
      e1rmHistory: program?.e1rmHistory ?? null,
      trainingMaxes: program?.trainingMaxes ?? null,
      currentCycle: program?.cycle ?? 1,
      weeklyVolume: weeklyVolumeArray,
      liftDistribution,
      frequencyData: Object.entries(frequencyData).map(([week, count]) => ({
        week,
        count,
      })).sort((a, b) => a.week.localeCompare(b.week)),
      totalWorkouts: recentWorkouts.length,
    }
  },
})
