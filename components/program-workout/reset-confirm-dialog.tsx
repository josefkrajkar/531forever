"use client"

import { useTranslation } from "react-i18next"

interface ResetConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function ResetConfirmDialog({ open, onClose, onConfirm }: ResetConfirmDialogProps) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full">
        <h3 className="font-heading font-bold uppercase tracking-widest text-lg mb-2 text-red-400">
          {t("program.resetConfirmTitle")}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("program.resetConfirmDescription")}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-border text-muted-foreground font-heading font-bold uppercase tracking-widest py-3 text-sm hover:bg-secondary transition-colors rounded"
          >
            {t("program.cancel")}
          </button>
          <button
            onClick={() => {
              onClose()
              onConfirm()
            }}
            className="flex-1 bg-red-500 text-white font-heading font-bold uppercase tracking-widest py-3 text-sm hover:opacity-90 rounded"
          >
            {t("program.delete")}
          </button>
        </div>
      </div>
    </div>
  )
}
