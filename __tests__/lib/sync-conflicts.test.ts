/**
 * Testy pro lib/sync-conflicts.ts — in-memory store pro sync konflikty.
 *
 * Pokrývá:
 * - pushConflict: přidání konfliktu + notifikace listenerů
 * - dismissConflict: odebrání konfliktu dle id + notifikace
 * - getConflicts: synchronní snapshot (immutable update)
 * - subscribeConflicts: subscribe/unsubscribe + notifikace
 * - Více konfliktů najednou
 * - dismiss neexistujícího id — no-op
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

import {
  pushConflict,
  dismissConflict,
  getConflicts,
  subscribeConflicts,
  _resetConflictsForTests,
} from "@/lib/sync-conflicts"
import type { OutboxItem } from "@/lib/outbox"

/** Pomocná funkce — sestaví OutboxItem s id */
function makeOutboxItem(id: number, mutationName = "programs.completeWorkout"): OutboxItem {
  return {
    id,
    mutationName,
    args: { expectedCycle: 1 },
    enqueuedAt: Date.now(),
    state: "pending",
    attempts: 0,
  }
}

beforeEach(() => {
  _resetConflictsForTests()
})

describe("sync-conflicts", () => {
  // ─── getConflicts (initial state) ────────────────────────────────────────

  describe("getConflicts — počáteční stav", () => {
    it("vrátí prázdné pole před jakýmkoli pushConflict", () => {
      expect(getConflicts()).toEqual([])
    })
  })

  // ─── pushConflict ─────────────────────────────────────────────────────────

  describe("pushConflict", () => {
    it("přidá konflikt a getConflicts jej vrátí", () => {
      const item = makeOutboxItem(42)
      pushConflict(item)

      const conflicts = getConflicts()
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].item).toBe(item)
      expect(conflicts[0].item.mutationName).toBe("programs.completeWorkout")
    })

    it("id konfliktu = item.id pokud existuje", () => {
      const item = makeOutboxItem(7)
      pushConflict(item)

      const conflicts = getConflicts()
      expect(conflicts[0].id).toBe(7)
    })

    it("id konfliktu je číslo i pokud item.id chybí (undefined)", () => {
      const item: OutboxItem = {
        mutationName: "programs.completeWorkout",
        args: {},
        enqueuedAt: Date.now(),
        state: "pending",
        attempts: 0,
        // id záměrně vynecháno
      }
      pushConflict(item)

      const conflicts = getConflicts()
      expect(typeof conflicts[0].id).toBe("number")
    })

    it("detectedAt je nastaven na aktuální čas", () => {
      const before = Date.now()
      pushConflict(makeOutboxItem(1))
      const after = Date.now()

      const conflicts = getConflicts()
      expect(conflicts[0].detectedAt).toBeGreaterThanOrEqual(before)
      expect(conflicts[0].detectedAt).toBeLessThanOrEqual(after)
    })

    it("více pushConflict → více konfliktů v poli", () => {
      pushConflict(makeOutboxItem(1, "programs.completeWorkout"))
      pushConflict(makeOutboxItem(2, "programs.saveAmrapResult"))

      const conflicts = getConflicts()
      expect(conflicts).toHaveLength(2)
      expect(conflicts[0].item.mutationName).toBe("programs.completeWorkout")
      expect(conflicts[1].item.mutationName).toBe("programs.saveAmrapResult")
    })

    it("pushConflict vrátí nové pole (immutable update) — reference se změní", () => {
      const before = getConflicts()
      pushConflict(makeOutboxItem(1))
      const after = getConflicts()

      expect(after).not.toBe(before)
    })

    it("pushConflict notifikuje listener", () => {
      const listener = vi.fn()
      const unsubscribe = subscribeConflicts(listener)

      pushConflict(makeOutboxItem(1))
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })
  })

  // ─── dismissConflict ─────────────────────────────────────────────────────

  describe("dismissConflict", () => {
    it("odstraní konflikt dle id", () => {
      pushConflict(makeOutboxItem(10))
      pushConflict(makeOutboxItem(20))

      expect(getConflicts()).toHaveLength(2)

      dismissConflict(10)

      const remaining = getConflicts()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe(20)
    })

    it("dismiss posledního konfliktu → prázdné pole", () => {
      pushConflict(makeOutboxItem(5))
      dismissConflict(5)

      expect(getConflicts()).toEqual([])
    })

    it("dismiss neexistujícího id — no-op, žádná notifikace", () => {
      pushConflict(makeOutboxItem(1))

      const listener = vi.fn()
      const unsubscribe = subscribeConflicts(listener)

      dismissConflict(99999) // neexistující id
      expect(listener).not.toHaveBeenCalled()
      expect(getConflicts()).toHaveLength(1)

      unsubscribe()
    })

    it("dismissConflict notifikuje listener", () => {
      pushConflict(makeOutboxItem(1))

      const listener = vi.fn()
      const unsubscribe = subscribeConflicts(listener)

      dismissConflict(1)
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it("dismissConflict vrátí nové pole (immutable update)", () => {
      pushConflict(makeOutboxItem(1))
      pushConflict(makeOutboxItem(2))

      const before = getConflicts()
      dismissConflict(1)
      const after = getConflicts()

      expect(after).not.toBe(before)
    })
  })

  // ─── subscribeConflicts ──────────────────────────────────────────────────

  describe("subscribeConflicts", () => {
    it("subscribe vrátí unsubscribe funkci", () => {
      const unsubscribe = subscribeConflicts(() => {})
      expect(typeof unsubscribe).toBe("function")
      unsubscribe()
    })

    it("unsubscribe zabrání dalším notifikacím", () => {
      const listener = vi.fn()
      const unsubscribe = subscribeConflicts(listener)

      pushConflict(makeOutboxItem(1))
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()

      pushConflict(makeOutboxItem(2))
      // Listener nesmí být volán po unsubscribe
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it("více listenerů dostane notifikaci", () => {
      const l1 = vi.fn()
      const l2 = vi.fn()
      const unsub1 = subscribeConflicts(l1)
      const unsub2 = subscribeConflicts(l2)

      pushConflict(makeOutboxItem(1))
      expect(l1).toHaveBeenCalledTimes(1)
      expect(l2).toHaveBeenCalledTimes(1)

      unsub1()
      unsub2()
    })

    it("getConflicts po pushConflict vrátí aktuální snapshot", () => {
      let snapshot = getConflicts()
      expect(snapshot).toHaveLength(0)

      subscribeConflicts(() => {
        snapshot = getConflicts()
      })

      pushConflict(makeOutboxItem(1))
      expect(snapshot).toHaveLength(1)
    })
  })
})
