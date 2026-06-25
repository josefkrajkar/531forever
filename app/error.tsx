"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-sm p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-heading font-extrabold text-xl uppercase tracking-widest">
            Něco se pokazilo
          </h1>
          <p className="text-sm text-muted-foreground">
            Při načítání stránky nastala neočekávaná chyba.
          </p>
        </div>

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest px-5 py-2.5 text-xs hover:opacity-90 transition-opacity"
        >
          <RotateCcw className="w-4 h-4" />
          Zkusit znovu
        </button>
      </div>
    </div>
  )
}
