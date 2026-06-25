/**
 * @jest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import CycleReviewModal from "@/components/cycle-review-modal"
import type { CycleProgressionSummary } from "@/lib/531"

// CycleReviewModal je read-only — nepotřebuje mock Convex

const mockProgressionSummary: CycleProgressionSummary = {
  completedCycle: 1,
  newTrainingMaxes: { squat: 105, bench: 82.5, deadlift: 125, press: 52.5 },
  updatedMisses: { squat: 0, bench: 0, deadlift: 0, press: 0 },
  updatedE1rmHistory: { squat: [117], bench: [], deadlift: [130], press: [] },
  lifts: [
    { lift: "squat",    action: "PROGRESS", reason: "standard",       oldTM: 100,  newTM: 105,  change: 5,   reps: 5 },
    { lift: "bench",    action: "PROGRESS", reason: "standard",       oldTM: 80,   newTM: 82.5, change: 2.5, reps: 3 },
    { lift: "deadlift", action: "PROGRESS", reason: "standard",       oldTM: 120,  newTM: 125,  change: 5,   reps: 4 },
    { lift: "press",    action: "HOLD",     reason: "no_clean_signal", oldTM: 50,   newTM: 50,   change: 0 },
  ],
}

const mockProgressionWithMiss: CycleProgressionSummary = {
  completedCycle: 2,
  newTrainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
  updatedMisses: { squat: 1, bench: 0, deadlift: 0, press: 0 },
  updatedE1rmHistory: { squat: [], bench: [], deadlift: [], press: [] },
  lifts: [
    { lift: "squat",    action: "HOLD",     reason: "first_miss",     oldTM: 100, newTM: 100, change: 0, reps: 0 },
    { lift: "bench",    action: "PROGRESS", reason: "standard",       oldTM: 80,  newTM: 82.5, change: 2.5, reps: 3 },
    { lift: "deadlift", action: "PROGRESS", reason: "standard",       oldTM: 120, newTM: 125, change: 5, reps: 2 },
    { lift: "press",    action: "PROGRESS", reason: "standard",       oldTM: 50,  newTM: 52.5, change: 2.5, reps: 1 },
  ],
}

describe("CycleReviewModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders cycle completion header with correct cycle number", () => {
    render(
      <CycleReviewModal
        progressionSummary={mockProgressionSummary}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText(/Cyklus 1 dokončen/i)).toBeInTheDocument()
  })

  it("zobrazí nové Training Maxy pro všechny lifty", () => {
    render(
      <CycleReviewModal
        progressionSummary={mockProgressionSummary}
        onClose={vi.fn()}
      />
    )

    // Header sekce
    expect(screen.getByText("Nové Training Maxy")).toBeInTheDocument()
    // Lifty
    expect(screen.getAllByText("Dřep").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Bench press").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Mrtvý tah").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Tlak nad hlavou").length).toBeGreaterThanOrEqual(1)
  })

  it("zobrazí šipku ↑ pro PROGRESS a = pro HOLD", () => {
    render(
      <CycleReviewModal
        progressionSummary={mockProgressionSummary}
        onClose={vi.fn()}
      />
    )

    // 3× PROGRESS (squat, bench, deadlift) → 3× "↑"
    const upArrows = screen.getAllByText("↑")
    expect(upArrows.length).toBe(3)

    // 1× HOLD (press) → 1× "="
    expect(screen.getByText("=")).toBeInTheDocument()
  })

  it("zobrazí HOLD při prvním missu", () => {
    render(
      <CycleReviewModal
        progressionSummary={mockProgressionWithMiss}
        onClose={vi.fn()}
      />
    )

    // squat HOLD → "="
    expect(screen.getByText("=")).toBeInTheDocument()
    // text důvodu
    expect(screen.getByText(/TM zachováno/i)).toBeInTheDocument()
  })

  it("volá onClose po kliknutí na Pokračovat", () => {
    const onClose = vi.fn()
    render(
      <CycleReviewModal
        progressionSummary={mockProgressionSummary}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByText("Pokračovat"))
    expect(onClose).toHaveBeenCalled()
  })

  it("modal neobsahuje žádné tlačítko s textem 'Aplikovat'", () => {
    // CycleReviewModal je read-only — žádné mutace
    render(
      <CycleReviewModal
        progressionSummary={mockProgressionSummary}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText(/Aplikovat/i)).toBeNull()
    expect(screen.queryByText(/Ukládám/i)).toBeNull()
  })
})
