import { describe, it, expect } from "vitest"
import { toExportJson, toWorkoutsCsv, escapeCsvValue, type ExportData } from "@/lib/export"

// ── Pomocné továrny ────────────────────────────────────────────────────────

const BOM = "﻿"

function makeEmptyData(): ExportData {
  return {
    profile: null,
    activeProgram: null,
    workouts: [],
    accessoryLogs: [],
  }
}

function makeWorkout(overrides: Partial<{
  date: string
  programCycle: number | null
  programWeek: number | null
  programLift: string | null
  autoregulated: boolean
  exerciseName: string
  sets: Array<{ weight: number; reps: number; completed: boolean }>
}> = {}) {
  return {
    _id: "w1",
    date: overrides.date ?? "2024-01-15",
    status: "completed" as const,
    programCycle: overrides.programCycle ?? 1,
    programWeek: overrides.programWeek ?? 2,
    programLift: overrides.programLift ?? "squat",
    autoregulated: overrides.autoregulated ?? false,
    exercises: [
      {
        id: "e1",
        name: overrides.exerciseName ?? "Squat",
        sets: overrides.sets ?? [
          { weight: 85, reps: 5, completed: true },
          { weight: 85, reps: 5, completed: true },
          { weight: 85, reps: 3, completed: true },
        ],
      },
    ],
  }
}

// ── escapeCsvValue ─────────────────────────────────────────────────────────

describe("escapeCsvValue", () => {
  it("vrátí číslo jako řetězec bez uvozovek", () => {
    expect(escapeCsvValue(85)).toBe("85")
    expect(escapeCsvValue(0)).toBe("0")
  })

  it("vrátí prázdný řetězec pro null/undefined", () => {
    expect(escapeCsvValue(null)).toBe("")
    expect(escapeCsvValue(undefined)).toBe("")
  })

  it("vrátí běžný text beze změny", () => {
    expect(escapeCsvValue("Squat")).toBe("Squat")
  })

  it("obalí text s čárkou do uvozovek", () => {
    expect(escapeCsvValue("Bench, Wide")).toBe('"Bench, Wide"')
  })

  it("obalí text s uvozovkou do uvozovek a zdvojí uvozovku", () => {
    expect(escapeCsvValue('Cvik "A"')).toBe('"Cvik ""A"""')
  })

  it("obalí text s newline do uvozovek", () => {
    expect(escapeCsvValue("Řádek1\nŘádek2")).toBe('"Řádek1\nŘádek2"')
  })

  it("obalí text s CR do uvozovek", () => {
    expect(escapeCsvValue("Řádek1\rŘádek2")).toBe('"Řádek1\rŘádek2"')
  })

  it("kombinace: čárka i uvozovka", () => {
    // Cvik "A, B" → "Cvik ""A, B"""
    expect(escapeCsvValue('Cvik "A, B"')).toBe('"Cvik ""A, B"""')
  })
})

// ── toExportJson ───────────────────────────────────────────────────────────

describe("toExportJson", () => {
  it("vrátí validní JSON řetězec", () => {
    const data = makeEmptyData()
    const json = toExportJson(data, "2024-01-15T10:00:00.000Z")
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it("obsahuje metadata: exportedAt a verzi formátu", () => {
    const exportedAt = "2024-01-15T10:00:00.000Z"
    const json = toExportJson(makeEmptyData(), exportedAt)
    const parsed = JSON.parse(json)

    expect(parsed.meta).toBeDefined()
    expect(parsed.meta.exportedAt).toBe(exportedAt)
    expect(parsed.meta.version).toBeDefined()
    expect(typeof parsed.meta.version).toBe("string")
  })

  it("obsahuje název aplikace v metadatech", () => {
    const parsed = JSON.parse(toExportJson(makeEmptyData(), "2024-01-01T00:00:00.000Z"))
    expect(parsed.meta.app).toBe("Silový deník")
  })

  it("JSON round-trip: prázdná data → validní struktura", () => {
    const data = makeEmptyData()
    const json = toExportJson(data, "2024-01-01T00:00:00.000Z")
    const parsed = JSON.parse(json)

    expect(parsed.profile).toBeNull()
    expect(parsed.activeProgram).toBeNull()
    expect(Array.isArray(parsed.workouts)).toBe(true)
    expect(parsed.workouts).toHaveLength(0)
    expect(Array.isArray(parsed.accessoryLogs)).toBe(true)
  })

  it("JSON round-trip: profil se zachová správně", () => {
    const data: ExportData = {
      ...makeEmptyData(),
      profile: {
        name: "Jan Novák",
        email: "jan@example.com",
        athleteProfile: {
          gender: "Muž",
          age: 30,
          height: 180,
          weight: 85,
          experience: "Pokročilý (3+ let)",
        },
      },
    }
    const parsed = JSON.parse(toExportJson(data, "2024-01-01T00:00:00.000Z"))

    expect(parsed.profile.name).toBe("Jan Novák")
    expect(parsed.profile.email).toBe("jan@example.com")
    expect(parsed.profile.athleteProfile.age).toBe(30)
  })

  it("je formátovaný (pretty-print) — obsahuje newlines", () => {
    const json = toExportJson(makeEmptyData(), "2024-01-01T00:00:00.000Z")
    expect(json).toContain("\n")
  })
})

// ── toWorkoutsCsv ──────────────────────────────────────────────────────────

describe("toWorkoutsCsv", () => {
  it("začíná UTF-8 BOM", () => {
    const csv = toWorkoutsCsv({ workouts: [] })
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    // nebo jako řetězec
    expect(csv.startsWith(BOM)).toBe(true)
  })

  it("prázdná data → BOM + hlavička (žádné datové řádky)", () => {
    const csv = toWorkoutsCsv({ workouts: [] })
    const lines = csv.replace(BOM, "").split("\n")
    expect(lines).toHaveLength(1) // jen hlavička
    expect(lines[0]).toContain("datum")
    expect(lines[0]).toContain("cvik")
    expect(lines[0]).toContain("vaha_kg")
  })

  it("obsahuje správné sloupce v hlavičce", () => {
    const csv = toWorkoutsCsv({ workouts: [] })
    const header = csv.replace(BOM, "").split("\n")[0]
    const columns = header.split(",")
    expect(columns).toContain("datum")
    expect(columns).toContain("cyklus")
    expect(columns).toContain("tyden")
    expect(columns).toContain("den_lift")
    expect(columns).toContain("cvik")
    expect(columns).toContain("set_cislo")
    expect(columns).toContain("vaha_kg")
    expect(columns).toContain("reps")
    expect(columns).toContain("completed")
    expect(columns).toContain("amrap_flag")
  })

  it("generuje řádek pro každý set každého cviku", () => {
    const workout = makeWorkout({
      sets: [
        { weight: 80, reps: 5, completed: true },
        { weight: 80, reps: 5, completed: true },
        { weight: 80, reps: 3, completed: true },
      ],
    })
    const csv = toWorkoutsCsv({ workouts: [workout] })
    const lines = csv.replace(BOM, "").split("\n")
    // 1 hlavička + 3 sety
    expect(lines).toHaveLength(4)
  })

  it("correct data in CSV row: datum, cyklus, cvik, váha, reps", () => {
    const workout = makeWorkout({
      date: "2024-03-10",
      programCycle: 2,
      programWeek: 1,
      programLift: "bench",
      exerciseName: "Bench Press",
      sets: [{ weight: 90, reps: 5, completed: true }],
    })
    const csv = toWorkoutsCsv({ workouts: [workout] })
    const lines = csv.replace(BOM, "").split("\n")
    const dataRow = lines[1]

    expect(dataRow).toContain("2024-03-10")
    expect(dataRow).toContain("2")   // cyklus
    expect(dataRow).toContain("1")   // týden
    expect(dataRow).toContain("bench")
    expect(dataRow).toContain("Bench Press")
    expect(dataRow).toContain("90")
    expect(dataRow).toContain("5")
  })

  it("escapuje čárku v názvu cviku", () => {
    const workout = makeWorkout({
      exerciseName: "Bench, Wide",
      sets: [{ weight: 80, reps: 5, completed: true }],
    })
    const csv = toWorkoutsCsv({ workouts: [workout] })
    expect(csv).toContain('"Bench, Wide"')
  })

  it("escapuje uvozovku v názvu cviku", () => {
    const workout = makeWorkout({
      exerciseName: 'RDL "rumunský"',
      sets: [{ weight: 60, reps: 8, completed: true }],
    })
    const csv = toWorkoutsCsv({ workouts: [workout] })
    expect(csv).toContain('"RDL ""rumunský"""')
  })

  it("escapuje newline v názvu cviku", () => {
    const workout = makeWorkout({
      exerciseName: "Cvik\ns novým řádkem",
      sets: [{ weight: 50, reps: 10, completed: true }],
    })
    const csv = toWorkoutsCsv({ workouts: [workout] })
    expect(csv).toContain('"Cvik\ns novým řádkem"')
  })

  it("amrap_flag=1 jen pro poslední set při autoregulovaném tréninku", () => {
    const workout = makeWorkout({
      autoregulated: true,
      sets: [
        { weight: 85, reps: 5, completed: true },
        { weight: 85, reps: 5, completed: true },
        { weight: 85, reps: 8, completed: true }, // AMRAP = poslední set
      ],
    })
    const csv = toWorkoutsCsv({ workouts: [workout] })
    const lines = csv.replace(BOM, "").split("\n")
    // lines[1] = set 1, lines[2] = set 2, lines[3] = set 3 (AMRAP)
    const lastColumn = (row: string) => row.split(",").at(-1)

    expect(lastColumn(lines[1])).toBe("0")
    expect(lastColumn(lines[2])).toBe("0")
    expect(lastColumn(lines[3])).toBe("1")
  })

  it("amrap_flag=0 pro všechny sety při neautoregulovaném tréninku", () => {
    const workout = makeWorkout({
      autoregulated: false,
      sets: [
        { weight: 85, reps: 5, completed: true },
        { weight: 85, reps: 5, completed: true },
      ],
    })
    const csv = toWorkoutsCsv({ workouts: [workout] })
    const lines = csv.replace(BOM, "").split("\n")
    const lastColumn = (row: string) => row.split(",").at(-1)

    expect(lastColumn(lines[1])).toBe("0")
    expect(lastColumn(lines[2])).toBe("0")
  })

  it("set_cislo je 1-indexed", () => {
    const workout = makeWorkout({
      sets: [
        { weight: 80, reps: 5, completed: true },
        { weight: 80, reps: 5, completed: false },
      ],
    })
    const csv = toWorkoutsCsv({ workouts: [workout] })
    const lines = csv.replace(BOM, "").split("\n")

    // set_cislo je 6. sloupec (index 5)
    const getSetNumber = (row: string) => row.split(",")[5]
    expect(getSetNumber(lines[1])).toBe("1")
    expect(getSetNumber(lines[2])).toBe("2")
  })

  it("prázdné programCycle/Week/Lift → prázdné hodnoty v CSV, ne 'null'", () => {
    const workout = {
      _id: "w1",
      date: "2024-01-01",
      status: "completed" as const,
      programCycle: null,
      programWeek: null,
      programLift: null,
      exercises: [
        {
          id: "e1",
          name: "Push-up",
          sets: [{ weight: 0, reps: 10, completed: true }],
        },
      ],
    }
    const csv = toWorkoutsCsv({ workouts: [workout] })
    expect(csv).not.toContain("null")
    // hodnoty pro cyklus/týden/lift jsou prázdné
    const lines = csv.replace(BOM, "").split("\n")
    const cols = lines[1].split(",")
    expect(cols[1]).toBe("") // cyklus
    expect(cols[2]).toBe("") // tyden
    expect(cols[3]).toBe("") // den_lift
  })
})
