/**
 * Testy pro lib/sync-engine.ts — sériový flush orchestrátor.
 *
 * Pokrývá:
 * - Sériový FIFO flush úspěch → outbox prázdný, pořadí volání zachované
 * - Konflikt (mock vrátí {alreadyCompleted:true}) → položka odstraněna + onConflict zavolán
 * - Chyba (mock throw na 2. položce) → 1. odstraněna, 2. zůstane failed,
 *   flush zastaven, 3. nezpracována (FIFO)
 * - Guard souběhu: dvě paralelní flushOutbox → druhá no-op
 * - Retry: po chybě další flush zkusí znovu od failed položky
 * - buildRegistry: sestaví správný registry z api objektu
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import "fake-indexeddb/auto"

import { flushOutbox, buildRegistry, _resetFlushingForTests } from "@/lib/sync-engine"
import type { SyncClient, MutationRegistry, FlushDeps } from "@/lib/sync-engine"
import {
  enqueue,
  getAll,
  clearOutbox,
  _resetDbForTests,
} from "@/lib/outbox"
import type { OutboxItem } from "@/lib/outbox"
import type { FunctionReference } from "convex/server"

// ─── Mock FunctionReference ──────────────────────────────────────────────────

/** Vytvoří fake FunctionReference pro testy (obsah nezáleží — předán do mock klienta) */
function makeMockRef(name: string): FunctionReference<"mutation"> {
  return { _type: "mutation", _name: name } as unknown as FunctionReference<"mutation">
}

// ─── Mock klient ─────────────────────────────────────────────────────────────

function makeMockClient(
  handler: (ref: FunctionReference<"mutation">, args: Record<string, unknown>) => Promise<unknown>
): SyncClient {
  return { mutation: vi.fn(handler) }
}

// ─── Mock registry ───────────────────────────────────────────────────────────

const COMPLETE_REF = makeMockRef("programs.completeWorkout")
const AMRAP_REF = makeMockRef("programs.saveAmrapResult")
const LOG_BW_REF = makeMockRef("bodyweight.logBodyweight")

const mockRegistry: MutationRegistry = {
  "programs.completeWorkout": COMPLETE_REF,
  "programs.saveAmrapResult": AMRAP_REF,
  "bodyweight.logBodyweight": LOG_BW_REF,
}

// ─── Pomocné funkce ──────────────────────────────────────────────────────────

function makeItem(mutationName: string, args: Record<string, unknown> = {}): Omit<OutboxItem, "id"> {
  return {
    mutationName,
    args,
    enqueuedAt: Date.now(),
    state: "pending",
    attempts: 0,
  }
}

function makeDeps(
  client: SyncClient,
  overrides: Partial<FlushDeps> = {}
): FlushDeps {
  return {
    client,
    registry: mockRegistry,
    ...overrides,
  }
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  _resetFlushingForTests()
  _resetDbForTests()
  await clearOutbox()
})

// ─── Testy ───────────────────────────────────────────────────────────────────

describe("sync-engine / flushOutbox", () => {
  // ─── Úspěšný sériový flush ─────────────────────────────────────────────

  describe("sériový FIFO flush — úspěch", () => {
    it("úspěšný flush — outbox je prázdný po dokončení", async () => {
      await enqueue(makeItem("programs.completeWorkout"))
      await enqueue(makeItem("bodyweight.logBodyweight"))

      const client = makeMockClient(async () => ({}))
      const result = await flushOutbox(makeDeps(client))

      expect(result.flushed).toBe(2)
      expect(result.conflicts).toBe(0)
      expect(result.failedStopped).toBe(false)
      expect(await getAll()).toHaveLength(0)
    })

    it("pořadí volání client.mutation odpovídá FIFO pořadí outboxu", async () => {
      await enqueue(makeItem("programs.completeWorkout", { order: 1 }))
      await enqueue(makeItem("programs.saveAmrapResult", { order: 2 }))
      await enqueue(makeItem("bodyweight.logBodyweight", { order: 3 }))

      const callOrder: string[] = []
      const client = makeMockClient(async (ref) => {
        callOrder.push((ref as unknown as { _name: string })._name)
        return {}
      })

      await flushOutbox(makeDeps(client))

      expect(callOrder).toEqual([
        "programs.completeWorkout",
        "programs.saveAmrapResult",
        "bodyweight.logBodyweight",
      ])
    })

    it("prázdný outbox — flush vrátí flushed=0 a nic nevyhodí", async () => {
      const client = makeMockClient(async () => ({}))
      const result = await flushOutbox(makeDeps(client))

      expect(result.flushed).toBe(0)
      expect(result.failedStopped).toBe(false)
      expect(vi.mocked(client.mutation)).not.toHaveBeenCalled()
    })
  })

  // ─── Konflikt ─────────────────────────────────────────────────────────

  describe("konflikt (server wins)", () => {
    it("konflikt → položka odstraněna z outboxu", async () => {
      await enqueue(makeItem("programs.completeWorkout"))

      const client = makeMockClient(async () => ({ alreadyCompleted: true }))
      const result = await flushOutbox(makeDeps(client))

      expect(result.conflicts).toBe(1)
      expect(result.flushed).toBe(0)
      expect(await getAll()).toHaveLength(0)
    })

    it("konflikt → onConflict callback je zavolán se správnou položkou", async () => {
      await enqueue(makeItem("programs.completeWorkout", { expectedCycle: 3 }))

      const onConflict = vi.fn()
      const client = makeMockClient(async () => ({ alreadyCompleted: true }))

      await flushOutbox(makeDeps(client, { onConflict }))

      expect(onConflict).toHaveBeenCalledOnce()
      expect(onConflict.mock.calls[0][0].mutationName).toBe("programs.completeWorkout")
      expect(onConflict.mock.calls[0][0].args).toEqual({ expectedCycle: 3 })
    })

    it("vlastní isConflict detektor funguje správně", async () => {
      await enqueue(makeItem("programs.completeWorkout"))

      const onConflict = vi.fn()
      const client = makeMockClient(async () => ({ customConflict: true }))

      const result = await flushOutbox(
        makeDeps(client, {
          onConflict,
          isConflict: (_name, r) =>
            typeof r === "object" && r !== null && "customConflict" in r,
        })
      )

      expect(result.conflicts).toBe(1)
      expect(onConflict).toHaveBeenCalledOnce()
      expect(await getAll()).toHaveLength(0)
    })

    it("smíšený scénář: první úspěch, druhý konflikt, třetí úspěch", async () => {
      await enqueue(makeItem("programs.completeWorkout"))
      await enqueue(makeItem("programs.saveAmrapResult"))
      await enqueue(makeItem("bodyweight.logBodyweight"))

      let callCount = 0
      const client = makeMockClient(async () => {
        callCount++
        if (callCount === 2) return { alreadyCompleted: true }
        return {}
      })

      const result = await flushOutbox(makeDeps(client))

      expect(result.flushed).toBe(2)
      expect(result.conflicts).toBe(1)
      expect(result.failedStopped).toBe(false)
      expect(await getAll()).toHaveLength(0)
    })
  })

  // ─── Chyba a FIFO stop ────────────────────────────────────────────────

  describe("chyba mutace → zastav flush (FIFO integrita)", () => {
    it("chyba na 2. položce → 1. odstraněna, 2. failed, 3. nezpracována", async () => {
      await enqueue(makeItem("programs.completeWorkout", { order: 1 }))
      await enqueue(makeItem("programs.saveAmrapResult", { order: 2 }))
      await enqueue(makeItem("bodyweight.logBodyweight", { order: 3 }))

      let callCount = 0
      const client = makeMockClient(async () => {
        callCount++
        if (callCount === 2) throw new Error("Síťová chyba")
        return {}
      })

      const result = await flushOutbox(makeDeps(client))

      expect(result.flushed).toBe(1)
      expect(result.failedStopped).toBe(true)

      const remaining = await getAll()
      // 2. a 3. položka musí zůstat
      expect(remaining).toHaveLength(2)
      expect(remaining[0].mutationName).toBe("programs.saveAmrapResult")
      expect(remaining[0].state).toBe("failed")
      expect(remaining[0].attempts).toBe(1)
      expect(remaining[0].lastError).toBe("Síťová chyba")
      // 3. položka zůstane nedotčena (state: pending)
      expect(remaining[1].mutationName).toBe("bodyweight.logBodyweight")
      expect(remaining[1].state).toBe("pending")
      expect(remaining[1].attempts).toBe(0)
    })

    it("chyba na 1. položce → zastav hned, fronta nedotčena (failed)", async () => {
      await enqueue(makeItem("programs.completeWorkout"))
      await enqueue(makeItem("bodyweight.logBodyweight"))

      const client = makeMockClient(async () => {
        throw new Error("Auth chyba")
      })

      const result = await flushOutbox(makeDeps(client))

      expect(result.flushed).toBe(0)
      expect(result.failedStopped).toBe(true)

      const remaining = await getAll()
      expect(remaining).toHaveLength(2)
      expect(remaining[0].state).toBe("failed")
      expect(remaining[1].state).toBe("pending") // 2. nezpracována
    })

    it("chybová zpráva je uložena jako lastError", async () => {
      await enqueue(makeItem("programs.completeWorkout"))

      const client = makeMockClient(async () => {
        throw new Error("Specifická chybová zpráva 123")
      })

      await flushOutbox(makeDeps(client))

      const items = await getAll()
      expect(items[0].lastError).toBe("Specifická chybová zpráva 123")
    })
  })

  // ─── Neznámá mutace ───────────────────────────────────────────────────

  describe("neznámá mutace v registry", () => {
    it("neznámá mutace → označí failed a zastav flush", async () => {
      await enqueue(makeItem("unknown.nonExistent"))
      await enqueue(makeItem("programs.completeWorkout"))

      const client = makeMockClient(async () => ({}))
      const result = await flushOutbox(makeDeps(client))

      expect(result.failedStopped).toBe(true)
      expect(vi.mocked(client.mutation)).not.toHaveBeenCalled()

      const items = await getAll()
      expect(items[0].state).toBe("failed")
      expect(items[0].lastError).toContain("unknown.nonExistent")
      // 2. položka nesmí být zpracována
      expect(items[1].state).toBe("pending")
    })
  })

  // ─── Guard souběhu ────────────────────────────────────────────────────

  describe("guard souběhu (flushing flag)", () => {
    it("dvě paralelní flushOutbox → druhá je no-op", async () => {
      await enqueue(makeItem("programs.completeWorkout"))
      await enqueue(makeItem("bodyweight.logBodyweight"))

      // Klient s umělým zpožděním — zabrání dokončení první flush
      // před startem druhé
      const mutationCalls: string[] = []
      const client = makeMockClient(async (ref) => {
        mutationCalls.push((ref as unknown as { _name: string })._name)
        // Krátké zpoždění — dovolí druhé flushOutbox volání dříve, než první skončí
        await new Promise((r) => setTimeout(r, 10))
        return {}
      })

      // Spusť obě současně — NEČEKEJ na první
      const [result1, result2] = await Promise.all([
        flushOutbox(makeDeps(client)),
        flushOutbox(makeDeps(client)),
      ])

      // Jedna z nich musí být no-op (flushed=0, failedStopped=false)
      const noOpResult = [result1, result2].find((r) => r.flushed === 0)
      expect(noOpResult).toBeDefined()
      expect(noOpResult!.failedStopped).toBe(false)

      // Celkem musí být flushed=2 (obě položky) — první flush je dokončí
      const totalFlushed = result1.flushed + result2.flushed
      expect(totalFlushed).toBe(2)
    })
  })

  // ─── Retry po chybě ──────────────────────────────────────────────────

  describe("retry: po chybě zkusí znovu od failed položky", () => {
    it("druhý flush přes failed položku → pokud tentokrát uspěje, odstraní ji", async () => {
      await enqueue(makeItem("programs.completeWorkout"))

      // První flush selže
      const failingClient = makeMockClient(async () => {
        throw new Error("Dočasná chyba")
      })
      await flushOutbox(makeDeps(failingClient))

      const afterFirst = await getAll()
      expect(afterFirst[0].state).toBe("failed")
      expect(afterFirst[0].attempts).toBe(1)

      // Druhý flush se stejnou položkou — tentokrát uspěje
      const successClient = makeMockClient(async () => ({}))
      const result = await flushOutbox(makeDeps(successClient))

      expect(result.flushed).toBe(1)
      expect(result.failedStopped).toBe(false)
      expect(await getAll()).toHaveLength(0)
    })

    it("opakovaná selhání zvyšují attempts", async () => {
      await enqueue(makeItem("programs.completeWorkout"))

      const failingClient = makeMockClient(async () => {
        throw new Error("Opakovaná chyba")
      })

      await flushOutbox(makeDeps(failingClient))
      await flushOutbox(makeDeps(failingClient))
      await flushOutbox(makeDeps(failingClient))

      const items = await getAll()
      expect(items[0].attempts).toBe(3)
      expect(items[0].state).toBe("failed")
    })
  })
})

// ─── buildRegistry ────────────────────────────────────────────────────────────

describe("buildRegistry", () => {
  it("sestaví registry se všemi kanonickými mutacemi", () => {
    const mockApi = {
      programs: {
        completeWorkout: makeMockRef("programs.completeWorkout"),
        saveAmrapResult: makeMockRef("programs.saveAmrapResult"),
        setSeventhWeekType: makeMockRef("programs.setSeventhWeekType"),
        setTrainingMax: makeMockRef("programs.setTrainingMax"),
      },
      accessories: {
        logMultipleAccessories: makeMockRef("accessories.logMultipleAccessories"),
        logAccessory: makeMockRef("accessories.logAccessory"),
      },
      bodyweight: {
        logBodyweight: makeMockRef("bodyweight.logBodyweight"),
      },
      users: {
        updateAthleteProfile: makeMockRef("users.updateAthleteProfile"),
      },
    }

    const registry = buildRegistry(mockApi)

    expect(registry["programs.completeWorkout"]).toBe(mockApi.programs.completeWorkout)
    expect(registry["programs.saveAmrapResult"]).toBe(mockApi.programs.saveAmrapResult)
    expect(registry["programs.setSeventhWeekType"]).toBe(mockApi.programs.setSeventhWeekType)
    expect(registry["programs.setTrainingMax"]).toBe(mockApi.programs.setTrainingMax)
    expect(registry["accessories.logMultipleAccessories"]).toBe(
      mockApi.accessories.logMultipleAccessories
    )
    expect(registry["accessories.logAccessory"]).toBe(mockApi.accessories.logAccessory)
    expect(registry["bodyweight.logBodyweight"]).toBe(mockApi.bodyweight.logBodyweight)
    expect(registry["users.updateAthleteProfile"]).toBe(mockApi.users.updateAthleteProfile)
    expect(Object.keys(registry)).toHaveLength(8)
  })
})
