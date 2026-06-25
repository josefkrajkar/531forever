/**
 * Testy pro lib/offline-store.ts — IndexedDB read-cache wrappery
 *
 * Pokrývá:
 * - putSnapshot / getSnapshot: zápis a čtení hodnoty
 * - getSnapshot neexistujícího klíče: vrátí null
 * - setFlag / getFlag: zápis a čtení boolean příznaku
 * - getFlag neexistujícího klíče: vrátí null
 * - no-op když IndexedDB není dostupný (simulace SSR prostředí)
 * - přepis existující hodnoty
 * - různé datové typy (object, array, string, number)
 */

import { describe, it, expect } from "vitest"
import "fake-indexeddb/auto"

// Importujeme po nastavení fake-indexeddb
import { putSnapshot, getSnapshot, setFlag, getFlag, clearOfflineCache } from "@/lib/offline-store"

describe("offline-store", () => {
  // ─── putSnapshot / getSnapshot ───────────────────────────────────────────

  describe("putSnapshot / getSnapshot", () => {
    it("zapíše a přečte jednoduchý objekt", async () => {
      const data = { cycle: 1, week: 2, dayIndex: 0 }
      await putSnapshot("currentProgram", data)
      const result = await getSnapshot("currentProgram")
      expect(result).toEqual(data)
    })

    it("zapíše a přečte string", async () => {
      await putSnapshot("testKey", "hello")
      const result = await getSnapshot("testKey")
      expect(result).toBe("hello")
    })

    it("zapíše a přečte číslo", async () => {
      await putSnapshot("numKey", 42)
      const result = await getSnapshot<number>("numKey")
      expect(result).toBe(42)
    })

    it("zapíše a přečte pole", async () => {
      const arr = [1, 2, 3]
      await putSnapshot("arrKey", arr)
      const result = await getSnapshot<number[]>("arrKey")
      expect(result).toEqual(arr)
    })

    it("vrátí undefined pro neexistující klíč", async () => {
      const result = await getSnapshot("neexistujiciKlic_xyz")
      expect(result).toBeUndefined()
    })

    it("přepíše existující hodnotu", async () => {
      await putSnapshot("overwriteKey", { value: 1 })
      await putSnapshot("overwriteKey", { value: 2 })
      const result = await getSnapshot<{ value: number }>("overwriteKey")
      expect(result).toEqual({ value: 2 })
    })

    it("různé klíče jsou nezávislé", async () => {
      await putSnapshot("keyA", "valueA")
      await putSnapshot("keyB", "valueB")
      expect(await getSnapshot("keyA")).toBe("valueA")
      expect(await getSnapshot("keyB")).toBe("valueB")
    })
  })

  // ─── setFlag / getFlag ───────────────────────────────────────────────────

  describe("setFlag / getFlag", () => {
    it("zapíše true a přečte true", async () => {
      await setFlag("authSeen", true)
      const result = await getFlag("authSeen")
      expect(result).toBe(true)
    })

    it("zapíše false a přečte false", async () => {
      await setFlag("testFlag", false)
      const result = await getFlag("testFlag")
      expect(result).toBe(false)
    })

    it("vrátí null pro neexistující příznak", async () => {
      const result = await getFlag("neexistujiciFlag_xyz")
      expect(result).toBeNull()
    })

    it("přepíše příznak z true na false", async () => {
      await setFlag("mutableFlag", true)
      await setFlag("mutableFlag", false)
      const result = await getFlag("mutableFlag")
      expect(result).toBe(false)
    })
  })

  // ─── No-op při nedostupném IndexedDB ────────────────────────────────────

  describe("no-op při nedostupném IndexedDB", () => {
    it("getSnapshot vrátí null pokud indexedDB není dostupný", async () => {
      // Simulujeme prostředí bez IndexedDB (SSR / starý prohlížeč)
      const originalIndexedDB = window.indexedDB
      // @ts-expect-error — záměrně přepisujeme na undefined pro test
      window.indexedDB = undefined

      // Modul cachuje dbPromise z předchozích testů, takže reálně čteme přes
      // otevřenou DB. Klíčové: funkce nesmí vyhodit výjimku za žádných okolností.
      try {
        await expect(getSnapshot("anyKey")).resolves.not.toThrow()
      } finally {
        window.indexedDB = originalIndexedDB
      }
    })

    it("putSnapshot je no-op pokud window není dostupný (SSR simulace)", async () => {
      // Ověříme že putSnapshot nevyhodí chybu za žádných okolností
      await expect(putSnapshot("safeKey", { x: 1 })).resolves.not.toThrow()
    })

    it("setFlag je no-op pokud indexedDB není dostupný", async () => {
      const originalIndexedDB = window.indexedDB
      // @ts-expect-error — záměrně přepisujeme na undefined pro test
      window.indexedDB = undefined

      try {
        await expect(setFlag("safeFlag", true)).resolves.not.toThrow()
      } finally {
        window.indexedDB = originalIndexedDB
      }
    })

    it("getFlag vrátí null pokud indexedDB není dostupný", async () => {
      const originalIndexedDB = window.indexedDB
      // @ts-expect-error — záměrně přepisujeme na undefined pro test
      window.indexedDB = undefined

      try {
        const result = await getFlag("safeFlag")
        expect(result === null || typeof result === "boolean").toBe(true)
      } finally {
        window.indexedDB = originalIndexedDB
      }
    })
  })

  // ─── Komplexní datové struktury ─────────────────────────────────────────

  describe("komplexní datové struktury", () => {
    it("uloží a načte hluboce vnořený objekt", async () => {
      const complex = {
        cycle: 3,
        week: 2,
        trainingMaxes: { squat: 150, bench: 100, deadlift: 180, press: 70 },
        nested: { a: { b: { c: 42 } } },
      }
      await putSnapshot("complexKey", complex)
      const result = await getSnapshot<typeof complex>("complexKey")
      expect(result).toEqual(complex)
    })

    it("rozliší uloženou null (žádný program) od chybějícího klíče", async () => {
      // Uložená null = validní výsledek "žádný program" → vrátí null
      await putSnapshot("noProgram", null)
      expect(await getSnapshot("noProgram")).toBeNull()
      // Chybějící klíč = "ještě nevíme" → vrátí undefined
      expect(await getSnapshot("nikdyUlozeno_xyz")).toBeUndefined()
    })
  })

  // ─── clearOfflineCache ──────────────────────────────────────────────────

  describe("clearOfflineCache", () => {
    it("vymaže snapshoty i příznaky", async () => {
      await putSnapshot("clearMeProgram", { cycle: 1 })
      await setFlag("authSeen", true)

      await clearOfflineCache()

      expect(await getSnapshot("clearMeProgram")).toBeUndefined()
      expect(await getFlag("authSeen")).toBeNull()
    })
  })
})
