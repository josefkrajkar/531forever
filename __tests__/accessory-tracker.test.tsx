import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import AccessoryTracker from "@/components/accessory-tracker"

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}))

vi.mock("@/hooks/use-preferred-unit", () => ({
  usePreferredUnit: () => ({
    toDisplay: (weight: number) => weight,
    fromDisplay: (weight: number) => weight,
    label: "kg",
  }),
}))

describe("AccessoryTracker", () => {
  it("označí Turkish get-up jako opakování na stranu", () => {
    render(<AccessoryTracker accessoryIds={["turkish_get_up"]} onComplete={vi.fn()} />)

    expect(screen.getAllByText(/3-5 na stranu/i)).toHaveLength(3)
  })
})
