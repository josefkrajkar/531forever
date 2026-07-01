/**
 * Čisté funkce pro export dat z 531Forever.
 * Žádné side efekty — jen transformace dat na řetězce.
 */

// UTF-8 BOM pro správné otevření v Excelu
const BOM = "﻿"

const FORMAT_VERSION = "1.0"

// ── Typy ──────────────────────────────────────────────────────────────────────

interface ExerciseSet {
  weight: number
  reps: number
  completed: boolean
}

interface Exercise {
  id: string
  name: string
  rpe?: number | null
  sets: ExerciseSet[]
}

interface Workout {
  _id: string
  date: string
  status: string
  note?: string | null
  rating?: number | null
  programCycle?: number | null
  programWeek?: number | null
  programLift?: string | null
  autoregulated?: boolean | null
  exercises: Exercise[]
}

interface AccessoryLog {
  _id: string
  accessoryId: string
  date: string
  sets: ExerciseSet[]
  programCycle?: number | null
  programWeek?: number | null
  dayIndex?: number | null
}

interface AthleteProfile {
  gender: string
  age: number
  height: number
  weight: number
  experience: string
}

interface UserProfile {
  name?: string | null
  email?: string | null
  athleteProfile?: AthleteProfile | null
}

interface TrainingMaxes {
  squat?: number | null
  bench?: number | null
  deadlift?: number | null
  press?: number | null
}

interface ActiveProgram {
  trainingMaxes: TrainingMaxes
  programPhase?: string | null
  supplementalTemplate?: string | null
  cycle: number
  week: number
  dayIndex: number
  macrocycleNumber?: number | null
  phaseWeek?: number | null
  split: string[]
  increments: Record<string, number>
  rounding: number
  amrapResults?: unknown[]
  e1rmHistory?: unknown
  createdAt: string
  updatedAt: string
}

export interface ExportData {
  profile: UserProfile | null
  activeProgram: ActiveProgram | null
  workouts: Workout[]
  accessoryLogs: AccessoryLog[]
}

// ── JSON export ───────────────────────────────────────────────────────────────

/**
 * Serializuje kompletní data do formátovaného JSON řetězce s metadaty.
 * @param data - Data z Convex exportData query
 * @param exportedAt - ISO timestamp exportu (předáván jako parametr pro testovatelnost)
 */
export function toExportJson(data: ExportData, exportedAt: string): string {
  const payload = {
    meta: {
      app: "531Forever",
      version: FORMAT_VERSION,
      exportedAt,
    },
    ...data,
  }
  return JSON.stringify(payload, null, 2)
}

// ── CSV escaping ──────────────────────────────────────────────────────────────

/**
 * Escapuje hodnotu pro CSV: pokud obsahuje čárku, uvozovku nebo newline,
 * obalí do uvozovek a zdvojí vnitřní uvozovky.
 */
export function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  // Pokud obsahuje speciální znak, obal do uvozovek a zdvoj uvozovky
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// ── CSV export ────────────────────────────────────────────────────────────────

/**
 * Konvertuje dokončené workouty na CSV.
 * Každý řádek = jeden set jednoho cviku.
 * Sloupce: datum, cyklus, týden, den (lift), cvik, set#, váha (kg), reps, completed, amrap_flag
 *
 * UTF-8 BOM na začátku pro Excel.
 */
export function toWorkoutsCsv(data: Pick<ExportData, "workouts">): string {
  const header = [
    "datum",
    "cyklus",
    "tyden",
    "den_lift",
    "cvik",
    "set_cislo",
    "vaha_kg",
    "reps",
    "completed",
    "amrap_flag",
  ].join(",")

  const rows: string[] = [header]

  for (const workout of data.workouts) {
    if (workout.status !== "completed") continue

    const date = escapeCsvValue(workout.date)
    const cycle = escapeCsvValue(workout.programCycle ?? "")
    const week = escapeCsvValue(workout.programWeek ?? "")
    const lift = escapeCsvValue(workout.programLift ?? "")

    for (const exercise of workout.exercises) {
      const exerciseName = escapeCsvValue(exercise.name)

      for (let setIdx = 0; setIdx < exercise.sets.length; setIdx++) {
        const set = exercise.sets[setIdx]
        // AMRAP flag: poslední set při autoregulovaném tréninku (setIdx = poslední)
        const isLastSet = setIdx === exercise.sets.length - 1
        const amrapFlag = workout.autoregulated && isLastSet ? "1" : "0"

        const row = [
          date,
          cycle,
          week,
          lift,
          exerciseName,
          escapeCsvValue(setIdx + 1),
          escapeCsvValue(set.weight),
          escapeCsvValue(set.reps),
          escapeCsvValue(set.completed ? "1" : "0"),
          amrapFlag,
        ].join(",")

        rows.push(row)
      }
    }
  }

  return BOM + rows.join("\n")
}
