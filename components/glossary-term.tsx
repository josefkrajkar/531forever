"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { isSupportedLang } from "@/lib/i18n-config"
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Props {
  term: GlossaryKey
  children: React.ReactNode
  /** Skrýt tečkované podtržení – použij, když vizuální kontext je jasný */
  noUnderline?: boolean
}

/**
 * Obalí text glossárním popoverem.
 * Kliknutím se zobrazí název a popis termínu ve správném jazyce.
 *
 * Použití:
 *   <GlossaryTerm term="amrap">AMRAP</GlossaryTerm>
 *   <GlossaryTerm term="tm">Training Max</GlossaryTerm>
 */
export function GlossaryTerm({ term, children, noUnderline = false }: Props) {
  const [open, setOpen] = useState(false)
  const { i18n } = useTranslation()

  const lang = isSupportedLang(i18n.language) ? i18n.language : "cs"
  const entry = GLOSSARY[term]

  if (!entry) {
    console.warn(`[GlossaryTerm] Unknown term key: "${term}"`)
    return <>{children}</>
  }

  const { title, desc } = entry[lang]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Vysvětlit: ${title}`}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              setOpen((v) => !v)
            }
          }}
          className={
            noUnderline
              ? "cursor-pointer"
              : "cursor-help border-b border-dashed border-muted-foreground/50 hover:border-primary/70 transition-colors"
          }
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-72 p-0 border-border bg-card text-card-foreground shadow-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Barevný accent proužek nahoře */}
        <div className="h-0.5 w-full bg-primary rounded-t-md" />
        <div className="p-4">
          <p className="text-xs font-heading font-bold uppercase tracking-widest text-primary mb-1.5">
            {title}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {desc}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
