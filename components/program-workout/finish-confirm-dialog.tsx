"use client"

import { useTranslation } from "react-i18next"

interface FinishConfirmDialogProps {
  open: boolean
  finishing: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function FinishConfirmDialog({ open, finishing, onClose, onConfirm }: FinishConfirmDialogProps) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full">
        <h3 className="font-heading font-bold uppercase tracking-widest text-lg mb-2">
          {t("workout.finishConfirmTitle")}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("workout.finishConfirmDescription")}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-border text-muted-foreground font-heading font-bold uppercase tracking-widest py-3 text-sm hover:bg-secondary transition-colors rounded"
          >
            {t("program.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={finishing}
            className="flex-1 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest py-3 text-sm hover:opacity-90 disabled:opacity-50 rounded"
          >
            {finishing ? t("workout.finishing") : t("workout.finishConfirm")}
          </button>
        </div>
      </div>
    </div>
  )
}
