/**
 * Testy pro lib/outbox.ts — perzistentní FIFO fronta mutací.
 *
 * Pokrývá:
 * - enqueue → getAll FIFO pořadí (autoIncrement klíč)
 * - remove: odstranění konkrétní položky
 * - update: patch existující položky (state, attempts, lastError)
 * - count: počet položek
 * - clearOutbox: vymazání celé fronty
 * - "persistence" — data přežijí nové volání getAll (simulace reload)
 * - no-op bez IndexedDB (SSR simulace)
 * - pendingCount pub/sub: synchronní getter + subscribe notifikace
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import "fake-indexeddb/auto"

// Import po nastavení fake-indexeddb
import {
  enqueue,
  getAll,
  remove,
  update,
  count,
  clearOutbox,
  _resetDbForTests,
  getPendingSnapshot,
  subscribePending,
  initPendingCount,
  _resetPendingCountForTests,
} from "@/lib/outbox"
import type { OutboxItem } from "@/lib/outbox"

/** Pomocná funkce — sestaví OutboxItem bez id */
function makeItem(mutationName: string, args: Record<string, unknown> = {}): Omit<OutboxItem, "id"> {
  return {
    mutationName,
    args,
    enqueuedAt: Date.now(),
    state: "pending",
    attempts: 0,
  }
}

beforeEach(async () => {
  // Vymažeme outbox před každým testem pro izolaci
  await clearOutbox()
  // Reset in-memory pendingCount pro izolaci testů
  _resetPendingCountForTests()
})

describe("outbox", () => {
  // ─── enqueue / getAll ────────────────────────────────────────────────────

  describe("enqueue / getAll", () => {
    it("enqueue přidá položku a getAll ji vrátí", async () => {
      const id = await enqueue(makeItem("programs.completeWorkout", { cycle: 1 }))
      expect(id).toBeGreaterThan(0)

      const items = await getAll()
      expect(items).toHaveLength(1)
      expect(items[0].mutationName).toBe("programs.completeWorkout")
      expect(items[0].args).toEqual({ cycle: 1 })
      expect(items[0].state).toBe("pending")
      expect(items[0].attempts).toBe(0)
      expect(items[0].id).toBe(id)
    })

    it("FIFO pořadí — getAll vrátí položky vzestupně dle id", async () => {
      await enqueue(makeItem("first"))
      await enqueue(makeItem("second"))
      await enqueue(makeItem("third"))

      const items = await getAll()
      expect(items).toHaveLength(3)
      // Pořadí musí odpovídat pořadí vložení
      expect(items[0].mutationName).toBe("first")
      expect(items[1].mutationName).toBe("second")
      expect(items[2].mutationName).toBe("third")
      // ID musí být vzestupné
      expect(items[0].id!).toBeLessThan(items[1].id!)
      expect(items[1].id!).toBeLessThan(items[2].id!)
    })

    it("prázdná fronta → getAll vrátí prázdné pole", async () => {
      const items = await getAll()
      expect(items).toEqual([])
    })

    it("enqueue zachová všechna pole položky", async () => {
      const now = Date.now()
      const id = await enqueue({
        mutationName: "users.updateAthleteProfile",
        args: { name: "Pavel", weight: 90 },
        enqueuedAt: now,
        state: "pending",
        attempts: 0,
      })

      const items = await getAll()
      expect(items[0]).toMatchObject({
        id,
        mutationName: "users.updateAthleteProfile",
        args: { name: "Pavel", weight: 90 },
        enqueuedAt: now,
        state: "pending",
        attempts: 0,
      })
    })
  })

  // ─── remove ──────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("odstraní položku dle id", async () => {
      const id1 = await enqueue(makeItem("first"))
      const id2 = await enqueue(makeItem("second"))

      await remove(id1)

      const items = await getAll()
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe(id2)
      expect(items[0].mutationName).toBe("second")
    })

    it("remove neexistujícího id je no-op (nevyhodí chybu)", async () => {
      await enqueue(makeItem("test"))
      await expect(remove(99999)).resolves.toBeUndefined()
      expect(await getAll()).toHaveLength(1)
    })

    it("po odebrání všech položek je fronta prázdná", async () => {
      const id1 = await enqueue(makeItem("a"))
      const id2 = await enqueue(makeItem("b"))

      await remove(id1)
      await remove(id2)

      expect(await getAll()).toEqual([])
    })
  })

  // ─── update ──────────────────────────────────────────────────────────────

  describe("update", () => {
    it("aktualizuje state na failed", async () => {
      const id = await enqueue(makeItem("programs.completeWorkout"))

      await update(id, { state: "failed", attempts: 1, lastError: "Síťová chyba" })

      const items = await getAll()
      expect(items[0].state).toBe("failed")
      expect(items[0].attempts).toBe(1)
      expect(items[0].lastError).toBe("Síťová chyba")
    })

    it("update zachová ostatní pole beze změny", async () => {
      const item = makeItem("bodyweight.logBodyweight", { weight: 75 })
      const id = await enqueue(item)

      await update(id, { attempts: 2 })

      const items = await getAll()
      expect(items[0].mutationName).toBe("bodyweight.logBodyweight")
      expect(items[0].args).toEqual({ weight: 75 })
      expect(items[0].state).toBe("pending") // nezměněno
      expect(items[0].attempts).toBe(2) // změněno
    })

    it("update neexistujícího id je no-op (nevyhodí chybu)", async () => {
      await expect(update(99999, { state: "failed" })).resolves.toBeUndefined()
    })

    it("patch bez lastError nenechá undefined v záznamu", async () => {
      const id = await enqueue(makeItem("test"))
      await update(id, { state: "failed", attempts: 1, lastError: "první chyba" })
      // Druhý update — přepíše lastError
      await update(id, { lastError: "druhá chyba" })

      const items = await getAll()
      expect(items[0].lastError).toBe("druhá chyba")
    })
  })

  // ─── count ───────────────────────────────────────────────────────────────

  describe("count", () => {
    it("počítá položky správně", async () => {
      expect(await count()).toBe(0)

      await enqueue(makeItem("a"))
      expect(await count()).toBe(1)

      await enqueue(makeItem("b"))
      await enqueue(makeItem("c"))
      expect(await count()).toBe(3)
    })

    it("po remove klesne count", async () => {
      const id = await enqueue(makeItem("test"))
      expect(await count()).toBe(1)

      await remove(id)
      expect(await count()).toBe(0)
    })
  })

  // ─── clearOutbox ─────────────────────────────────────────────────────────

  describe("clearOutbox", () => {
    it("vymaže všechny položky", async () => {
      await enqueue(makeItem("a"))
      await enqueue(makeItem("b"))
      await enqueue(makeItem("c"))

      expect(await count()).toBe(3)

      await clearOutbox()

      expect(await count()).toBe(0)
      expect(await getAll()).toEqual([])
    })

    it("clearOutbox na prázdné frontě je no-op", async () => {
      await expect(clearOutbox()).resolves.toBeUndefined()
      expect(await count()).toBe(0)
    })
  })

  // ─── Persistence (simulace reload) ──────────────────────────────────────

  describe("persistence (data přežijí napříč voláními)", () => {
    it("data vložená dříve jsou dostupná při novém getAll (IndexedDB perzistuje)", async () => {
      // Vloží data
      await enqueue(makeItem("programs.setTrainingMax", { lift: "squat", value: 150 }))
      await enqueue(makeItem("accessories.logAccessory", { accessoryId: "pull-up" }))

      // Simulace "reload" — reset singleton, nové getAll otevře DB znovu
      _resetDbForTests()

      const items = await getAll()
      expect(items).toHaveLength(2)
      expect(items[0].mutationName).toBe("programs.setTrainingMax")
      expect(items[1].mutationName).toBe("accessories.logAccessory")
    })

    it("FIFO pořadí přežije reset singletonu", async () => {
      for (let i = 0; i < 5; i++) {
        await enqueue(makeItem(`mutation_${i}`))
      }

      _resetDbForTests()

      const items = await getAll()
      expect(items).toHaveLength(5)
      // ID musí být vzestupné (FIFO zachováno)
      for (let i = 1; i < items.length; i++) {
        expect(items[i].id!).toBeGreaterThan(items[i - 1].id!)
      }
    })
  })

  // ─── No-op bez IndexedDB ─────────────────────────────────────────────────

  describe("no-op bez IndexedDB (SSR simulace)", () => {
    it("enqueue vrátí -1 pokud indexedDB není dostupný", async () => {
      // Resetujeme singleton aby nové volání prošlo přes isIndexedDbAvailable check
      _resetDbForTests()
      const originalIndexedDB = window.indexedDB
      // @ts-expect-error — záměrně přepisujeme pro test
      window.indexedDB = undefined

      try {
        const id = await enqueue(makeItem("test"))
        expect(id).toBe(-1)
      } finally {
        window.indexedDB = originalIndexedDB
        _resetDbForTests() // reset aby další testy mohly otevřít DB
      }
    })

    it("getAll vrátí [] pokud indexedDB není dostupný", async () => {
      _resetDbForTests()
      const originalIndexedDB = window.indexedDB
      // @ts-expect-error
      window.indexedDB = undefined

      try {
        const items = await getAll()
        expect(items).toEqual([])
      } finally {
        window.indexedDB = originalIndexedDB
        _resetDbForTests()
      }
    })

    it("count vrátí 0 pokud indexedDB není dostupný", async () => {
      _resetDbForTests()
      const originalIndexedDB = window.indexedDB
      // @ts-expect-error
      window.indexedDB = undefined

      try {
        const n = await count()
        expect(n).toBe(0)
      } finally {
        window.indexedDB = originalIndexedDB
        _resetDbForTests()
      }
    })

    it("clearOutbox je no-op pokud indexedDB není dostupný (nevyhodí chybu)", async () => {
      _resetDbForTests()
      const originalIndexedDB = window.indexedDB
      // @ts-expect-error
      window.indexedDB = undefined

      try {
        await expect(clearOutbox()).resolves.toBeUndefined()
      } finally {
        window.indexedDB = originalIndexedDB
        _resetDbForTests()
      }
    })
  })

  // ─── pendingCount pub/sub ────────────────────────────────────────────────

  describe("pendingCount pub/sub", () => {
    it("getPendingSnapshot vrátí 0 před jakoukoli operací", () => {
      expect(getPendingSnapshot()).toBe(0)
    })

    it("enqueue inkrementuje pendingCount synchronně", async () => {
      expect(getPendingSnapshot()).toBe(0)
      await enqueue(makeItem("programs.completeWorkout"))
      expect(getPendingSnapshot()).toBe(1)
      await enqueue(makeItem("bodyweight.logBodyweight"))
      expect(getPendingSnapshot()).toBe(2)
    })

    it("remove dekrementuje pendingCount synchronně", async () => {
      const id1 = await enqueue(makeItem("first"))
      const id2 = await enqueue(makeItem("second"))
      expect(getPendingSnapshot()).toBe(2)

      await remove(id1)
      expect(getPendingSnapshot()).toBe(1)

      await remove(id2)
      expect(getPendingSnapshot()).toBe(0)
    })

    it("clearOutbox resetuje pendingCount na 0", async () => {
      await enqueue(makeItem("a"))
      await enqueue(makeItem("b"))
      expect(getPendingSnapshot()).toBe(2)

      await clearOutbox()
      expect(getPendingSnapshot()).toBe(0)
    })

    it("subscribePending notifikuje listener při enqueue", async () => {
      const listener = vi.fn()
      const unsubscribe = subscribePending(listener)

      await enqueue(makeItem("programs.completeWorkout"))
      expect(listener).toHaveBeenCalledTimes(1)

      await enqueue(makeItem("bodyweight.logBodyweight"))
      expect(listener).toHaveBeenCalledTimes(2)

      unsubscribe()
    })

    it("subscribePending notifikuje listener při remove", async () => {
      const id = await enqueue(makeItem("test"))

      const listener = vi.fn()
      const unsubscribe = subscribePending(listener)

      await remove(id)
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it("subscribePending notifikuje listener při clearOutbox", async () => {
      await enqueue(makeItem("a"))
      await enqueue(makeItem("b"))

      const listener = vi.fn()
      const unsubscribe = subscribePending(listener)

      await clearOutbox()
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it("unsubscribe zabrání dalším notifikacím", async () => {
      const listener = vi.fn()
      const unsubscribe = subscribePending(listener)

      await enqueue(makeItem("first"))
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()

      await enqueue(makeItem("second"))
      // Listener nesmí být volán po unsubscribe
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it("více listenerů dostane notifikaci", async () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      const unsub1 = subscribePending(listener1)
      const unsub2 = subscribePending(listener2)

      await enqueue(makeItem("test"))
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)

      unsub1()
      unsub2()
    })

    it("initPendingCount načte aktuální stav z IndexedDB", async () => {
      // Přidáme položky přímo přes enqueue (pendingCount se inkrementuje)
      await enqueue(makeItem("a"))
      await enqueue(makeItem("b"))
      await enqueue(makeItem("c"))

      // Reset in-memory counteru — simulace návratu po reload/SSR
      _resetPendingCountForTests()
      expect(getPendingSnapshot()).toBe(0) // reset proběhl

      // Inicializuj z DB
      await initPendingCount()
      expect(getPendingSnapshot()).toBe(3)
    })

    it("pendingCount neklesne pod 0 při remove na prázdné frontě", async () => {
      // Fronta je prázdná, counter je 0 — remove neexistujícího ID nesmí způsobit podtečení
      await remove(99999)
      expect(getPendingSnapshot()).toBe(0)
    })
  })
})
