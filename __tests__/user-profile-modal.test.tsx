/**
 * @jest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import UserProfileModal from "@/components/user-profile-modal"

// UserProfileModal spouští několik nezávislých useQuery/useMutation volání
// (currentUser, exportData, bodyweight history, preferredUnit mutace...).
// Rozlišujeme je přes getFunctionName (reálná implementace z convex/server) —
// spoléhat na pořadí volání by bylo fragilní vůči re-renderům.
vi.mock("convex/react", async () => {
  const actual = await vi.importActual<typeof import("convex/server")>("convex/server")
  const { getFunctionName } = actual
  return {
    useQuery: vi.fn((query: unknown) => {
      const name = getFunctionName(query as never)
      if (name === "users:currentLoggedInUser") {
        return { preferredUnit: "kg", email: "athlete@example.com", athleteProfile: null }
      }
      if (name === "bodyweight:getBodyweightHistory") return []
      return null
    }),
    useMutation: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
  }
})

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/hooks/use-connection-state", () => ({
  useConnectionState: () => ({ isOnline: true, isSyncing: false }),
}))

vi.mock("@/hooks/use-offline-mutation", () => ({
  useOfflineMutation: () => ({ enqueueMutation: vi.fn().mockResolvedValue(undefined) }),
}))

// LanguageSwitcher (renderovaný uvnitř modalu) volá useRouter() — bez app router
// providera v testu je třeba mock (stejný požadavek jako u ostatních komponent).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

describe("UserProfileModal — rejecting onSubmit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("volá onSubmit, nechá modal otevřený a nevyprodukuje unhandled rejection", async () => {
    const unhandled: unknown[] = []
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason)
    }
    window.addEventListener("unhandledrejection", onUnhandledRejection)

    // Simuluje caller (workout-page.tsx handleProfileSave) — na chybu zavolá
    // toast.error a modal nechá renderovaný (nezavírá se).
    const onSubmit = vi.fn(async () => {
      toast.error("profile.saveFailed")
      throw new Error("save failed")
    })
    const onClose = vi.fn()

    render(<UserProfileModal onSubmit={onSubmit} onClose={onClose} />)

    const submitButton = screen.getByRole("button", { name: /uložit profil/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("profile.saveFailed")
    })

    // Modal se sám nezavírá (onClose je čistě na parentovi) a zůstává v DOM
    expect(screen.getByText("Profil atleta")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    // Nechme mikrotaskám doběhnout, aby se případný unhandled rejection stihl propsat
    await new Promise((resolve) => setTimeout(resolve, 0))

    window.removeEventListener("unhandledrejection", onUnhandledRejection)
    expect(unhandled).toHaveLength(0)
  })
})
