/**
 * readiness.ts — deterministická readiness logika (čistá, platformově nezávislá).
 *
 * Transparentní readiness skóre 0–100 s VEŘEJNÝMI vahami. Žádná AI/ML, žádná
 * predikce — jen publikované heuristiky:
 *  - HRV vůči baseline ±SD (Kiviniemi 2007; Altini / HRV4Training trend)
 *  - klidový tep > baseline +5 % = únava (Runners Connect / overtraining markery)
 *  - spánek 7 h+ a kvalita 75 %+ jako práh pro plnou pohotovost
 *
 * Doktrína 5/3/1 Forever: readiness je POUZE poradní signál. Pásma se mapují na
 * NATIVNÍ 5/3/1 primitiva (úsilí na + sérii, strukturální deload), NIKDY na
 * snižování předepsané váhy — TM je submaximální a procenta jsou posvátná.
 * Skutečné doporučení je strojově čitelný enum; UI copy (čeština) žije v komponentě.
 *
 * Čistota: žádný `new Date()` — datum se předává jako parametr (vzor lib/bodyweight.ts).
 */

// ─── Typy ───────────────────────────────────────────────────────────────────

/** Subjektivní pocit zadaný uživatelem */
export type SubjectiveFeel = "great" | "normal" | "bad"

/** Vstupní readiness signály pro daný den (vše volitelné — různé zdroje dodají různé metriky) */
export interface ReadinessSignals {
  /** HRV (SDNN/rMSSD) v ms */
  hrvMs?: number
  /** Klidový tep (bpm) */
  restingHrBpm?: number
  /** Délka spánku v hodinách */
  sleepHours?: number
  /** Kvalita spánku 0–100 (volitelné) */
  sleepQuality?: number
  /** Subjektivní pocit uživatele */
  subjectiveFeel?: SubjectiveFeel
}

/** Baseline per metrika (klouzavý průměr, u HRV i SD) */
export interface ReadinessBaseline {
  hrv?: { mean: number; sd: number }
  restingHr?: { mean: number }
}

/** Pásmo readiness (strojově čitelné) */
export type ReadinessBand = "high" | "good" | "moderate" | "low"

/**
 * 5/3/1-native doporučení (NIKDY o snižování váhy):
 *  - push_pr         → dobrý den, lze přetlačit AMRAP na rep PR
 *  - on_plan         → jeď dle plánu
 *  - grind_min_reps  → udělej předepsané minimum repů, nehoň PR, VÁHY ZŮSTÁVAJÍ
 *  - consider_deload → zvaž strukturální deload / lehčí den (rozhoduje uživatel)
 */
export type ReadinessRecommendation =
  | "push_pr"
  | "on_plan"
  | "grind_min_reps"
  | "consider_deload"

/** Příspěvek jedné komponenty do skóre */
export interface ReadinessComponent {
  /** Získané body (0 .. maxPoints) */
  points: number
  /** Maximum bodů (= váha komponenty) */
  maxPoints: number
  /** Byla komponenta vyhodnocena (měla data + případně baseline)? */
  present: boolean
}

/** Výsledné readiness skóre */
export interface ReadinessScore {
  /** Celkové skóre 0–100 (renormalizováno přes přítomné komponenty) */
  total: number
  band: ReadinessBand
  recommendation: ReadinessRecommendation
  components: {
    hrv: ReadinessComponent
    restingHr: ReadinessComponent
    sleep: ReadinessComponent
    subjective: ReadinessComponent
  }
}

// ─── Veřejné váhy ────────────────────────────────────────────────────────────

/** Veřejné váhy komponent (součet = 100). Transparentní — uživatel je vidí. */
export const READINESS_WEIGHTS = {
  hrv: 40,
  restingHr: 20,
  sleep: 20,
  subjective: 20,
} as const

// ─── Pásma ───────────────────────────────────────────────────────────────────

/**
 * Mapuje skóre 0–100 na pásmo + 5/3/1-native doporučení.
 * Prahy: 80+ high, 60–79 good, 40–59 moderate, <40 low.
 */
export function decideReadinessBand(
  total: number
): { band: ReadinessBand; recommendation: ReadinessRecommendation } {
  if (total >= 80) return { band: "high", recommendation: "push_pr" }
  if (total >= 60) return { band: "good", recommendation: "on_plan" }
  if (total >= 40) return { band: "moderate", recommendation: "grind_min_reps" }
  return { band: "low", recommendation: "consider_deload" }
}

// ─── Výpočet skóre jednotlivých komponent ─────────────────────────────────────

// Zmražená sdílená instance — vrací se jako "nepřítomná komponenta".
// Object.freeze brání tomu, aby volající omylem zmutoval sdílený singleton.
const absent: ReadinessComponent = Object.freeze({ points: 0, maxPoints: 0, present: false })

/**
 * HRV (40 b): vyžaduje baseline s sd > 0.
 *  - >= mean − 0.5 SD (vč. nad baseline) → plných 40
 *  - mean − 1 SD .. mean − 0.5 SD        → 20
 *  - < mean − 1 SD                        → 0
 */
function scoreHrv(signals: ReadinessSignals, baseline?: ReadinessBaseline): ReadinessComponent {
  const value = signals.hrvMs
  const base = baseline?.hrv
  if (value === undefined || base === undefined || base.sd <= 0) return absent
  const max = READINESS_WEIGHTS.hrv
  let points: number
  if (value >= base.mean - 0.5 * base.sd) points = max
  else if (value >= base.mean - base.sd) points = 20
  else points = 0
  return { points, maxPoints: max, present: true }
}

/**
 * Klidový tep (20 b): vyžaduje baseline.restingHr (mean > 0).
 *  - <= mean × 1.02 → 20
 *  - <= mean × 1.05 → 10
 *  - > mean × 1.05  → 0
 */
function scoreRestingHr(signals: ReadinessSignals, baseline?: ReadinessBaseline): ReadinessComponent {
  const value = signals.restingHrBpm
  const base = baseline?.restingHr
  if (value === undefined || base === undefined || base.mean <= 0) return absent
  const max = READINESS_WEIGHTS.restingHr
  let points: number
  if (value <= base.mean * 1.02) points = max
  else if (value <= base.mean * 1.05) points = 10
  else points = 0
  return { points, maxPoints: max, present: true }
}

/**
 * Spánek (20 b): nepotřebuje baseline.
 *  - >= 7 h a (kvalita nezadána nebo >= 75) → 20
 *  - >= 6 h a (kvalita nezadána nebo >= 60) → 10
 *  - jinak                                   → 0
 */
function scoreSleep(signals: ReadinessSignals): ReadinessComponent {
  const hours = signals.sleepHours
  if (hours === undefined) return absent
  const quality = signals.sleepQuality
  const max = READINESS_WEIGHTS.sleep
  let points: number
  if (hours >= 7 && (quality === undefined || quality >= 75)) points = max
  else if (hours >= 6 && (quality === undefined || quality >= 60)) points = 10
  else points = 0
  return { points, maxPoints: max, present: true }
}

/** Subjektivní pocit (20 b): great=20, normal=10, bad=0. */
function scoreSubjective(signals: ReadinessSignals): ReadinessComponent {
  const feel = signals.subjectiveFeel
  if (feel === undefined) return absent
  const max = READINESS_WEIGHTS.subjective
  const points = feel === "great" ? max : feel === "normal" ? 10 : 0
  return { points, maxPoints: max, present: true }
}

// ─── Hlavní výpočet ────────────────────────────────────────────────────────────

/**
 * Spočítá readiness skóre z dostupných signálů.
 *
 * Chybějící metriky (nebo chybějící baseline) se VYNECHAJÍ a skóre se
 * RENORMALIZUJE přes přítomné váhy na 0–100 — chybějící data nepenalizují.
 * Pokud není přítomná žádná komponenta, vrátí `null`.
 *
 * @param signals  Readiness signály pro daný den
 * @param baseline Baseline pro HRV a klidový tep (volitelné)
 * @returns ReadinessScore nebo null (žádná použitelná data)
 */
export function computeReadinessScore(
  signals: ReadinessSignals,
  baseline?: ReadinessBaseline
): ReadinessScore | null {
  const components = {
    hrv: scoreHrv(signals, baseline),
    restingHr: scoreRestingHr(signals, baseline),
    sleep: scoreSleep(signals),
    subjective: scoreSubjective(signals),
  }

  const present = Object.values(components).filter((c) => c.present)
  if (present.length === 0) return null

  const earned = present.reduce((sum, c) => sum + c.points, 0)
  const available = present.reduce((sum, c) => sum + c.maxPoints, 0)
  const total = Math.round((earned / available) * 100)

  const { band, recommendation } = decideReadinessBand(total)
  return { total, band, recommendation, components }
}

// ─── Baseline ────────────────────────────────────────────────────────────────

/** Jeden záznam historie readiness signálů */
export interface ReadinessHistoryEntry {
  /** Datum YYYY-MM-DD */
  date: string
  signals: ReadinessSignals
}

/** Minimální počet vzorků pro spolehlivý baseline metriky */
const MIN_BASELINE_SAMPLES = 3

/**
 * Sestaví baseline z historie. Okno = posledních `windowDays` ZALOGOVANÝCH
 * záznamů s datem PŘED `asOfDate` (lexikografické porovnání YYYY-MM-DD, stejně
 * jako jinde v projektu — vyhneme se aritmetice s datem a zachováme čistotu).
 *
 * Metrika je v baseline jen pokud má >= MIN_BASELINE_SAMPLES vzorků; u HRV
 * navíc jen pokud SD > 0 (jinak nelze vyhodnotit odchylku).
 *
 * @param history    Historie záznamů (libovolné pořadí)
 * @param asOfDate   Datum, ke kterému baseline počítáme (YYYY-MM-DD) — vyloučeno
 * @param windowDays Počet posledních záznamů v okně (default 7)
 */
export function computeBaseline(
  history: ReadinessHistoryEntry[],
  asOfDate: string,
  windowDays = 7
): ReadinessBaseline {
  const window = history
    .filter((e) => e.date < asOfDate)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) // sestupně dle data
    .slice(0, windowDays)

  // Filtrujeme jen konečná čísla — ochrana proti NaN/Infinity z externích
  // zdrojů (Convex / wearable API), aby nezkazily mean/SD výpočet.
  const hrvValues = window
    .map((e) => e.signals.hrvMs)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  const rhrValues = window
    .map((e) => e.signals.restingHrBpm)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))

  const baseline: ReadinessBaseline = {}

  if (hrvValues.length >= MIN_BASELINE_SAMPLES) {
    const mean = hrvValues.reduce((s, v) => s + v, 0) / hrvValues.length
    // Výběrová směrodatná odchylka (n−1)
    const variance =
      hrvValues.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (hrvValues.length - 1)
    const sd = Math.sqrt(variance)
    if (sd > 0) baseline.hrv = { mean, sd }
  }

  if (rhrValues.length >= MIN_BASELINE_SAMPLES) {
    const mean = rhrValues.reduce((s, v) => s + v, 0) / rhrValues.length
    if (mean > 0) baseline.restingHr = { mean }
  }

  return baseline
}
