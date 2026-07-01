import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"

export default defineSchema({
  ...authTables,

  // 5/3/1 program state
  programs: defineTable({
    userId: v.id("users"),
    template: v.literal("531_bbb"), // legacy, kept for compatibility
    status: v.union(
      v.literal("calibrating"), // user is setting initial TM
      v.literal("active"),      // program running
      v.literal("paused")       // user paused the program
    ),
    cycle: v.number(),        // which 3-week cycle (1, 2, 3...)
    week: v.number(),         // 1-3 within cycle (no more week 4 deload)
    dayIndex: v.number(),     // 0-3, position in split
    
    // 5/3/1 Forever: Leader/Anchor system
    programPhase: v.optional(v.union(
      v.literal("leader1"),      // First Leader block (2 cycles = 6 weeks)
      v.literal("leader2"),      // Second Leader block (2 cycles = 6 weeks)
      v.literal("anchor"),       // Anchor block (1-2 cycles = 3-6 weeks)
      v.literal("seventh_week")  // 7th Week Protocol (TM Test or Deload)
    )),
    supplementalTemplate: v.optional(v.union(
      v.literal("bbb"),    // Boring But Big: 5×10 @ 50-65%
      v.literal("fsl"),    // First Set Last: 5×5 @ first set weight
      v.literal("ssl"),    // Second Set Last: 5×5 @ second set weight
      v.literal("bbs")     // Boring But Strong: 10×5 @ FSL weight
    )),
    seventhWeekType: v.optional(v.union(
      v.literal("tm_test"),  // 1×3-5 @ TM to validate
      v.literal("deload")    // 5×5 @ 40-60% active recovery
    )),
    // Track position in full macrocycle (Leader1 + Leader2 + 7th + Anchor + 7th)
    macrocycleNumber: v.optional(v.number()),  // which full macrocycle (1, 2, 3...)
    phaseWeek: v.optional(v.number()),         // week within current phase (1-6 for leader, 1-3 for anchor)
    // Fáze, ze které se vstoupilo do seventh_week — určuje, kam se po 7. týdnu pokračuje
    phaseBeforeSeventhWeek: v.optional(v.union(
      v.literal("leader1"),
      v.literal("leader2"),
      v.literal("anchor")
    )),
    split: v.array(v.string()), // ["squat", "bench", "deadlift", "press"]
    trainingMaxes: v.object({
      squat: v.optional(v.number()),
      bench: v.optional(v.number()),
      deadlift: v.optional(v.number()),
      press: v.optional(v.number()),
    }),
    increments: v.object({
      squat: v.number(),     // +5 kg
      bench: v.number(),     // +2.5 kg
      deadlift: v.number(),  // +5 kg
      press: v.number(),     // +2.5 kg
    }),
    rounding: v.number(),    // 2.5 kg
    // Consecutive miss counter per lift (for RESET logic)
    misses: v.optional(v.object({
      squat: v.number(),
      bench: v.number(),
      deadlift: v.number(),
      press: v.number(),
    })),
    // e1RM history from non-autoregulated week-3 top sets (for stall detection)
    e1rmHistory: v.optional(v.object({
      squat: v.array(v.number()),
      bench: v.array(v.number()),
      deadlift: v.array(v.number()),
      press: v.array(v.number()),
    })),
    // AMRAP tracking for autoregulation
    amrapResults: v.optional(v.array(v.object({
      cycle: v.number(),
      week: v.number(),
      lift: v.union(v.literal("squat"), v.literal("bench"), v.literal("deadlift"), v.literal("press")),
      weight: v.number(),
      targetReps: v.number(),
      actualReps: v.number(),
      autoregulated: v.optional(v.boolean()),  // was this session autoregulated?
      date: v.string(),
      clientId: v.optional(v.string()),        // idempotenční dedup ID (offline replay)
    }))),
    // Calibration progress (provisional TMs before activation)
    calibration: v.optional(v.object({
      squat: v.optional(v.object({ weight: v.number(), reps: v.number() })),
      bench: v.optional(v.object({ weight: v.number(), reps: v.number() })),
      deadlift: v.optional(v.object({ weight: v.number(), reps: v.number() })),
      press: v.optional(v.object({ weight: v.number(), reps: v.number() })),
    })),
    // Accessory settings
    accessorySettings: v.optional(v.object({
      // BBB configuration
      bbb: v.object({
        enabled: v.boolean(),
        percent: v.number(),  // Default 0.50
        sets: v.number(),     // Default 5
        reps: v.number(),     // Default 10
      }),
      // Available equipment (for filtering catalog)
      availableEquipment: v.array(v.string()),
      // Tags to exclude (injuries, limitations)
      excludeTags: v.array(v.string()),
      // Selected accessories per day (by lift name)
      perDay: v.object({
        squat: v.optional(v.array(v.string())),     // accessory IDs for squat day
        bench: v.optional(v.array(v.string())),     // accessory IDs for bench day
        deadlift: v.optional(v.array(v.string())),  // accessory IDs for deadlift day
        press: v.optional(v.array(v.string())),     // accessory IDs for press day
      }),
    })),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  // Accessory log for tracking progression
  accessoryLogs: defineTable({
    userId: v.id("users"),
    accessoryId: v.string(),    // ID from catalog
    date: v.string(),           // YYYY-MM-DD
    sets: v.array(v.object({
      weight: v.number(),
      reps: v.number(),
      completed: v.boolean(),
    })),
    programCycle: v.optional(v.number()),
    programWeek: v.optional(v.number()),
    dayIndex: v.optional(v.number()),
  })
    .index("by_user_accessory", ["userId", "accessoryId"])
    .index("by_user_date", ["userId", "date"]),

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    athleteProfile: v.optional(
      v.object({
        gender: v.string(),
        age: v.number(),
        height: v.number(),
        weight: v.number(),
        experience: v.string(),
        notes: v.optional(v.string()), // deprecated, kept for backwards compatibility
      })
    ),
    trainingDays: v.optional(v.array(v.string())), // deprecated, kept for backwards compatibility
  }).index("email", ["email"]),

  // Bodyweight time series — UPSERT per (user, date), index by_user_date
  bodyweightLogs: defineTable({
    userId: v.id("users"),
    date: v.string(),      // YYYY-MM-DD — stejný formát jako workouts.date a accessoryLogs.date
    weightKg: v.number(),
    // Provenience záznamu (GDPR + UX "naposledy z Garminu"); volitelné kvůli historickým záznamům
    source: v.optional(v.union(v.literal("manual"), v.literal("garmin"), v.literal("apple_health"))),
  })
    .index("by_user_date", ["userId", "date"]),

  // Readiness signály po dnech — UPSERT per (user, date), index by_user_date.
  // Vstup pro deterministické readiness skóre (lib/readiness.ts). Vše volitelné —
  // různé zdroje (manuál / Garmin / Apple Health) dodají různé metriky.
  // POZOR (GDPR čl. 9): HRV/spánek/tep = zvláštní kategorie osobních údajů.
  readinessSignals: defineTable({
    userId: v.id("users"),
    date: v.string(),                       // YYYY-MM-DD
    hrvMs: v.optional(v.number()),          // HRV (SDNN/rMSSD) v ms
    restingHrBpm: v.optional(v.number()),   // klidový tep bpm
    sleepHours: v.optional(v.number()),     // délka spánku v hodinách
    sleepQuality: v.optional(v.number()),   // kvalita spánku 0–100
    subjectiveFeel: v.optional(
      v.union(v.literal("great"), v.literal("normal"), v.literal("bad"))
    ),
    source: v.union(v.literal("manual"), v.literal("garmin"), v.literal("apple_health")),
  })
    .index("by_user_date", ["userId", "date"]),

  workouts: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD
    status: v.union(v.literal("building"), v.literal("completed")),
    note: v.optional(v.string()),
    rating: v.optional(v.number()), // 0-5
    // deprecated — AI features odebrány, pole jen kvůli historickým dokumentům; odstranit po migraci
    motivationalQuote: v.optional(v.string()),
    // deprecated — AI features odebrány, pole jen kvůli historickým dokumentům; odstranit po migraci
    aiGenerated: v.optional(v.boolean()),
    // 5/3/1 program tracking
    programCycle: v.optional(v.number()),      // which cycle this workout belongs to
    programWeek: v.optional(v.number()),       // which week (1-4)
    programLift: v.optional(v.string()),       // main lift for this day
    autoregulated: v.optional(v.boolean()),    // user marked session as autoregulated
    deviationNote: v.optional(v.string()),     // free text for LLM context only
    exercises: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        rpe: v.optional(v.number()), // 1-10
        sets: v.array(
          v.object({
            weight: v.number(),
            reps: v.number(),
            completed: v.boolean(),
          })
        ),
      })
    ),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_status_date", ["userId", "status", "date"]),

  // OTP rate-limit tracking — max 3 požadavků na e-mail za 10 minut.
  // Záznam se vytvoří při prvním OTP požadavku a resetuje se po uplynutí okna.
  otpRateLimits: defineTable({
    email: v.string(),        // normalizovaný e-mail (lowercase, trim)
    count: v.number(),        // počet požadavků v aktuálním okně
    windowStart: v.number(),  // timestamp (ms) začátku aktuálního okna
  })
    .index("by_email", ["email"]),

  // Brute-force rate-limit pro přihlášení heslem — max 10 pokusů na e-mail za 15 minut.
  // Chrání proti credential-stuffing / online brute-force na signIn flow.
  // Každý pokus (i neúspěšný) se počítá; okno se resetuje po uplynutí.
  loginRateLimits: defineTable({
    email: v.string(),        // normalizovaný e-mail (lowercase, trim)
    count: v.number(),        // počet pokusů o přihlášení v aktuálním okně
    windowStart: v.number(),  // timestamp (ms) začátku aktuálního okna
  })
    .index("by_email", ["email"]),
})
