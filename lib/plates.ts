/**
 * Plate Calculator — rozpad váhy na kotouče
 *
 * Čistá, deterministická funkce bez vedlejších efektů.
 * Používá greedy algoritmus (od nejtěžšího kotouče).
 */

/** Výsledek rozpadu váhy na kotouče */
export interface PlateResult {
  /** Kotouče NA JEDNU STRANU tyče (seřazeno od nejtěžšího) */
  plates: { weight: number; count: number }[]
  /** Skutečně dosažitelná váha (= tyč + 2 × součet kotoučů na jednu stranu).
   *  Může být nižší než target, pokud váha není přesně složitelná. */
  achievableWeight: number
  /** Rozdíl target − achievableWeight (≥ 0). 0 = přesně složitelné. */
  residual: number
  /** true = cíl je NIŽŠÍ než váha tyče → na této tyči nedosažitelné
   *  (nutná lehčí tyč nebo jednoručky). Cíl === váha tyče je belowBar false. */
  belowBar: boolean
}

/** Výchozí sada kotoučů dostupných v gym (kg, NA STRANU) */
export const DEFAULT_PLATES: number[] = [25, 20, 15, 10, 5, 2.5, 1.25]

/**
 * Rozloží cílovou váhu na kotouče na jednu stranu tyče.
 *
 * @param targetWeight  Cílová celková váha (kg) — tyč + kotouče na obou stranách
 * @param barWeight     Váha tyče (kg), výchozí 20 kg
 * @param availablePlates  Dostupné kotouče (kg), výchozí DEFAULT_PLATES; každý kotoučový typ
 *                         se považuje za neomezený počet kusů
 * @returns PlateResult — kotouče NA JEDNU STRANU, achievableWeight, residual
 *
 * Edge cases:
 * - targetWeight === barWeight → prázdná tyč (belowBar false)
 * - targetWeight < barWeight → belowBar true (nutná lehčí tyč / jednoručky)
 * - záporná / NaN / Infinity → prázdný výsledek (achievableWeight = barWeight)
 */
export function calculatePlates(
  targetWeight: number,
  barWeight = 20,
  availablePlates: number[] = DEFAULT_PLATES,
): PlateResult {
  // Defenzivní guard — neplatné vstupy
  const safeBar = Number.isFinite(barWeight) && barWeight > 0 ? barWeight : 20
  const emptyResult: PlateResult = {
    plates: [],
    achievableWeight: safeBar,
    residual: 0,
    belowBar: false,
  }

  if (!Number.isFinite(targetWeight) || targetWeight <= 0) {
    return emptyResult
  }

  // Cíl NIŽŠÍ než tyč → na této tyči nedosažitelné (lehčí tyč / jednoručky)
  if (targetWeight < safeBar) {
    return { plates: [], achievableWeight: safeBar, residual: 0, belowBar: true }
  }

  // Cíl == tyč → prázdná tyč (legitimní "jen tyč")
  if (targetWeight === safeBar) {
    return { plates: [], achievableWeight: safeBar, residual: 0, belowBar: false }
  }

  // Váha na jednu stranu
  const oneSide = (targetWeight - safeBar) / 2

  // Seřad kotouče od nejtěžšího
  const sorted = [...availablePlates]
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => b - a)

  // Greedy rozpad
  const plateMap = new Map<number, number>()
  let remaining = oneSide

  for (const plate of sorted) {
    if (remaining <= 0) break
    // Kolik kusů tohoto kotouče se vejde (zaokrouhlit dolů)
    const count = Math.floor(remaining / plate + 1e-9) // malá epsilon tolerance pro floating point
    if (count > 0) {
      plateMap.set(plate, count)
      remaining -= plate * count
    }
  }

  // Zbývající residual (na jednu stranu → celková tyč zbytek = 2×)
  const achievableWeight = targetWeight - remaining * 2

  // Sestavení výsledku (seřazeno od nejtěžšího)
  const plates = sorted
    .filter((p) => plateMap.has(p))
    .map((p) => ({ weight: p, count: plateMap.get(p)! }))

  return {
    plates,
    achievableWeight: Math.round(achievableWeight * 1000) / 1000, // floating-point cleanup
    residual: Math.round(remaining * 2 * 1000) / 1000,
    belowBar: false,
  }
}
