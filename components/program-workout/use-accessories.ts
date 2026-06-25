"use client"

import { useState } from "react"
import { type AccessorySetLog } from "@/lib/531"

interface UseAccessoriesReturn {
  showAccessoryPicker: boolean
  accessoryLogs: Record<string, AccessorySetLog[]>
  accessoriesSaved: boolean
  setShowAccessoryPicker: (show: boolean) => void
  resetAccessories: () => void
  handleAccessoryComplete: (logs: Array<{ accessoryId: string; sets: AccessorySetLog[] }>) => void
}

export function useAccessories(): UseAccessoriesReturn {
  const [showAccessoryPicker, setShowAccessoryPicker] = useState(false)
  const [accessoryLogs, setAccessoryLogs] = useState<Record<string, AccessorySetLog[]>>({})
  const [accessoriesSaved, setAccessoriesSaved] = useState(false)

  const resetAccessories = () => {
    setAccessoryLogs({})
    setAccessoriesSaved(false)
  }

  const handleAccessoryComplete = (logs: Array<{ accessoryId: string; sets: AccessorySetLog[] }>) => {
    const logsMap: Record<string, AccessorySetLog[]> = {}
    for (const log of logs) {
      logsMap[log.accessoryId] = log.sets
    }
    setAccessoryLogs(logsMap)
    setAccessoriesSaved(true)
    console.log("[program-workout] Accessories logged locally:", logs.length, "exercises")
  }

  return {
    showAccessoryPicker,
    accessoryLogs,
    accessoriesSaved,
    setShowAccessoryPicker,
    resetAccessories,
    handleAccessoryComplete,
  }
}
