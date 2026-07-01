/**
 * Upcoming Workouts Preview
 *
 * Čistá simulace postupu pozice programu pro zobrazení nadcházejících tréninků.
 * Simulace je věrná serverové logice v convex/programs.ts (advanceProgramPosition +
 * phase advancement z completeWorkout) — bez side effects, bez volání serveru.
 *
 * Rozhodnutí: první položka = PRVNÍ TRÉNINK PO AKTUÁLNÍ POZICI
 * (tj. aktuální nedokončený trénink NENÍ součástí náhledu).
 * Důvod: uživatel vidí aktuální trénink přímo na záložce „Trénink" —
 * záložka „Plán" slouží jako výhled do budoucna.
 */

import {
  buildMainSets,
  getLiftDisplayName,
  type Lift,
} from "./531"
import {
  SEVENTH_WEEK_PROTOCOLS,
  getSupplementalWeight,
  TEMPLATES,
  type ProgramPhase,
  type SeventhWeekType,
  type SupplementalTemplate,
} from "./templates"

// Zrcadlí PHASE_WEEKS z convex/programs.ts — exportováno pro UI
export const PHASE_WEEKS: Record<ProgramPhase, number> = {
  leader1: 6,
  leader2: 6,
  anchor: 3,
  seventh_week: 1,
}

// ============================================================================
// Typy
// ============================================================================

export interface UpcomingMainSet {
  weight: number
  targetReps: number
  isAmrap: boolean
  percentage: number
}

export interface UpcomingWorkout {
  /** Index v poli (0 = nejbližší trénink) */
  index: number
  lift: Lift
  liftDisplayName: string
  /** Číslo 3-týdenního cyklu (1-based) */
  cycle: number
  /** Týden v rámci cyklu (1-3) */
  week: number
  /** Index dne v splitu (0-3) */
  dayIndex: number
  /** Fáze programu */
  phase: ProgramPhase
  /** Týden v rámci fáze (1-6 pro leader, 1-3 pro anchor, 1 pro 7th week) */
  phaseWeek: number
  /** Příznak: jedná se o 7. týden */
  isSeventhWeek: boolean
  /**
   * Typ 7. týdne (tm_test / deload) — null pokud ještě není zvolen
   * nebo pokud se jedná o budoucí 7. týden (typ se vybírá těsně před vstupem).
   */
  seventhWeekProtocol: SeventhWeekType | null
  /** Hlavní série (prázdné pro 7. týden — typ se vybere až těsně před vstupem) */
  mainSets: UpcomingMainSet[]
  /** Nejvyšší váha v hlavních sériích (top set), null pro 7. týden */
  topSetWeight: number | null
  /** Supplementální template (null pro 7. týden) */
  supplementalTemplate: SupplementalTemplate | null
  /**
   * true = trénink leží za nejbližší hranicí cyklu, kde může dojít k TM progresi.
   * Váhy jsou orientační — TM se po dokončení cyklu může změnit.
   */
  tmMayChange: boolean
}

// ============================================================================
// Vstupní parametry programu pro simulaci
// ============================================================================

export interface ProgramSnapshot {
  /** Aktuální 3-týdenní cyklus (1-based) */
  cycle: number
  /** Aktuální týden v cyklu (1-3) */
  week: number
  /** Aktuální index dne v splitu (0-3) */
  dayIndex: number
  /** Aktuální fáze */
  programPhase: ProgramPhase
  /** Aktuální týden v rámci fáze */
  phaseWeek: number
  /** Fáze před vstupem do 7. týdne (určuje kam se po 7. týdnu pokračuje) */
  phaseBeforeSeventhWeek?: ProgramPhase | null
  /** Aktuální TM pro každý lift */
  trainingMaxes: Partial<Record<Lift, number>>
  /** Split (pořadí liftů ve 4-denním týdnu) */
  split: string[]
  /** Supplemental template */
  supplementalTemplate: SupplementalTemplate
  /** Aktuálně zvolený typ 7. týdne (pokud jsme v seventh_week a typ byl vybrán) */
  seventhWeekType?: SeventhWeekType | null
  /** Zaokrouhlení vah (default 2.5) */
  rounding?: number
}

// ============================================================================
// Interní stav simulace (zrcadlí stav v DB pro jednu iteraci)
// ============================================================================

interface SimState {
  cycle: number
  week: number
  dayIndex: number
  phase: ProgramPhase
  phaseWeek: number
  phaseBeforeSeventhWeek: ProgramPhase | null
  /** Číslo cyklu, po jehož dokončení se poprvé může změnit TM. */
  firstCycleBoundary: number | null
}

// ============================================================================
// Simulace posunu pozice — věrná advanceProgramPosition z convex/programs.ts
// ============================================================================

/**
 * Posune (cycle, week, dayIndex) o jeden trénink dopředu.
 * Věrná kopie `advanceProgramPosition` z convex/programs.ts.
 */
function advancePosition(
  cycle: number,
  week: number,
  dayIndex: number
): { cycle: number; week: number; dayIndex: number } {
  const newDayIndex = (dayIndex + 1) % 4
  let newWeek = week
  let newCycle = cycle

  if (newDayIndex === 0) {
    newWeek = (week % 3) + 1
    if (newWeek === 1) {
      newCycle = cycle + 1
    }
  }

  return { cycle: newCycle, week: newWeek, dayIndex: newDayIndex }
}

// ============================================================================
// Simulace posunu fáze — věrná logice completeWorkout z convex/programs.ts
// ============================================================================

/**
 * Vrátí novou fázi po opuštění seventh_week.
 * Věrná kopie `getNextPhaseAfterSeventh` z convex/programs.ts.
 */
function getNextPhaseAfterSeventh(
  completedPhase: ProgramPhase | null
): { nextPhase: ProgramPhase; newMacrocycle: boolean } {
  if (!completedPhase || completedPhase === "anchor") {
    return { nextPhase: "leader1", newMacrocycle: true }
  }
  if (completedPhase === "leader1") {
    return { nextPhase: "leader2", newMacrocycle: false }
  }
  if (completedPhase === "leader2") {
    return { nextPhase: "anchor", newMacrocycle: false }
  }
  return { nextPhase: "leader1", newMacrocycle: true }
}

/**
 * Aplikuje fázový posun po dokončení jednoho týdne (tj. newDayIndex === 0).
 * Věrná simulace phase-advancement větve z completeWorkout.
 */
function advancePhase(
  phase: ProgramPhase,
  phaseWeek: number,
  phaseBeforeSeventhWeek: ProgramPhase | null
): {
  phase: ProgramPhase
  phaseWeek: number
  phaseBeforeSeventhWeek: ProgramPhase | null
} {
  if (phase === "seventh_week") {
    // 7th week je přesně 1 týden — vždy hotová po jednom týdnu
    const { nextPhase } = getNextPhaseAfterSeventh(phaseBeforeSeventhWeek)
    return {
      phase: nextPhase,
      phaseWeek: 1,
      phaseBeforeSeventhWeek: null,
    }
  }

  const newPhaseWeek = phaseWeek + 1
  const phaseWeekLimit = PHASE_WEEKS[phase]

  if (newPhaseWeek > phaseWeekLimit) {
    // Fáze dokončena → přechod na seventh_week
    return {
      phase: "seventh_week",
      phaseWeek: 1,
      phaseBeforeSeventhWeek: phase,
    }
  }

  return {
    phase,
    phaseWeek: newPhaseWeek,
    phaseBeforeSeventhWeek: phaseBeforeSeventhWeek,
  }
}

// ============================================================================
// Detekce hranice cyklu (kdy může nastat TM progrese)
// ============================================================================

/**
 * Vrátí číslo cyklu, po jehož dokončení se poprvé může změnit TM.
 * TM progrese nastane, až se `newCycle > currentCycle` a zároveň fáze není seventh_week.
 * Hledáme první takový okamžik POZPÁTKU od aktuální pozice.
 */
function findFirstCycleBoundaryForward(
  cycle: number,
  phase: ProgramPhase
): number | null {
  // Pokud jsme v seventh_week, TM se nemůže změnit ani po dokončení cyklu v 7. týdnu.
  // Hranice je až v prvním dalším regulérním cyklu.
  if (phase === "seventh_week") {
    // Nemůžeme přesně říct který cyklus bude první — vrátíme null a nastavíme
    // tmMayChange = false pro všechny (bezpečné, nedáváme falešné jistoty).
    return null
  }

  // Zbývající dny v aktuálním cyklu: dny do konce week 3 day 3
  // Cyklus se dokončí, až week=3 a dayIndex=3 → pak newCycle=cycle+1
  // Spočítáme kolik tréninků zbývá v aktuálním cyklu.
  // Jednodušší: označit firstCycleBoundary = cycle (aktuální cyklus se MŮŽE dokončit)
  // a potom všechny tréninky >= cycle boundary jsou tmMayChange=true.
  // Ale správněji: první cyklová hranice je currentCycle, pokud ještě není dokončen.
  // Dokončení nastane tehdy, když projdeme celý zbytek cyklu. Vrátíme jen cycle.
  return cycle
}

// ============================================================================
// Výpočet sedmého týdne
// ============================================================================

/**
 * Vrátí main sets pro seventh_week pokud je znám protokol,
 * jinak prázdné pole.
 */
function buildSeventhWeekSets(
  tm: number,
  protocol: SeventhWeekType | null,
  rounding: number
): UpcomingMainSet[] {
  if (!protocol) return []

  const config = SEVENTH_WEEK_PROTOCOLS[protocol]
  return config.sets.map((s, idx) => ({
    weight: Math.round((tm * s.percent) / rounding) * rounding,
    targetReps: s.reps,
    isAmrap: protocol === "tm_test" && idx === config.sets.length - 1,
    percentage: Math.round(s.percent * 100),
  }))
}

// ============================================================================
// Hlavní funkce
// ============================================================================

/**
 * Vrátí pole příštích `count` tréninků od aktuální pozice programu.
 *
 * První položka = NÁSLEDUJÍCÍ trénink po aktuální pozici (aktuální nedokončený den není zahrnut).
 *
 * Rozhodnutí o výchozím bodu:
 * - Uživatel vidí dnešní trénink na záložce „Trénink".
 * - Záložka „Plán" slouží jako výhled — zobrazuje budoucí tréninky.
 * - Proto první položka odpovídá pozici po posunu z aktuálního dne.
 *
 * Poznámka k tmMayChange:
 * - Vlaječka je true pro všechny tréninky v cyklech > aktuálního cyklu (u leader/anchor fází).
 * - Pro tréninky v aktuálním cyklu (nebo seventh_week) je false.
 * - Zobrazujeme hint „váhy orientační — TM se po cyklu může zvýšit".
 *
 * @param program Aktuální stav programu (snapshot z Convex)
 * @param count   Počet nadcházejících tréninků (default 8)
 */
export function getUpcomingWorkouts(
  program: ProgramSnapshot,
  count = 8
): UpcomingWorkout[] {
  const rounding = program.rounding ?? 2.5
  const split = program.split as Lift[]

  // ── Inicializace simulačního stavu ────────────────────────────────────────
  // Použijeme AKTUÁLNÍ pozici a posuneme ji o jeden krok před prvním výstupem.
  let simState: SimState = {
    cycle: program.cycle,
    week: program.week,
    dayIndex: program.dayIndex,
    phase: program.programPhase,
    phaseWeek: program.phaseWeek,
    phaseBeforeSeventhWeek:
      (program.phaseBeforeSeventhWeek as ProgramPhase | null | undefined) ?? null,
    firstCycleBoundary: null,
  }

  // Zjistíme hranici cyklu (první cyklus kde může nastat TM progrese)
  const startCycleBoundary = findFirstCycleBoundaryForward(
    simState.cycle,
    simState.phase
  )
  simState.firstCycleBoundary = startCycleBoundary

  const results: UpcomingWorkout[] = []

  for (let i = 0; i < count; i++) {
    // ── 1. Posun pozice (simulace „completeWorkout" bez ukládání) ─────────
    const nextPos = advancePosition(simState.cycle, simState.week, simState.dayIndex)
    simState.cycle = nextPos.cycle
    simState.week = nextPos.week
    simState.dayIndex = nextPos.dayIndex

    const weekJustCompleted = simState.dayIndex === 0

    // ── 2. Fázový posun (pouze při dokončení celého týdne) ─────────────────
    if (weekJustCompleted) {
      const nextPhase = advancePhase(
        simState.phase,
        simState.phaseWeek,
        simState.phaseBeforeSeventhWeek
      )
      simState.phase = nextPhase.phase
      simState.phaseWeek = nextPhase.phaseWeek
      simState.phaseBeforeSeventhWeek = nextPhase.phaseBeforeSeventhWeek
    }

    // ── 3. Sestavení výstupu pro aktuální trénink ─────────────────────────
    const liftKey = split[simState.dayIndex] as Lift
    const tm = program.trainingMaxes[liftKey]

    if (!tm) {
      // Pokud TM pro daný lift chybí, přeskočíme (nemělo by nastat u aktivního programu)
      continue
    }

    const isSeventhWeek = simState.phase === "seventh_week"

    // Určení protokolu seventh_week:
    // - pokud jsme PRÁVĚ v seventh_week a uživatel již vybral typ → použijeme ho
    //   (ale pouze pro PRVNÍ výskyt seventh_week v sekvenci, tj. i === 0 a vstupní fáze je sw)
    // - pro budoucí seventh_week (přechod nastal během simulace) → typ neznáme → null
    const isCurrentSeventhWeek =
      isSeventhWeek && program.programPhase === "seventh_week"
    const seventhWeekProtocol: SeventhWeekType | null = isCurrentSeventhWeek
      ? (program.seventhWeekType ?? null)
      : null

    // Main sets
    let mainSets: UpcomingMainSet[] = []
    if (!isSeventhWeek) {
      const builtSets = buildMainSets(tm, simState.week, rounding, simState.phase)
      mainSets = builtSets.map((s) => ({
        weight: s.weight,
        targetReps: s.targetReps,
        isAmrap: s.isAmrap,
        percentage: s.percentage,
      }))
    } else if (seventhWeekProtocol) {
      mainSets = buildSeventhWeekSets(tm, seventhWeekProtocol, rounding)
    }

    const topSetWeight =
      mainSets.length > 0 ? Math.max(...mainSets.map((s) => s.weight)) : null

    // tmMayChange: true pokud je trénink za hranicí aktuálního cyklu
    // a nacházíme se v regulérní fázi (ne seventh_week)
    let tmMayChange = false
    if (!isSeventhWeek && simState.firstCycleBoundary !== null) {
      // TM může nastat po dokončení cyklu — tedy od cyklu > firstCycleBoundary
      tmMayChange = simState.cycle > simState.firstCycleBoundary
    }

    results.push({
      index: i,
      lift: liftKey,
      liftDisplayName: getLiftDisplayName(liftKey),
      cycle: simState.cycle,
      week: simState.week,
      dayIndex: simState.dayIndex,
      phase: simState.phase,
      phaseWeek: simState.phaseWeek,
      isSeventhWeek,
      seventhWeekProtocol,
      mainSets,
      topSetWeight,
      supplementalTemplate: isSeventhWeek ? null : program.supplementalTemplate,
      tmMayChange,
    })
  }

  return results
}

// ============================================================================
// Helpers pro komponentu
// ============================================================================

/**
 * Vrátí i18n klíč pro popis týdne.
 * Konzument volá t(getWeekLabel(week, isSeventhWeek)).
 */
export function getWeekLabel(week: number, isSeventhWeek: boolean): string {
  if (isSeventhWeek) return "weeks.seventh"
  const keys: Record<number, string> = {
    1: "weeks.1",
    2: "weeks.2",
    3: "weeks.3",
  }
  return keys[week] ?? "weeks.unknown"
}

/**
 * Vrátí i18n klíč pro krátký název fáze.
 * Konzument volá t(getPhaseLabelShort(phase)).
 */
export function getPhaseLabelShort(phase: ProgramPhase): string {
  return `program.phases.${phase}`
}

/**
 * Vrátí počet supplementálních sérií a váhu pro zobrazení.
 * Pouze pro non-seventh_week tréninky.
 */
export function getSupplementalInfo(
  template: SupplementalTemplate,
  week: number,
  tm: number,
  rounding: number
): { sets: number; reps: number; weight: number } {
  const config = TEMPLATES[template]
  const weight = getSupplementalWeight(template, week, tm, rounding)
  return {
    sets: config.sets,
    reps: config.reps,
    weight,
  }
}
