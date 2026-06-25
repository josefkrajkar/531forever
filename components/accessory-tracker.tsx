"use client"

import { useState, useEffect } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { getExerciseById } from "@/lib/accessory-catalog"
import {
  calculateAccessoryProgression,
  type AccessoryScheme,
  type AccessorySetLog,
} from "@/lib/531"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Check, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react"

interface AccessoryTrackerProps {
  accessoryIds: string[]
  onComplete: (logs: Array<{ accessoryId: string; sets: AccessorySetLog[] }>) => void
}

export default function AccessoryTracker({
  accessoryIds,
  onComplete,
}: AccessoryTrackerProps) {
  // Track state per accessory
  const [accessoryStates, setAccessoryStates] = useState<
    Record<string, {
      sets: AccessorySetLog[]
      targetReps: number
      weight: number
    }>
  >({})
  const [expandedId, setExpandedId] = useState<string | null>(accessoryIds[0] || null)

  // Initialize state for all accessories
  useEffect(() => {
    const initialStates: typeof accessoryStates = {}
    
    for (const id of accessoryIds) {
      const exercise = getExerciseById(id)
      if (!exercise) continue
      
      const [minReps, maxReps] = exercise.defaultScheme.repRange
      initialStates[id] = {
        sets: Array(exercise.defaultScheme.sets).fill(null).map(() => ({
          weight: 0,  // Will be updated from history
          reps: minReps,
          completed: false,
        })),
        targetReps: minReps,
        weight: 0,
      }
    }

    // Záměrná inicializace editovatelného lokálního stavu z props (accessoryIds).
    // Stav uživatel dál edituje přes handlery, nelze ho proto čistě derivovat.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccessoryStates(initialStates)
  }, [accessoryIds])

  const handleSetComplete = (accessoryId: string, setIndex: number) => {
    setAccessoryStates(prev => {
      const current = prev[accessoryId]
      if (!current) return prev
      
      const newSets = [...current.sets]
      newSets[setIndex] = {
        ...newSets[setIndex],
        completed: !newSets[setIndex].completed,
      }
      
      return {
        ...prev,
        [accessoryId]: { ...current, sets: newSets },
      }
    })
  }

  const handleRepsChange = (accessoryId: string, setIndex: number, reps: number) => {
    setAccessoryStates(prev => {
      const current = prev[accessoryId]
      if (!current) return prev
      
      const newSets = [...current.sets]
      newSets[setIndex] = {
        ...newSets[setIndex],
        reps: Math.max(0, reps),
      }
      
      return {
        ...prev,
        [accessoryId]: { ...current, sets: newSets },
      }
    })
  }

  const handleWeightChange = (accessoryId: string, weight: number) => {
    setAccessoryStates(prev => {
      const current = prev[accessoryId]
      if (!current) return prev
      
      // Update weight for all sets
      const newSets = current.sets.map(set => ({
        ...set,
        weight: Math.max(0, weight),
      }))
      
      return {
        ...prev,
        [accessoryId]: { ...current, weight: Math.max(0, weight), sets: newSets },
      }
    })
  }

  const handleSaveAll = () => {
    const logs = Object.entries(accessoryStates).map(([accessoryId, state]) => ({
      accessoryId,
      sets: state.sets,
    }))
    onComplete(logs)
  }

  // Count completed
  const totalSets = Object.values(accessoryStates).reduce(
    (sum, state) => sum + state.sets.length,
    0
  )
  const completedSets = Object.values(accessoryStates).reduce(
    (sum, state) => sum + state.sets.filter(s => s.completed).length,
    0
  )

  if (accessoryIds.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-6 text-center text-muted-foreground">
          Žádné doplňkové cviky pro dnešek
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {accessoryIds.map(id => {
        const exercise = getExerciseById(id)
        if (!exercise) return null
        
        const state = accessoryStates[id]
        if (!state) return null
        
        const isExpanded = expandedId === id
        const completedCount = state.sets.filter(s => s.completed).length
        const allComplete = completedCount === state.sets.length
        const [minReps, maxReps] = exercise.defaultScheme.repRange
        
        return (
          <Collapsible
            key={id}
            open={isExpanded}
            onOpenChange={() => setExpandedId(isExpanded ? null : id)}
          >
            <Card className={allComplete ? "border-green-500/50 bg-green-500/5" : ""}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base font-medium">
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.name + " exercise tutorial")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {exercise.name}
                        </a>
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {completedCount}/{state.sets.length}
                      </Badge>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  {/* Weight input */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                    <span className="text-sm text-muted-foreground w-16">Váha:</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleWeightChange(id, state.weight - exercise.increment)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={state.weight || ""}
                        onChange={(e) => handleWeightChange(id, parseFloat(e.target.value) || 0)}
                        className="w-20 h-8 text-center"
                        placeholder="0"
                      />
                      <span className="text-sm text-muted-foreground">kg</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleWeightChange(id, state.weight + exercise.increment)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Sets */}
                  <div className="space-y-2">
                    {state.sets.map((set, idx) => (
                      <div
                        key={idx}
                        className={`
                          flex items-center gap-3 p-2 rounded-lg transition-colors
                          ${set.completed 
                            ? "bg-green-500/10 border border-green-500/30" 
                            : "bg-muted/30"
                          }
                        `}
                      >
                        <Button
                          variant={set.completed ? "default" : "outline"}
                          size="sm"
                          className={`h-8 w-8 p-0 ${set.completed ? "bg-green-600 hover:bg-green-700" : ""}`}
                          onClick={() => handleSetComplete(id, idx)}
                        >
                          {set.completed ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </Button>

                        <span className="text-sm font-medium min-w-[60px]">
                          {state.weight > 0 ? `${state.weight}kg` : "—"}
                        </span>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRepsChange(id, idx, set.reps - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-mono text-sm">
                            {set.reps}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRepsChange(id, idx, set.reps + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            / {minReps}-{maxReps}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )
      })}

      {/* Summary */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted-foreground">
          {completedSets}/{totalSets} sérií hotovo
        </span>
        <Button
          onClick={handleSaveAll}
          disabled={completedSets === 0}
          size="sm"
        >
          <Check className="h-4 w-4 mr-2" />
          Uložit cviky
        </Button>
      </div>
    </div>
  )
}

// Inline single accessory card (for embedding in workout view)
export function AccessoryCard({
  accessoryId,
  onSets,
}: {
  accessoryId: string
  onSets: (sets: AccessorySetLog[]) => void
}) {
  const exercise = getExerciseById(accessoryId)
  const lastLog = useQuery(api.accessories.getLastAccessoryLog, { accessoryId })
  
  const [weight, setWeight] = useState(0)
  const [sets, setSets] = useState<AccessorySetLog[]>([])
  const [targetReps, setTargetReps] = useState(0)

  // Initialize from history or defaults
  useEffect(() => {
    if (!exercise) return
    
    const [minReps, maxReps] = exercise.defaultScheme.repRange
    const scheme: AccessoryScheme = {
      sets: exercise.defaultScheme.sets,
      minReps,
      maxReps,
      weight: lastLog?.sets[0]?.weight || 0,
      increment: exercise.increment,
    }
    
    // Calculate progression
    const progression = calculateAccessoryProgression(
      scheme,
      lastLog?.sets || null,
      lastLog ? targetReps : null
    )
    
    // Záměrná inicializace editovatelného stavu formuláře z načtené historie
    // (lastLog). Uživatel hodnoty dál edituje, proto musí jít o lokální stav.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeight(progression.newWeight)
    setTargetReps(progression.targetReps)
    setSets(
      Array(exercise.defaultScheme.sets).fill(null).map(() => ({
        weight: progression.newWeight,
        reps: progression.targetReps,
        completed: false,
      }))
    )
  }, [exercise, lastLog])

  if (!exercise) return null

  const handleSetComplete = (idx: number) => {
    const newSets = [...sets]
    newSets[idx] = { ...newSets[idx], completed: !newSets[idx].completed }
    setSets(newSets)
    onSets(newSets)
  }

  const handleRepsChange = (idx: number, reps: number) => {
    const newSets = [...sets]
    newSets[idx] = { ...newSets[idx], reps: Math.max(0, reps) }
    setSets(newSets)
    onSets(newSets)
  }

  const [minReps, maxReps] = exercise.defaultScheme.repRange
  const completedCount = sets.filter(s => s.completed).length

  return (
    <Card className={completedCount === sets.length ? "border-green-500/30" : ""}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.name + " exercise tutorial")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              {exercise.name}
            </a>
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {completedCount}/{sets.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {weight}kg × {targetReps} opak.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          {sets.map((set, idx) => (
            <Button
              key={idx}
              variant={set.completed ? "default" : "outline"}
              size="sm"
              className={`flex-1 h-10 ${set.completed ? "bg-green-600" : ""}`}
              onClick={() => handleSetComplete(idx)}
            >
              {set.completed ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-xs">{set.reps}</span>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
