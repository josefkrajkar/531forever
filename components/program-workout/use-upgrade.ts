"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import { type SupplementalTemplate } from "@/lib/531"

interface UseUpgradeReturn {
  showUpgradeModal: boolean
  selectedUpgradeTemplate: SupplementalTemplate
  upgrading: boolean
  setShowUpgradeModal: (show: boolean) => void
  setSelectedUpgradeTemplate: (template: SupplementalTemplate) => void
  handleUpgradeToForever: () => Promise<void>
}

export function useUpgrade(): UseUpgradeReturn {
  const upgradeToForever = useMutation(api.programs.upgradeToForever)

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [selectedUpgradeTemplate, setSelectedUpgradeTemplate] = useState<SupplementalTemplate>("bbb")
  const [upgrading, setUpgrading] = useState(false)

  const handleUpgradeToForever = async () => {
    setUpgrading(true)
    try {
      const result = await upgradeToForever({ supplementalTemplate: selectedUpgradeTemplate })
      console.log("[program-workout] Upgraded to Forever:", result)
      setShowUpgradeModal(false)
    } catch (err) {
      console.error("[program-workout] Upgrade error:", err)
      toast.error("Upgrade se nezdařil, zkus to znovu")
    } finally {
      setUpgrading(false)
    }
  }

  return {
    showUpgradeModal,
    selectedUpgradeTemplate,
    upgrading,
    setShowUpgradeModal,
    setSelectedUpgradeTemplate,
    handleUpgradeToForever,
  }
}
