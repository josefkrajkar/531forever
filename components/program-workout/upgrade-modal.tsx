"use client"

import { useTranslation } from "react-i18next"

import { TEMPLATES } from "@/lib/templates"
import { type SupplementalTemplate } from "@/lib/531"

interface UpgradeModalProps {
  open: boolean
  selectedTemplate: SupplementalTemplate
  upgrading: boolean
  onSelectTemplate: (template: SupplementalTemplate) => void
  onClose: () => void
  onConfirm: () => void
}

export default function UpgradeModal({
  open,
  selectedTemplate,
  upgrading,
  onSelectTemplate,
  onClose,
  onConfirm,
}: UpgradeModalProps) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="font-heading font-bold uppercase tracking-widest text-lg mb-2">
          {t("upgrade.modalTitle")}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("upgrade.modalSubtitle")}
        </p>

        {/* Template selection */}
        <div className="space-y-2 mb-6">
          {(["bbb", "fsl", "ssl", "bbs"] as const).map((template) => {
            const config = TEMPLATES[template]
            return (
              <button
                key={template}
                onClick={() => onSelectTemplate(template)}
                className={`w-full p-3 rounded border text-left transition-all ${
                  selectedTemplate === template
                    ? "bg-primary/20 border-primary"
                    : "bg-background border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{t(config.name)}</p>
                    <p className="text-xs text-muted-foreground">{t(config.shortDescription)}</p>
                  </div>
                  {selectedTemplate === template && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs">
                      ✓
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* What's preserved */}
        <div className="bg-secondary/50 rounded p-3 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">{t("upgrade.preserved")}</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ {t("upgrade.preservedTm")}</li>
            <li>✓ {t("upgrade.preservedE1rm")}</li>
            <li>✓ {t("upgrade.preservedAmrap")}</li>
            <li>✓ {t("upgrade.preservedStats")}</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={upgrading}
            className="flex-1 border border-border text-muted-foreground font-heading font-bold uppercase tracking-widest py-3 text-sm hover:bg-secondary transition-colors rounded disabled:opacity-50"
          >
            {t("program.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={upgrading}
            className="flex-1 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest py-3 text-sm hover:opacity-90 rounded disabled:opacity-50"
          >
            {upgrading ? t("upgrade.upgrading") : t("upgrade.confirm")}
          </button>
        </div>
      </div>
    </div>
  )
}
