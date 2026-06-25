"use client"

import { useState, useRef } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import { useConnectionState } from "@/hooks/use-connection-state"
import { useOfflineMutation } from "@/hooks/use-offline-mutation"

interface UseAmrapParams {
  lift: string
  amrapSetWeight: number
  amrapSetTargetReps: number
  autoregulated: boolean
}

interface UseAmrapReturn {
  amrapReps: string
  amrapSaved: boolean
  savingAmrap: boolean
  setAmrapReps: (reps: string) => void
  resetAmrap: () => void
  handleSaveAmrap: (params: UseAmrapParams) => Promise<void>
}

export function useAmrap(): UseAmrapReturn {
  const saveAmrapResult = useMutation(api.programs.saveAmrapResult)

  const { isOnline } = useConnectionState()
  const { enqueueMutation } = useOfflineMutation()

  const [amrapReps, setAmrapReps] = useState("")
  const [amrapSaved, setAmrapSaved] = useState(false)
  const [savingAmrap, setSavingAmrap] = useState(false)

  // Stabilní clientId pro tento AMRAP pokus — generuje se jednou při prvním handleSaveAmrap
  // a zůstává stejné při retry/replay (dedup na serveru rozpozná duplikát).
  const clientIdRef = useRef<string | null>(null)

  const resetAmrap = () => {
    setAmrapReps("")
    setAmrapSaved(false)
    // Nový AMRAP pokus = nové clientId
    clientIdRef.current = null
  }

  const handleSaveAmrap = async ({ lift, amrapSetWeight, amrapSetTargetReps, autoregulated }: UseAmrapParams) => {
    if (savingAmrap) return
    const reps = parseInt(amrapReps)
    if (!amrapReps || reps < 1) return

    // Generuj clientId stabilně pro tento pokus (ne nově při každém re-renderu/retry)
    if (!clientIdRef.current) {
      clientIdRef.current = crypto.randomUUID()
    }
    const clientId = clientIdRef.current

    setSavingAmrap(true)
    try {
      if (isOnline) {
        // ── ONLINE větev — PŘESNĚ stávající chování, nulová regrese ──────────
        await saveAmrapResult({
          lift,
          weight: amrapSetWeight,
          targetReps: amrapSetTargetReps,
          actualReps: reps,
          autoregulated,
          clientId,
        })
        setAmrapSaved(true)
        console.log(
          "[program-workout] AMRAP saved:",
          lift, reps, "reps",
          autoregulated ? "(autoregulated)" : "",
          `(clientId: ${clientId})`
        )
      } else {
        // ── OFFLINE větev — přes outbox ───────────────────────────────────────
        // clientId je v args pro dedup při offline replay
        await enqueueMutation("programs.saveAmrapResult", {
          lift,
          weight: amrapSetWeight,
          targetReps: amrapSetTargetReps,
          actualReps: reps,
          autoregulated,
          clientId,
        })
        setAmrapSaved(true)
        console.log(
          "[program-workout] AMRAP enqueued offline:",
          lift, reps, "reps",
          autoregulated ? "(autoregulated)" : "",
          `(clientId: ${clientId})`
        )
      }
    } catch (err) {
      console.error("[program-workout] AMRAP save error:", err)
      toast.error("Uložení AMRAP se nezdařilo, zkus to znovu")
    } finally {
      setSavingAmrap(false)
    }
  }

  return {
    amrapReps,
    amrapSaved,
    savingAmrap,
    setAmrapReps,
    resetAmrap,
    handleSaveAmrap,
  }
}
