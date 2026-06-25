"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  ACCESSORY_CATALOG,
  EQUIPMENT_OPTIONS,
  EXCLUDABLE_TAGS,
  RECOMMENDED_CATEGORIES,
  CATEGORY_NAMES,
  filterCatalog,
  getExercisesByCategory,
  getExerciseById,
  type AccessoryExercise,
  type AccessoryCategory,
} from "@/lib/accessory-catalog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Settings, Plus, Minus, Dumbbell, Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AccessoryPickerProps {
  open: boolean
  onClose: () => void
  lift: string  // "squat" | "bench" | "deadlift" | "press"
  currentAccessories: string[]  // Currently selected accessory IDs
}

export default function AccessoryPicker({
  open,
  onClose,
  lift,
  currentAccessories,
}: AccessoryPickerProps) {
  const { t } = useTranslation()
  const accessorySettings = useQuery(api.accessories.getAccessorySettings)
  const setDayAccessories = useMutation(api.accessories.setDayAccessories)
  const updateSettings = useMutation(api.accessories.updateAccessorySettings)

  // Local state for selection
  const [selected, setSelected] = useState<string[]>(currentAccessories)
  const [showSettings, setShowSettings] = useState(false)
  const [equipment, setEquipment] = useState<string[]>(
    accessorySettings?.availableEquipment || EQUIPMENT_OPTIONS.map(e => e.id)
  )
  const [excludeTags, setExcludeTags] = useState<string[]>(
    accessorySettings?.excludeTags || []
  )
  const [saving, setSaving] = useState(false)

  // Reset selection when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSelected(currentAccessories)
      if (accessorySettings) {
        setEquipment(accessorySettings.availableEquipment || EQUIPMENT_OPTIONS.map(e => e.id))
        setExcludeTags(accessorySettings.excludeTags || [])
      }
    }
    if (!isOpen) onClose()
  }

  // Filter catalog based on equipment and tags
  const filteredCatalog = filterCatalog(equipment, excludeTags)
  
  // Get recommended categories for this lift
  const recommendedCategories = RECOMMENDED_CATEGORIES[lift] || ["push", "pull"]
  
  // Group exercises by category
  const exercisesByCategory = Object.fromEntries(
    (["push", "pull", "legs", "core"] as AccessoryCategory[]).map(cat => [
      cat,
      getExercisesByCategory(filteredCatalog, cat),
    ])
  )

  const toggleExercise = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save equipment/tag settings if changed
      if (
        JSON.stringify(equipment) !== JSON.stringify(accessorySettings?.availableEquipment) ||
        JSON.stringify(excludeTags) !== JSON.stringify(accessorySettings?.excludeTags)
      ) {
        await updateSettings({
          availableEquipment: equipment,
          excludeTags: excludeTags,
        })
      }
      
      // Save selected accessories for this day
      await setDayAccessories({
        lift: lift as "squat" | "bench" | "deadlift" | "press",
        accessoryIds: selected,
      })
      
      onClose()
    } catch (error) {
      console.error("[AccessoryPicker] Error saving:", error)
    } finally {
      setSaving(false)
    }
  }

  const toggleEquipment = (id: string) => {
    setEquipment(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  const toggleExcludeTag = (id: string) => {
    setExcludeTags(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            {t("accessoryPicker.title")}
          </DialogTitle>
          <DialogDescription>
            {t("accessoryPicker.descriptionPrefix")}{" "}
            {recommendedCategories.map(c => t(CATEGORY_NAMES[c])).join(", ")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {showSettings ? (
            // Settings view
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-3">{t("accessoryPicker.availableEquipment")}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {EQUIPMENT_OPTIONS.map(eq => (
                      <div
                        key={eq.id}
                        className="flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleEquipment(eq.id)}
                      >
                        <Checkbox
                          checked={equipment.includes(eq.id)}
                          onCheckedChange={() => toggleEquipment(eq.id)}
                        />
                        <span className="text-sm">{t(eq.name)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">{t("accessoryPicker.excludeWith")}</h3>
                  <div className="space-y-2">
                    {EXCLUDABLE_TAGS.map(tag => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleExcludeTag(tag.id)}
                      >
                        <Checkbox
                          checked={excludeTags.includes(tag.id)}
                          onCheckedChange={() => toggleExcludeTag(tag.id)}
                        />
                        <div>
                          <span className="text-sm font-medium">{t(tag.name)}</span>
                          <p className="text-xs text-muted-foreground">{t(tag.description)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : (
            // Exercise selection view
            <Tabs defaultValue={recommendedCategories[0]} className="h-full">
              <TabsList className="grid w-full grid-cols-4">
                {(["push", "pull", "legs", "core"] as AccessoryCategory[]).map(cat => (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="relative"
                  >
                    {t(CATEGORY_NAMES[cat])}
                    {recommendedCategories.includes(cat) && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {(["push", "pull", "legs", "core"] as AccessoryCategory[]).map(cat => (
                <TabsContent key={cat} value={cat} className="h-[350px]">
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-2">
                      {exercisesByCategory[cat].length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {t("accessoryPicker.noExercises")}
                        </p>
                      ) : (
                        exercisesByCategory[cat].map(exercise => (
                          <ExerciseCard
                            key={exercise.id}
                            exercise={exercise}
                            selected={selected.includes(exercise.id)}
                            onToggle={() => toggleExercise(exercise.id)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>

        {/* Selected count */}
        {selected.length > 0 && !showSettings && (
          <div className="flex flex-wrap gap-1 py-2 border-t border-border">
            {selected.map(id => {
              const ex = getExerciseById(id)
              return ex ? (
                <Badge
                  key={id}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/20"
                  onClick={() => toggleExercise(id)}
                >
                  {t(`exercises.${id}`)}
                  <Minus className="h-3 w-3 ml-1" />
                </Badge>
              ) : null
            })}
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4 mr-2" />
            {showSettings ? t("accessoryPicker.backToExercises") : t("accessoryPicker.settings")}
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("program.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("accessoryPicker.saving") : t("accessoryPicker.saveWithCount", { count: selected.length })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Exercise card component
function ExerciseCard({
  exercise,
  selected,
  onToggle,
}: {
  exercise: AccessoryExercise
  selected: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const [minReps, maxReps] = exercise.defaultScheme.repRange

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
        ${selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
        }
      `}
      onClick={onToggle}
    >
      <Checkbox checked={selected} onCheckedChange={onToggle} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{t(`exercises.${exercise.id}`)}</span>
          {exercise.equipment.length === 0 && (
            <Badge variant="outline" className="text-xs">Bodyweight</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {exercise.defaultScheme.sets}×{minReps}-{maxReps}
          {exercise.increment > 0 && ` • +${exercise.increment}kg`}
        </p>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Info className="h-4 w-4 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="font-medium">{t(`exercises.${exercise.id}`)}</p>
            <p className="text-sm text-muted-foreground">
              {t("accessoryPicker.equipmentLabel")}{" "}
              {exercise.equipment.length === 0
                ? t("accessoryPicker.noneEquipment")
                : exercise.equipment.map(eq =>
                    t(EQUIPMENT_OPTIONS.find(e => e.id === eq)?.name ?? `equipment.${eq}`)
                  ).join(", ")
              }
            </p>
            {exercise.tags.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {exercise.tags.join(", ")}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
