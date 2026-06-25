/**
 * Tests for Accessory Catalog
 * 
 * Covers:
 * - Catalog structure and completeness
 * - Equipment-based filtering
 * - Tag-based filtering
 * - Per-day recommendations
 * - Utility functions
 */

import { describe, it, expect } from "vitest"
import {
  ACCESSORY_CATALOG,
  EQUIPMENT_OPTIONS,
  EXCLUDABLE_TAGS,
  RECOMMENDED_CATEGORIES,
  CATEGORY_NAMES,
  filterCatalog,
  getExercisesByCategory,
  getExerciseById,
  type AccessoryExercise,
  type AccessoryCategory,
} from "@/lib/accessory-catalog"


// ============================================================================
// CATALOG STRUCTURE
// ============================================================================

describe("ACCESSORY_CATALOG", () => {
  it("has at least 30 exercises", () => {
    expect(ACCESSORY_CATALOG.length).toBeGreaterThanOrEqual(30)
  })

  it("has unique IDs for all exercises", () => {
    const ids = ACCESSORY_CATALOG.map(a => a.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it("has all required fields for each exercise", () => {
    for (const exercise of ACCESSORY_CATALOG) {
      expect(exercise.id).toBeTruthy()
      expect(exercise.name).toBeTruthy()
      expect(["push", "pull", "legs", "core"]).toContain(exercise.category)
      expect(Array.isArray(exercise.equipment)).toBe(true)
      expect(Array.isArray(exercise.tags)).toBe(true)
      expect(exercise.defaultScheme).toMatchObject({
        sets: expect.any(Number),
        repRange: expect.any(Array),
      })
      expect(exercise.defaultScheme.repRange).toHaveLength(2)
      expect(typeof exercise.increment).toBe("number")
    }
  })

  it("has valid category distribution", () => {
    const categories = ACCESSORY_CATALOG.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Should have exercises in all categories
    expect(categories.push).toBeGreaterThan(0)
    expect(categories.pull).toBeGreaterThan(0)
    expect(categories.legs).toBeGreaterThan(0)
    expect(categories.core).toBeGreaterThan(0)
  })

  it("has reasonable default schemes", () => {
    for (const exercise of ACCESSORY_CATALOG) {
      const { sets, repRange } = exercise.defaultScheme
      const [minReps, maxReps] = repRange
      expect(sets).toBeGreaterThanOrEqual(2)
      expect(sets).toBeLessThanOrEqual(5)
      expect(minReps).toBeGreaterThanOrEqual(5)
      expect(maxReps).toBeLessThanOrEqual(60) // Planks can be in seconds
      expect(minReps).toBeLessThanOrEqual(maxReps)
    }
  })
})


// ============================================================================
// EQUIPMENT OPTIONS
// ============================================================================

describe("EQUIPMENT_OPTIONS", () => {
  it("includes common equipment", () => {
    const ids = EQUIPMENT_OPTIONS.map(e => e.id)
    expect(ids).toContain("barbell")
    expect(ids).toContain("dumbbells")
    expect(ids).toContain("cable")
    expect(ids).toContain("pull_up_bar")
  })

  it("has unique equipment IDs", () => {
    const ids = EQUIPMENT_OPTIONS.map(e => e.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it("has i18n key names for all equipment", () => {
    for (const equipment of EQUIPMENT_OPTIONS) {
      expect(equipment.name).toBeTruthy()
      expect(typeof equipment.name).toBe("string")
      expect(equipment.name).toBe(`equipment.${equipment.id}`)
    }
  })
})


// ============================================================================
// EXCLUDABLE TAGS
// ============================================================================

describe("EXCLUDABLE_TAGS", () => {
  it("includes common limitation tags", () => {
    const ids = EXCLUDABLE_TAGS.map(t => t.id)
    expect(ids).toContain("overhead")
    expect(ids).toContain("spinal_loading")
    expect(ids).toContain("grip_intensive")
  })

  it("has i18n key name and description for all tags", () => {
    for (const tag of EXCLUDABLE_TAGS) {
      expect(tag.name).toBe(`excludableTags.${tag.id}.name`)
      expect(tag.description).toBe(`excludableTags.${tag.id}.description`)
    }
  })
})


// ============================================================================
// GET EXERCISE BY ID
// ============================================================================

describe("getExerciseById", () => {
  it("finds existing exercise", () => {
    const first = ACCESSORY_CATALOG[0]
    const found = getExerciseById(first.id)
    expect(found).toEqual(first)
  })

  it("returns undefined for non-existent ID", () => {
    expect(getExerciseById("non_existent_id_xyz")).toBeUndefined()
  })

  it("returns undefined for empty string", () => {
    expect(getExerciseById("")).toBeUndefined()
  })

  it("finds pullups exercise", () => {
    const pullups = getExerciseById("pullups")
    expect(pullups).toBeDefined()
    expect(pullups?.name).toBe("Shyby")   // name zůstává CZ fallback v datech
    expect(pullups?.category).toBe("pull")
  })
})


// ============================================================================
// FILTER CATALOG (Equipment + Tags)
// ============================================================================

describe("filterCatalog", () => {
  const allEquipment = EQUIPMENT_OPTIONS.map(e => e.id)

  it("returns all exercises when all equipment available and no exclusions", () => {
    const result = filterCatalog(allEquipment, [])
    expect(result.length).toBe(ACCESSORY_CATALOG.length)
  })

  it("returns only bodyweight exercises when no equipment", () => {
    const result = filterCatalog([], [])
    // Should only include exercises with empty equipment array
    expect(result.every(a => a.equipment.length === 0)).toBe(true)
    expect(result.length).toBeGreaterThan(0)  // Should have some bodyweight exercises
  })

  it("filters correctly with partial equipment", () => {
    const onlyDumbbells = ["dumbbells"]
    const result = filterCatalog(onlyDumbbells, [])
    
    // Should include exercises that need only dumbbells OR no equipment
    for (const exercise of result) {
      const allEquipmentAvailable = exercise.equipment.every(
        eq => onlyDumbbells.includes(eq)
      )
      expect(exercise.equipment.length === 0 || allEquipmentAvailable).toBe(true)
    }
  })

  it("excludes exercises with specified tags", () => {
    const result = filterCatalog(allEquipment, ["overhead"])
    
    // No exercise in result should have excluded tag
    for (const exercise of result) {
      expect(exercise.tags).not.toContain("overhead")
    }
    
    // Should have fewer exercises than full catalog
    expect(result.length).toBeLessThan(ACCESSORY_CATALOG.length)
  })

  it("handles multiple excluded tags", () => {
    const result = filterCatalog(allEquipment, ["overhead", "spinal_loading"])
    
    for (const exercise of result) {
      expect(exercise.tags).not.toContain("overhead")
      expect(exercise.tags).not.toContain("spinal_loading")
    }
  })

  it("combines equipment and tag filtering", () => {
    const result = filterCatalog(
      ["dumbbells"],
      ["overhead", "spinal_loading"]
    )
    
    for (const exercise of result) {
      // Equipment check
      const hasAllEquipment = exercise.equipment.every(eq => eq === "dumbbells" || eq === "")
      expect(exercise.equipment.length === 0 || hasAllEquipment).toBe(true)
      
      // Tag check
      expect(exercise.tags).not.toContain("overhead")
      expect(exercise.tags).not.toContain("spinal_loading")
    }
  })
})


// ============================================================================
// GET EXERCISES BY CATEGORY
// ============================================================================

describe("getExercisesByCategory", () => {
  const allExercises = filterCatalog(EQUIPMENT_OPTIONS.map(e => e.id), [])

  it("returns only push exercises", () => {
    const pushExercises = getExercisesByCategory(allExercises, "push")
    expect(pushExercises.every(e => e.category === "push")).toBe(true)
    expect(pushExercises.length).toBeGreaterThan(0)
  })

  it("returns only pull exercises", () => {
    const pullExercises = getExercisesByCategory(allExercises, "pull")
    expect(pullExercises.every(e => e.category === "pull")).toBe(true)
    expect(pullExercises.length).toBeGreaterThan(0)
  })

  it("returns only legs exercises", () => {
    const legsExercises = getExercisesByCategory(allExercises, "legs")
    expect(legsExercises.every(e => e.category === "legs")).toBe(true)
    expect(legsExercises.length).toBeGreaterThan(0)
  })

  it("returns only core exercises", () => {
    const coreExercises = getExercisesByCategory(allExercises, "core")
    expect(coreExercises.every(e => e.category === "core")).toBe(true)
    expect(coreExercises.length).toBeGreaterThan(0)
  })

  it("respects pre-filtered catalog", () => {
    const noCables = filterCatalog(["dumbbells", "barbell"], [])
    const pushWithoutCables = getExercisesByCategory(noCables, "push")
    
    // Should not include cable exercises
    for (const exercise of pushWithoutCables) {
      expect(exercise.equipment).not.toContain("cable")
    }
  })
})


// ============================================================================
// PER-DAY RECOMMENDATIONS
// ============================================================================

describe("RECOMMENDED_CATEGORIES", () => {
  it("has recommendations for all lifts", () => {
    expect(RECOMMENDED_CATEGORIES.squat).toBeDefined()
    expect(RECOMMENDED_CATEGORIES.bench).toBeDefined()
    expect(RECOMMENDED_CATEGORIES.deadlift).toBeDefined()
    expect(RECOMMENDED_CATEGORIES.press).toBeDefined()
  })

  it("has valid categories", () => {
    const validCategories: AccessoryCategory[] = ["push", "pull", "legs", "core"]
    
    for (const lift of ["squat", "bench", "deadlift", "press"]) {
      const categories = RECOMMENDED_CATEGORIES[lift]
      expect(Array.isArray(categories)).toBe(true)
      expect(categories.every((c: AccessoryCategory) => validCategories.includes(c))).toBe(true)
    }
  })

  it("has reasonable category distribution per day", () => {
    // Squat day should include legs
    expect(RECOMMENDED_CATEGORIES.squat).toContain("legs")
    
    // Bench day should include pull (for balance)
    expect(RECOMMENDED_CATEGORIES.bench).toContain("pull")
    
    // Deadlift day should include pull
    expect(RECOMMENDED_CATEGORIES.deadlift).toContain("pull")
    
    // Press day should include pull
    expect(RECOMMENDED_CATEGORIES.press).toContain("pull")
  })
})


// ============================================================================
// CATEGORY NAMES
// ============================================================================

describe("CATEGORY_NAMES", () => {
  it("has i18n keys for all categories", () => {
    expect(CATEGORY_NAMES.push).toBe("categories.push")
    expect(CATEGORY_NAMES.pull).toBe("categories.pull")
    expect(CATEGORY_NAMES.legs).toBe("categories.legs")
    expect(CATEGORY_NAMES.core).toBe("categories.core")
  })
})


// ============================================================================
// EDGE CASES
// ============================================================================

describe("Edge cases", () => {
  it("filtering functions don't mutate original catalog", () => {
    const originalLength = ACCESSORY_CATALOG.length
    const originalFirstId = ACCESSORY_CATALOG[0].id
    
    filterCatalog([], [])
    filterCatalog(["dumbbells"], ["overhead"])
    getExercisesByCategory(ACCESSORY_CATALOG, "push")
    
    expect(ACCESSORY_CATALOG.length).toBe(originalLength)
    expect(ACCESSORY_CATALOG[0].id).toBe(originalFirstId)
  })

  it("empty equipment list returns bodyweight exercises", () => {
    const bodyweight = filterCatalog([], [])
    
    // All should have empty equipment
    expect(bodyweight.every(e => e.equipment.length === 0)).toBe(true)
    
    // Should include some exercises
    expect(bodyweight.some(e => e.id === "pushups")).toBe(true)
    expect(bodyweight.some(e => e.id === "plank")).toBe(true)
  })

  it("strict filtering can result in empty array", () => {
    // Filter with impossible combination
    const result = filterCatalog(
      [],  // No equipment
      Array.from(new Set(ACCESSORY_CATALOG.flatMap(e => e.tags)))  // Exclude all tags
    )
    
    // Should be very few or zero exercises
    expect(result.length).toBeLessThan(ACCESSORY_CATALOG.length)
  })
})
