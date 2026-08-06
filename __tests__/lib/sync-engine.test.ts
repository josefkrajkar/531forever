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

import {
  flushOutbox,
  buildRegistry,
  _resetFlushingForTests,
  MAX_ATTEMPTS,
} from "@/lib/sync-engine"
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
    it("neznámá mutace → okamžitě dead-letter a POKRAČUJ (neblokuje frontu)", async () => {
      await enqueue(makeItem("unknown.nonExistent"))
      await enqueue(makeItem("programs.completeWorkout"))

      const onDeadLetter = vi.fn()
      const client = makeMockClient(async () => ({}))
      const result = await flushOutbox(makeDeps(client, { onDeadLetter }))

      expect(result.failedStopped).toBe(false)
      expect(result.deadLettered).toBe(1)
      // 2. položka JE zpracována — dead-letter nezastaví flush
      expect(result.flushed).toBe(1)
      expect(vi.mocked(client.mutation)).toHaveBeenCalledOnce()

      expect(onDeadLetter).toHaveBeenCalledOnce()
      expect(onDeadLetter.mock.calls[0][0].mutationName).toBe("unknown.nonExistent")
      expect(onDeadLetter.mock.calls[0][0].state).toBe("dead")

      const items = await getAll()
      // 2. položka byla úspěšně odeslána a odstraněna — zůstává jen dead položka
      expect(items).toHaveLength(1)
      expect(items[0].mutationName).toBe("unknown.nonExistent")
      expect(items[0].state).toBe("dead")
      expect(items[0].lastError).toContain("unknown.nonExistent")
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

  // ─── Coalesced rerun (flush vyžádán během probíhajícího flushe) ──────

  describe("coalesced rerun — flush vyžádán během probíhajícího flushe", () => {
    it("položka zařazená mid-flight je zpracována v dorazovém průchodu bez extra externího triggeru", async () => {
      await enqueue(makeItem("programs.completeWorkout", { order: "A" }))

      const processed: string[] = []
      const client = makeMockClient(async (_ref, args) => {
        processed.push((args as { order?: string }).order ?? "?")
        // Umělé zpoždění — první flush zůstane "in-flight" dost dlouho,
        // aby se stihl souběžný požadavek + mid-flight enqueue.
        await new Promise((r) => setTimeout(r, 20))
        return {}
      })

      // Volání back-to-back (bez await mezi nimi) — druhé narazí na guard,
      // zatímco první ještě zpracovává položku "A".
      const flush1 = flushOutbox(makeDeps(client))
      const flush2 = flushOutbox(makeDeps(client))

      // Simuluje retryFailure: nová/resetovaná položka vznikne, zatímco
      // první flush běží — bez coalesced rerunu by čekala na další trigger.
      await enqueue(makeItem("bodyweight.logBodyweight", { order: "B" }))

      const [result1, result2] = await Promise.all([flush1, flush2])

      expect(processed).toEqual(["A", "B"])
      expect(result2.flushed).toBe(0)
      expect(result2.failedStopped).toBe(false)
      expect(result1.flushed).toBe(2)
      expect(result1.failedStopped).toBe(false)
      expect(await getAll()).toHaveLength(0)
    })

    it("bez souběžného požadavku proběhne jen jeden průchod (žádný zbytečný rerun)", async () => {
      await enqueue(makeItem("programs.completeWorkout"))
      await enqueue(makeItem("bodyweight.logBodyweight"))

      const client = makeMockClient(async () => ({}))
      const result = await flushOutbox(makeDeps(client))

      expect(result.flushed).toBe(2)
      // getAll je voláno jednou per průchod — jeden průchod = jedno volání
      expect(vi.mocked(client.mutation)).toHaveBeenCalledTimes(2)
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

  // ─── Dead-letter po vyčerpání MAX_ATTEMPTS ───────────────────────────

  describe("dead-letter po vyčerpání MAX_ATTEMPTS", () => {
    it("položka selhávající MAX_ATTEMPTS-krát → dead, deadLettered započítáno, flush POKRAČUJE, onDeadLetter zavolán", async () => {
      await enqueue(makeItem("programs.completeWorkout"))
      await enqueue(makeItem("bodyweight.logBodyweight"))

      const failingClient = makeMockClient(async (ref) => {
        const name = (ref as unknown as { _name: string })._name
        if (name === "programs.completeWorkout") throw new Error("Trvalá chyba")
        return {}
      })

      // MAX_ATTEMPTS - 1 selhání → stále "failed", každý flush se ZASTAVÍ (transient)
      for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
        const r = await flushOutbox(makeDeps(failingClient))
        expect(r.failedStopped).toBe(true)
        expect(r.deadLettered).toBe(0)
      }

      const beforeLast = await getAll()
      expect(beforeLast[0].state).toBe("failed")
      expect(beforeLast[0].attempts).toBe(MAX_ATTEMPTS - 1)
      // Druhá položka nikdy nezpracována (blokovaná FIFO frontou)
      expect(beforeLast[1].state).toBe("pending")

      // Poslední (MAX_ATTEMPTS-tý) pokus → attempts dosáhne MAX_ATTEMPTS → dead-letter
      const onDeadLetter = vi.fn()
      const result = await flushOutbox(makeDeps(failingClient, { onDeadLetter }))

      expect(result.deadLettered).toBe(1)
      expect(result.failedStopped).toBe(false)
      // Dead-letter NEBLOKUJE frontu — 2. položka je zpracována ve STEJNÉM průchodu
      expect(result.flushed).toBe(1)

      expect(onDeadLetter).toHaveBeenCalledOnce()
      expect(onDeadLetter.mock.calls[0][0].mutationName).toBe("programs.completeWorkout")
      expect(onDeadLetter.mock.calls[0][0].state).toBe("dead")
      expect(onDeadLetter.mock.calls[0][0].attempts).toBe(MAX_ATTEMPTS)

      const items = await getAll()
      // Jen dead položka zůstává — druhá byla úspěšně odeslána a odstraněna
      expect(items).toHaveLength(1)
      expect(items[0].mutationName).toBe("programs.completeWorkout")
      expect(items[0].state).toBe("dead")
      expect(items[0].attempts).toBe(MAX_ATTEMPTS)
      expect(items[0].lastError).toBe("Trvalá chyba")
    })

    it("dead položka je při dalším flushi PŘESKOČENA — nikdy znovu nezkoušena", async () => {
      await enqueue({
        ...makeItem("programs.completeWorkout"),
        state: "dead",
        attempts: MAX_ATTEMPTS,
        lastError: "již dead-lettered",
      })

      const client = makeMockClient(async () => ({}))
      const result = await flushOutbox(makeDeps(client))

      expect(vi.mocked(client.mutation)).not.toHaveBeenCalled()
      expect(result.flushed).toBe(0)
      expect(result.deadLettered).toBe(0)
      expect(result.failedStopped).toBe(false)

      const items = await getAll()
      expect(items).toHaveLength(1)
      expect(items[0].state).toBe("dead") // nezměněno — přeskočeno
      expect(items[0].attempts).toBe(MAX_ATTEMPTS)
    })

    it("transientní chyba (attempts < MAX_ATTEMPTS) stále ZASTAVÍ flush (FIFO integrita)", async () => {
      await enqueue(makeItem("programs.completeWorkout"))
      await enqueue(makeItem("bodyweight.logBodyweight"))

      const client = makeMockClient(async () => {
        throw new Error("Transientní síťová chyba")
      })

      const result = await flushOutbox(makeDeps(client))

      expect(result.deadLettered).toBe(0)
      expect(result.failedStopped).toBe(true)
      expect(result.flushed).toBe(0)

      const items = await getAll()
      expect(items).toHaveLength(2)
      expect(items[0].state).toBe("failed")
      expect(items[0].attempts).toBe(1)
      // Druhá položka nezpracována — FIFO pořadí zachováno
      expect(items[1].state).toBe("pending")
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
