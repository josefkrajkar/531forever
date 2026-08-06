/**
 * Testy pro lib/sync-failures.ts — in-memory store pro dead-letter sync selhání.
 *
 * Pokrývá:
 * - pushFailure: přidání selhání + notifikace listenerů
 * - dismissFailure: odebrání selhání dle id + notifikace
 * - getFailures: synchronní snapshot (immutable update)
 * - subscribeFailures: subscribe/unsubscribe + notifikace
 * - Více selhání najednou
 * - dismiss neexistujícího id — no-op
 * - retryFailure: reset outbox položky na pending + dismiss + flushNow()
 * - discardFailure: odstranění outbox položky + dismiss
 *
 * lib/sync-runtime.ts je mockován — retryFailure interně volá flushNow(),
 * což by jinak přes singleton ConvexReactClient zkoušelo skutečné síťové
 * volání. Mock zabrání síťové závislosti v unit testu.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import "fake-indexeddb/auto"

vi.mock("@/lib/sync-runtime", () => ({
  flushNow: vi.fn(async () => {}),
}))

import {
  pushFailure,
  dismissFailure,
  getFailures,
  subscribeFailures,
  retryFailure,
  discardFailure,
  _resetFailuresForTests,
} from "@/lib/sync-failures"
import { flushNow } from "@/lib/sync-runtime"
import { enqueue, getAll, getDeadLetters, clearOutbox, _resetDbForTests } from "@/lib/outbox"
import type { OutboxItem } from "@/lib/outbox"

/** Pomocná funkce — sestaví OutboxItem s id */
function makeOutboxItem(id: number, mutationName = "programs.completeWorkout"): OutboxItem {
  return {
    id,
    mutationName,
    args: { expectedCycle: 1 },
    enqueuedAt: Date.now(),
    state: "dead",
    attempts: 5,
  }
}

/** Pomocná funkce — sestaví OutboxItem bez id, pro enqueue */
function makeDeadItem(mutationName: string, args: Record<string, unknown> = {}): Omit<OutboxItem, "id"> {
  return {
    mutationName,
    args,
    enqueuedAt: Date.now(),
    state: "dead",
    attempts: 5,
    lastError: "vyčerpány pokusy",
  }
}

beforeEach(async () => {
  _resetFailuresForTests()
  _resetDbForTests()
  await clearOutbox()
  vi.mocked(flushNow).mockClear()
})

describe("sync-failures", () => {
  // ─── getFailures (initial state) ─────────────────────────────────────────

  describe("getFailures — počáteční stav", () => {
    it("vrátí prázdné pole před jakýmkoli pushFailure", () => {
      expect(getFailures()).toEqual([])
    })
  })

  // ─── pushFailure ──────────────────────────────────────────────────────────

  describe("pushFailure", () => {
    it("přidá selhání a getFailures jej vrátí", () => {
      const item = makeOutboxItem(42)
      pushFailure(item)

      const failures = getFailures()
      expect(failures).toHaveLength(1)
      expect(failures[0].item).toBe(item)
      expect(failures[0].item.mutationName).toBe("programs.completeWorkout")
    })

    it("id selhání = item.id pokud existuje", () => {
      const item = makeOutboxItem(7)
      pushFailure(item)

      const failures = getFailures()
      expect(failures[0].id).toBe(7)
    })

    it("id selhání je číslo i pokud item.id chybí (undefined)", () => {
      const item: OutboxItem = {
        mutationName: "programs.completeWorkout",
        args: {},
        enqueuedAt: Date.now(),
        state: "dead",
        attempts: 5,
        // id záměrně vynecháno
      }
      pushFailure(item)

      const failures = getFailures()
      expect(typeof failures[0].id).toBe("number")
    })

    it("detectedAt je nastaven na aktuální čas", () => {
      const before = Date.now()
      pushFailure(makeOutboxItem(1))
      const after = Date.now()

      const failures = getFailures()
      expect(failures[0].detectedAt).toBeGreaterThanOrEqual(before)
      expect(failures[0].detectedAt).toBeLessThanOrEqual(after)
    })

    it("více pushFailure → více selhání v poli", () => {
      pushFailure(makeOutboxItem(1, "programs.completeWorkout"))
      pushFailure(makeOutboxItem(2, "programs.saveAmrapResult"))

      const failures = getFailures()
      expect(failures).toHaveLength(2)
      expect(failures[0].item.mutationName).toBe("programs.completeWorkout")
      expect(failures[1].item.mutationName).toBe("programs.saveAmrapResult")
    })

    it("pushFailure vrátí nové pole (immutable update) — reference se změní", () => {
      const before = getFailures()
      pushFailure(makeOutboxItem(1))
      const after = getFailures()

      expect(after).not.toBe(before)
    })

    it("pushFailure notifikuje listener", () => {
      const listener = vi.fn()
      const unsubscribe = subscribeFailures(listener)

      pushFailure(makeOutboxItem(1))
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it("stejné id puštěné dvakrát (tatáž reference) → jen jeden záznam", () => {
      const item = makeOutboxItem(99)
      pushFailure(item)
      pushFailure(item)

      const failures = getFailures()
      expect(failures).toHaveLength(1)
      expect(failures[0].item).toBe(item)
    })

    it("stejné id, ale dva různé objekty (např. dvě čtení z outboxu) → jen jeden záznam", () => {
      const first = makeOutboxItem(55)
      const second = makeOutboxItem(55)
      pushFailure(first)
      pushFailure(second)

      expect(getFailures()).toHaveLength(1)
      // Zachová se první vložený záznam — druhé volání je no-op
      expect(getFailures()[0].item).toBe(first)
    })

    it("duplicitní pushFailure nenotifikuje listener podruhé", () => {
      const item = makeOutboxItem(3)
      const listener = vi.fn()
      const unsubscribe = subscribeFailures(listener)

      pushFailure(item)
      pushFailure(item)

      expect(listener).toHaveBeenCalledTimes(1)
      unsubscribe()
    })
  })

  // ─── Rehydratace (idempotence napříč voláními) ───────────────────────────
  //
  // lib/sync-runtime.rehydrateDeadLetters() dělá přesně tuto smyčku
  // (getDeadLetters + pushFailure pro každou položku). sync-runtime je zde
  // plně mockován (viz komentář v hlavě souboru — singleton ConvexReactClient),
  // takže smyčku simulujeme přímo nad reálným outboxem/pushFailure.

  describe("rehydratace dead-letterů — idempotence", () => {
    it("rehydratace stejné dead-letter položky dvakrát → jeden záznam ve store", async () => {
      await enqueue(makeDeadItem("programs.completeWorkout"))

      const firstPass = await getDeadLetters()
      for (const item of firstPass) pushFailure(item)

      const secondPass = await getDeadLetters()
      for (const item of secondPass) pushFailure(item)

      expect(getFailures()).toHaveLength(1)
    })
  })

  // ─── dismissFailure ───────────────────────────────────────────────────────

  describe("dismissFailure", () => {
    it("odstraní selhání dle id", () => {
      pushFailure(makeOutboxItem(10))
      pushFailure(makeOutboxItem(20))

      expect(getFailures()).toHaveLength(2)

      dismissFailure(10)

      const remaining = getFailures()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe(20)
    })

    it("dismiss posledního selhání → prázdné pole", () => {
      pushFailure(makeOutboxItem(5))
      dismissFailure(5)

      expect(getFailures()).toEqual([])
    })

    it("dismiss neexistujícího id — no-op, žádná notifikace", () => {
      pushFailure(makeOutboxItem(1))

      const listener = vi.fn()
      const unsubscribe = subscribeFailures(listener)

      dismissFailure(99999) // neexistující id
      expect(listener).not.toHaveBeenCalled()
      expect(getFailures()).toHaveLength(1)

      unsubscribe()
    })

    it("dismissFailure notifikuje listener", () => {
      pushFailure(makeOutboxItem(1))

      const listener = vi.fn()
      const unsubscribe = subscribeFailures(listener)

      dismissFailure(1)
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it("dismissFailure vrátí nové pole (immutable update)", () => {
      pushFailure(makeOutboxItem(1))
      pushFailure(makeOutboxItem(2))

      const before = getFailures()
      dismissFailure(1)
      const after = getFailures()

      expect(after).not.toBe(before)
    })
  })

  // ─── subscribeFailures ────────────────────────────────────────────────────

  describe("subscribeFailures", () => {
    it("subscribe vrátí unsubscribe funkci", () => {
      const unsubscribe = subscribeFailures(() => {})
      expect(typeof unsubscribe).toBe("function")
      unsubscribe()
    })

    it("unsubscribe zabrání dalším notifikacím", () => {
      const listener = vi.fn()
      const unsubscribe = subscribeFailures(listener)

      pushFailure(makeOutboxItem(1))
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()

      pushFailure(makeOutboxItem(2))
      // Listener nesmí být volán po unsubscribe
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it("více listenerů dostane notifikaci", () => {
      const l1 = vi.fn()
      const l2 = vi.fn()
      const unsub1 = subscribeFailures(l1)
      const unsub2 = subscribeFailures(l2)

      pushFailure(makeOutboxItem(1))
      expect(l1).toHaveBeenCalledTimes(1)
      expect(l2).toHaveBeenCalledTimes(1)

      unsub1()
      unsub2()
    })

    it("getFailures po pushFailure vrátí aktuální snapshot", () => {
      let snapshot = getFailures()
      expect(snapshot).toHaveLength(0)

      subscribeFailures(() => {
        snapshot = getFailures()
      })

      pushFailure(makeOutboxItem(1))
      expect(snapshot).toHaveLength(1)
    })
  })

  // ─── retryFailure ─────────────────────────────────────────────────────────

  describe("retryFailure", () => {
    it("nastaví outbox položku zpět na pending, resetuje attempts, vymaže lastError", async () => {
      const id = await enqueue(makeDeadItem("programs.completeWorkout"))

      await retryFailure(id)

      const items = await getAll()
      expect(items).toHaveLength(1)
      expect(items[0].state).toBe("pending")
      expect(items[0].attempts).toBe(0)
      expect(items[0].lastError).toBeUndefined()
    })

    it("odstraní odpovídající selhání ze store", async () => {
      const id = await enqueue(makeDeadItem("programs.completeWorkout"))
      pushFailure(makeOutboxItem(id))
      expect(getFailures()).toHaveLength(1)

      await retryFailure(id)

      expect(getFailures()).toHaveLength(0)
    })

    it("zavolá flushNow po resetu položky", async () => {
      const id = await enqueue(makeDeadItem("programs.completeWorkout"))

      await retryFailure(id)

      expect(flushNow).toHaveBeenCalledTimes(1)
    })

    it("dismiss neexistujícího selhání při retry je no-op (nevyhodí chybu)", async () => {
      const id = await enqueue(makeDeadItem("programs.completeWorkout"))

      await expect(retryFailure(id)).resolves.toBeUndefined()
      expect(getFailures()).toEqual([])
    })
  })

  // ─── discardFailure ───────────────────────────────────────────────────────

  describe("discardFailure", () => {
    it("odstraní položku z outboxu", async () => {
      const id = await enqueue(makeDeadItem("programs.completeWorkout"))

      await discardFailure(id)

      expect(await getAll()).toEqual([])
    })

    it("odstraní odpovídající selhání ze store", async () => {
      const id = await enqueue(makeDeadItem("programs.completeWorkout"))
      pushFailure(makeOutboxItem(id))
      expect(getFailures()).toHaveLength(1)

      await discardFailure(id)

      expect(getFailures()).toHaveLength(0)
    })

    it("NEvolá flushNow (na rozdíl od retryFailure)", async () => {
      const id = await enqueue(makeDeadItem("programs.completeWorkout"))

      await discardFailure(id)

      expect(flushNow).not.toHaveBeenCalled()
    })
  })
})
