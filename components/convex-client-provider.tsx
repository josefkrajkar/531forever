"use client"

import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { ConvexReactClient } from "convex/react"
import { ReactNode } from "react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!

/**
 * Singleton instance ConvexReactClient — exportuje se pro přímý přístup
 * k metodám jako subscribeToConnectionState() v use-connection-state.ts.
 * Provider je stále zodpovědný za inject do React kontextu.
 */
export const convex = new ConvexReactClient(convexUrl)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>
}
