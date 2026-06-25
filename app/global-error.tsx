"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="cs">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "#0a0a0a",
          color: "#f0f0f0",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div
          style={{
            maxWidth: "28rem",
            width: "100%",
            backgroundColor: "#141414",
            border: "1px solid #292929",
            borderRadius: "2px",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "50%",
              backgroundColor: "rgba(239,68,68,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
            }}
          >
            <AlertTriangle
              style={{ width: "1.75rem", height: "1.75rem", color: "#ef4444" }}
            />
          </div>

          <h1
            style={{
              fontWeight: 800,
              fontSize: "1.125rem",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              marginBottom: "0.5rem",
            }}
          >
            Něco se pokazilo
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#878787",
              marginBottom: "1.5rem",
            }}
          >
            Nastala kritická chyba aplikace.
          </p>

          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              backgroundColor: "#ff4500",
              color: "#0a0a0a",
              fontWeight: 700,
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "0.625rem 1.25rem",
              border: "none",
              cursor: "pointer",
              opacity: 1,
            }}
            onMouseOver={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.opacity = "0.9")
            }
            onMouseOut={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.opacity = "1")
            }
          >
            <RotateCcw style={{ width: "1rem", height: "1rem" }} />
            Zkusit znovu
          </button>
        </div>
      </body>
    </html>
  )
}
