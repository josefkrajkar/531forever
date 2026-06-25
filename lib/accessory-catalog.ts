/**
 * Accessory Catalog for 5/3/1 Program
 * 
 * Fixed, curated list of supplemental exercises organized by category.
 * Each exercise has equipment requirements, tags for filtering, and
 * default progression scheme.
 */

export type AccessoryCategory = "push" | "pull" | "legs" | "core"

export interface AccessoryExercise {
  id: string
  name: string
  category: AccessoryCategory
  equipment: string[]        // Required equipment: [], ["dumbbells"], ["cable"], ["pull_up_bar"]
  tags: string[]             // For filtering: ["overhead", "spinal_loading", "grip_intensive"]
  defaultScheme: {
    sets: number
    repRange: [number, number]  // [min, max]
  }
  increment: number          // Smallest reasonable weight jump (kg)
}

/**
 * Master catalog of accessory exercises.
 * Curated to complement 5/3/1 main lifts and support progressive overload.
 */
export const ACCESSORY_CATALOG: AccessoryExercise[] = [
  // ============================================================================
  // PUSH (Triceps, Chest, Shoulders assistance)
  // ============================================================================
  {
    id: "dips",
    name: "Dipy",
    category: "push",
    equipment: ["dip_bars"],
    tags: ["compound", "bodyweight"],
    defaultScheme: { sets: 3, repRange: [8, 15] },
    increment: 2.5,
  },
  {
    id: "tricep_pushdown",
    name: "Tricepsové stahování",
    category: "push",
    equipment: ["cable"],
    tags: ["isolation", "elbow"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 2.5,
  },
  {
    id: "db_incline_press",
    name: "Šikmý bench s jednoručkami",
    category: "push",
    equipment: ["dumbbells", "bench"],
    tags: ["compound", "chest"],
    defaultScheme: { sets: 3, repRange: [8, 12] },
    increment: 2, // Per hand
  },
  {
    id: "overhead_tricep_ext",
    name: "Francouzský tlak",
    category: "push",
    equipment: ["dumbbells"],
    tags: ["isolation", "overhead", "elbow"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 2,
  },
  {
    id: "pushups",
    name: "Kliky",
    category: "push",
    equipment: [],
    tags: ["compound", "bodyweight"],
    defaultScheme: { sets: 3, repRange: [10, 20] },
    increment: 0, // Bodyweight
  },
  {
    id: "close_grip_bench",
    name: "Úzký bench press",
    category: "push",
    equipment: ["barbell", "bench"],
    tags: ["compound", "triceps"],
    defaultScheme: { sets: 3, repRange: [8, 12] },
    increment: 2.5,
  },
  {
    id: "cable_fly",
    name: "Cable fly",
    category: "push",
    equipment: ["cable"],
    tags: ["isolation", "chest"],
    defaultScheme: { sets: 3, repRange: [12, 15] },
    increment: 2.5,
  },
  {
    id: "db_shoulder_press",
    name: "Tlak s jednoručkami vsedě",
    category: "push",
    equipment: ["dumbbells", "bench"],
    tags: ["compound", "overhead"],
    defaultScheme: { sets: 3, repRange: [8, 12] },
    increment: 2,
  },

  // ============================================================================
  // PULL (Back, Biceps, Rear delts)
  // ============================================================================
  {
    id: "pullups",
    name: "Shyby",
    category: "pull",
    equipment: ["pull_up_bar"],
    tags: ["compound", "bodyweight", "grip_intensive"],
    defaultScheme: { sets: 3, repRange: [5, 12] },
    increment: 2.5,
  },
  {
    id: "chinups",
    name: "Shyby nadhmatem",
    category: "pull",
    equipment: ["pull_up_bar"],
    tags: ["compound", "bodyweight", "biceps", "grip_intensive"],
    defaultScheme: { sets: 3, repRange: [5, 12] },
    increment: 2.5,
  },
  {
    id: "face_pulls",
    name: "Face pulls",
    category: "pull",
    equipment: ["cable"],
    tags: ["isolation", "rear_delts", "shoulder_health"],
    defaultScheme: { sets: 3, repRange: [15, 20] },
    increment: 2.5,
  },
  {
    id: "db_rows",
    name: "Jednoruční přítahy",
    category: "pull",
    equipment: ["dumbbells", "bench"],
    tags: ["compound", "unilateral"],
    defaultScheme: { sets: 3, repRange: [8, 12] },
    increment: 2,
  },
  {
    id: "cable_rows",
    name: "Přítahy na kladce vsedě",
    category: "pull",
    equipment: ["cable"],
    tags: ["compound"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 5,
  },
  {
    id: "lat_pulldown",
    name: "Stahování na hrudník",
    category: "pull",
    equipment: ["cable"],
    tags: ["compound"],
    defaultScheme: { sets: 3, repRange: [10, 12] },
    increment: 5,
  },
  {
    id: "barbell_rows",
    name: "Přítahy s velkou činkou",
    category: "pull",
    equipment: ["barbell"],
    tags: ["compound", "spinal_loading"],
    defaultScheme: { sets: 3, repRange: [8, 12] },
    increment: 2.5,
  },
  {
    id: "hammer_curls",
    name: "Kladivové bicepsové zdvihy",
    category: "pull",
    equipment: ["dumbbells"],
    tags: ["isolation", "biceps"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 2,
  },
  {
    id: "band_pullaparts",
    name: "Rozpažování s gumou",
    category: "pull",
    equipment: ["band"],
    tags: ["isolation", "rear_delts", "shoulder_health"],
    defaultScheme: { sets: 3, repRange: [15, 25] },
    increment: 0, // Use harder band
  },

  // ============================================================================
  // LEGS (Quads, Hamstrings, Glutes, Calves)
  // ============================================================================
  {
    id: "rdl",
    name: "Rumunský mrtvý tah",
    category: "legs",
    equipment: ["barbell"],
    tags: ["compound", "hamstrings", "spinal_loading"],
    defaultScheme: { sets: 3, repRange: [8, 12] },
    increment: 5,
  },
  {
    id: "db_rdl",
    name: "Rumunský mrtvý tah s jednoručkami",
    category: "legs",
    equipment: ["dumbbells"],
    tags: ["compound", "hamstrings"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 2,
  },
  {
    id: "leg_curl",
    name: "Leg curl",
    category: "legs",
    equipment: ["machine"],
    tags: ["isolation", "hamstrings"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 2.5,
  },
  {
    id: "leg_press",
    name: "Leg press",
    category: "legs",
    equipment: ["machine"],
    tags: ["compound", "quads"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 10,
  },
  {
    id: "lunges",
    name: "Výpady",
    category: "legs",
    equipment: ["dumbbells"],
    tags: ["compound", "unilateral", "balance"],
    defaultScheme: { sets: 3, repRange: [8, 12] },
    increment: 2,
  },
  {
    id: "split_squats",
    name: "Bulharské dřepy",
    category: "legs",
    equipment: ["dumbbells", "bench"],
    tags: ["compound", "unilateral", "balance"],
    defaultScheme: { sets: 3, repRange: [8, 12] },
    increment: 2,
  },
  {
    id: "hip_thrust",
    name: "Hip thrust",
    category: "legs",
    equipment: ["barbell", "bench"],
    tags: ["compound", "glutes"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 5,
  },
  {
    id: "calf_raises",
    name: "Výpony na lýtka",
    category: "legs",
    equipment: [],
    tags: ["isolation", "calves"],
    defaultScheme: { sets: 3, repRange: [15, 20] },
    increment: 5,
  },
  {
    id: "goblet_squats",
    name: "Goblet dřepy",
    category: "legs",
    equipment: ["dumbbells"],
    tags: ["compound", "quads"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 2,
  },

  // ============================================================================
  // CORE (Abs, Obliques, Lower back support)
  // ============================================================================
  {
    id: "hanging_leg_raise",
    name: "Přednožování ve visu",
    category: "core",
    equipment: ["pull_up_bar"],
    tags: ["compound", "grip_intensive", "hip_flexors"],
    defaultScheme: { sets: 3, repRange: [8, 15] },
    increment: 0,
  },
  {
    id: "ab_wheel",
    name: "Ab wheel",
    category: "core",
    equipment: ["ab_wheel"],
    tags: ["compound", "anti_extension"],
    defaultScheme: { sets: 3, repRange: [8, 15] },
    increment: 0,
  },
  {
    id: "plank",
    name: "Plank",
    category: "core",
    equipment: [],
    tags: ["isometric", "anti_extension"],
    defaultScheme: { sets: 3, repRange: [30, 60] }, // Seconds
    increment: 0,
  },
  {
    id: "pallof_press",
    name: "Pallof press",
    category: "core",
    equipment: ["cable"],
    tags: ["anti_rotation"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 2.5,
  },
  {
    id: "cable_crunch",
    name: "Sklapovačky na kladce",
    category: "core",
    equipment: ["cable"],
    tags: ["isolation", "rectus_abdominis"],
    defaultScheme: { sets: 3, repRange: [12, 20] },
    increment: 5,
  },
  {
    id: "dead_bug",
    name: "Dead bug",
    category: "core",
    equipment: [],
    tags: ["anti_extension", "coordination"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 0,
  },
  {
    id: "bird_dog",
    name: "Bird dog",
    category: "core",
    equipment: [],
    tags: ["anti_rotation", "lower_back", "coordination"],
    defaultScheme: { sets: 3, repRange: [10, 15] },
    increment: 0,
  },
  {
    id: "side_plank",
    name: "Boční plank",
    category: "core",
    equipment: [],
    tags: ["isometric", "obliques"],
    defaultScheme: { sets: 3, repRange: [20, 45] }, // Seconds per side
    increment: 0,
  },
]

/**
 * Recommended accessory categories per training day.
 * Based on complementing the main lift while avoiding overlap/fatigue conflicts.
 */
export const RECOMMENDED_CATEGORIES: Record<string, AccessoryCategory[]> = {
  squat: ["legs", "core"],           // Hamstrings, core stability
  bench: ["pull", "push"],           // Back balance, triceps
  deadlift: ["pull", "core"],        // Upper back, core bracing
  press: ["pull", "core"],           // Rear delts, shoulder health, core
}

/**
 * Category i18n keys — komponenta volá t(`categories.${cat}`)
 */
export const CATEGORY_NAMES: Record<AccessoryCategory, string> = {
  push: "categories.push",
  pull: "categories.pull",
  legs: "categories.legs",
  core: "categories.core",
}

/**
 * Get exercises filtered by available equipment and tags to exclude
 */
export function filterCatalog(
  availableEquipment: string[],
  excludeTags: string[] = []
): AccessoryExercise[] {
  return ACCESSORY_CATALOG.filter((exercise) => {
    // Check equipment requirements
    const hasEquipment = exercise.equipment.every(
      (eq) => availableEquipment.includes(eq) || eq === ""
    )
    if (!hasEquipment && exercise.equipment.length > 0) return false

    // Check excluded tags
    const hasExcludedTag = exercise.tags.some((tag) => excludeTags.includes(tag))
    if (hasExcludedTag) return false

    return true
  })
}

/**
 * Get exercises for a specific category from filtered catalog
 */
export function getExercisesByCategory(
  catalog: AccessoryExercise[],
  category: AccessoryCategory
): AccessoryExercise[] {
  return catalog.filter((e) => e.category === category)
}

/**
 * Get exercise by ID
 */
export function getExerciseById(id: string): AccessoryExercise | undefined {
  return ACCESSORY_CATALOG.find((e) => e.id === id)
}

/**
 * Available equipment options for user selection.
 * name = i18n klíč — komponenta volá t(`equipment.${eq.id}`)
 */
export const EQUIPMENT_OPTIONS: { id: string; name: string }[] = [
  { id: "barbell", name: "equipment.barbell" },
  { id: "dumbbells", name: "equipment.dumbbells" },
  { id: "cable", name: "equipment.cable" },
  { id: "pull_up_bar", name: "equipment.pull_up_bar" },
  { id: "dip_bars", name: "equipment.dip_bars" },
  { id: "bench", name: "equipment.bench" },
  { id: "machine", name: "equipment.machine" },
  { id: "band", name: "equipment.band" },
  { id: "ab_wheel", name: "equipment.ab_wheel" },
]

/**
 * Tags that can be excluded (injuries, limitations).
 * name + description = i18n klíče — komponenta volá t(`excludableTags.${tag.id}.name`) atd.
 */
export const EXCLUDABLE_TAGS: { id: string; name: string; description: string }[] = [
  { id: "overhead", name: "excludableTags.overhead.name", description: "excludableTags.overhead.description" },
  { id: "spinal_loading", name: "excludableTags.spinal_loading.name", description: "excludableTags.spinal_loading.description" },
  { id: "grip_intensive", name: "excludableTags.grip_intensive.name", description: "excludableTags.grip_intensive.description" },
]
