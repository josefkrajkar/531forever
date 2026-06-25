"use client"

/**
 * auth-wrapper.tsx — Auth gate s offline fallback.
 *
 * ONLINE chování: beze změny.
 *   AuthLoading → spinner
 *   Authenticated → children
 *   Unauthenticated → SignInForm
 *
 * OFFLINE fallback (STRIKTNĚ ADITIVNÍ):
 *   Pokud navigator.onLine === false A getFlag('authSeen') === true,
 *   vykreslí children místo věčného AuthLoading.
 *   Token v localStorage zůstává; po obnovení sítě Convex doplní reálný auth.
 *
 * SSR/hydration bezpečnost:
 *   navigator přístupný až po mountu — do té doby standardní Convex chování.
 */

import { useEffect, useState } from "react"
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { useTranslation } from "react-i18next"
import { SignInForm } from "./sign-in-form"
import { setFlag, getFlag } from "@/lib/offline-store"

// ─── Podkomponenta: uloží příznak authSeen při úspěšném přihlášení ─────────

/**
 * AuthSeenRecorder — čistě side-effect komponenta.
 * Montuje se uvnitř <Authenticated>, takže víme, že uživatel byl autentizován.
 * Zapíše `authSeen = true` do IndexedDB pro offline fallback.
 */
function AuthSeenRecorder() {
  useEffect(() => {
    setFlag("authSeen", true).catch(() => {
      // best-effort — pokud IndexedDB selže, nevadí
    })
  }, [])

  return null
}

// ─── Hlavní komponenta ───────────────────────────────────────────────────────

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  // Offline fallback state — undefined = ještě nevíme (před mountu)
  const [offlineReady, setOfflineReady] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    // Až po mountu máme přístup k navigator
    const checkOffline = async () => {
      if (navigator.onLine) {
        // Online — standardní Convex auth, offline fallback nepotřeba
        setOfflineReady(false)
        return
      }

      // Offline — zkontroluj jestli jsme viděli auth
      const seen = await getFlag("authSeen")
      setOfflineReady(seen === true)
    }

    checkOffline()

    // Sleduj přechody online/offline za běhu
    const handleOnline = () => setOfflineReady(false)
    const handleOffline = async () => {
      const seen = await getFlag("authSeen")
      setOfflineReady(seen === true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Offline fallback: prokazatelně offline + authSeen = zobraz app
  // (offlineReady === undefined = před mountu = čekáme, nechej standardní Convex flow)
  if (offlineReady === true) {
    return <>{children}</>
  }

  // Standardní online flow — beze změny
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
            </div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground animate-pulse">
              {t("app.loading")}
            </p>
          </div>
        </div>
      </AuthLoading>
      <Authenticated>
        <AuthSeenRecorder />
        {children}
      </Authenticated>
      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>
    </>
  )
}
