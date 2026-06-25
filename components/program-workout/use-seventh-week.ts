"use client"

import { useState, useEffect } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import { type SeventhWeekType } from "@/lib/531"

interface UseSeventhWeekParams {
  initialType: SeventhWeekType | null
  programSeventhWeekType: string | undefined | null
}

interface UseSeventhWeekReturn {
  selectedSeventhWeekType: SeventhWeekType | null
  savingSeventhWeekType: boolean
  handleSeventhWeekTypeSelect: (type: SeventhWeekType) => Promise<void>
}

export function useSeventhWeek({ programSeventhWeekType }: Pick<UseSeventhWeekParams, "programSeventhWeekType">): UseSeventhWeekReturn {
  const setSeventhWeekType = useMutation(api.programs.setSeventhWeekType)

  const [selectedSeventhWeekType, setSelectedSeventhWeekType] = useState<SeventhWeekType | null>(
    (programSeventhWeekType as SeventhWeekType) || null
  )
  const [savingSeventhWeekType, setSavingSeventhWeekType] = useState(false)

  // Sync with program when it changes (e.g., after phase transition)
  useEffect(() => {
    setSelectedSeventhWeekType((programSeventhWeekType as SeventhWeekType) || null)
  }, [programSeventhWeekType])

  const handleSeventhWeekTypeSelect = async (type: SeventhWeekType) => {
    setSelectedSeventhWeekType(type)
    setSavingSeventhWeekType(true)
    try {
      await setSeventhWeekType({ type })
      console.log("[program-workout] 7th week type set to:", type)
    } catch (err) {
      console.error("[program-workout] Error setting 7th week type:", err)
      setSelectedSeventhWeekType(null)
      toast.error("Uložení 7. týdne se nezdařilo, zkus to znovu")
    } finally {
      setSavingSeventhWeekType(false)
    }
  }

  return {
    selectedSeventhWeekType,
    savingSeventhWeekType,
    handleSeventhWeekTypeSelect,
  }
}
