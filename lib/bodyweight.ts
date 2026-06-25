/**
 * Čisté funkce pro práci s bodyweight time series.
 * Bez závislostí na Convex — testovatelné izolovaně.
 */

interface BodyweightLog {
  date: string   // YYYY-MM-DD
  weightKg: number
}

/**
 * Vrátí tělesnou váhu platnou k danému datu.
 *
 * Algoritmus (v pořadí priority):
 * 1. Přesná shoda pro `date`
 * 2. Nejbližší log s datem <= date (nejnovější z minulosti)
 * 3. Nejbližší log s datem > date (nejstarší z budoucnosti)
 * 4. `fallback` (statická váha z profilu — pro uživatele bez logů)
 *
 * Předpokládá, že `logs` jsou seřazeny vzestupně dle data (tak je vrací
 * getBodyweightHistory), ale správně pracuje i s neseřazenými.
 *
 * @param logs - pole { date: YYYY-MM-DD, weightKg: number }
 * @param date - cílové datum YYYY-MM-DD
 * @param fallback - váha z athleteProfile.weight (fallback bez logů)
 */
export function weightAtDate(
  logs: BodyweightLog[],
  date: string,
  fallback: number
): number {
  if (logs.length === 0) return fallback

  // 1. Přesná shoda
  const exact = logs.find((l) => l.date === date)
  if (exact) return exact.weightKg

  // 2. Nejbližší log s datem <= date (nejnovější z minulosti nebo přesný)
  let bestPast: BodyweightLog | null = null
  for (const log of logs) {
    if (log.date <= date) {
      if (!bestPast || log.date > bestPast.date) {
        bestPast = log
      }
    }
  }
  if (bestPast) return bestPast.weightKg

  // 3. Nejbližší log s datem > date (nejstarší z budoucnosti)
  let bestFuture: BodyweightLog | null = null
  for (const log of logs) {
    if (log.date > date) {
      if (!bestFuture || log.date < bestFuture.date) {
        bestFuture = log
      }
    }
  }
  if (bestFuture) return bestFuture.weightKg

  // 4. Fallback
  return fallback
}
