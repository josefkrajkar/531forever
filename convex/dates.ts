/**
 * Sdílené date utility pro Convex mutace — validace formátu YYYY-MM-DD.
 * Centralizuje DATE_REGEX, dříve duplikovaný v bodyweight.ts, readiness.ts
 * a accessories.ts.
 */

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** Vyhodí chybu, pokud `date` neodpovídá formátu YYYY-MM-DD. */
export function assertValidDate(date: string): void {
  if (!DATE_REGEX.test(date)) {
    throw new Error("Neplatný formát data — očekáváno YYYY-MM-DD")
  }
}
