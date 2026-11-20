import * as React from 'react'
import { CheckCircle2, Info, AlertCircle, XCircle, X } from 'lucide-react'

type Variant = 'info' | 'success' | 'warning' | 'error'
export type AlertProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  variant?: Variant
  title?: React.ReactNode
  onClose?: () => void
  /** Accessible name of the close button, for localized products. */
  closeLabel?: string
}

const ICONS: Record<Variant, React.ReactNode> = {
  info: <Info size={16} />,
  success: <CheckCircle2 size={16} />,
  warning: <AlertCircle size={16} />,
  error: <XCircle size={16} />,
}

export function Alert({ variant = 'info', title, children, onClose, closeLabel = 'Close', ...props }: AlertProps) {
  return (
    <div data-slot="alert" data-variant={variant} role="alert" {...props}>
      <span data-slot="alert-icon">{ICONS[variant]}</span>
      <div data-slot="alert-body">
        {title && <div data-slot="alert-title">{title}</div>}
        {children && <div data-slot="alert-description">{children}</div>}
      </div>
      {onClose && (
        <button data-slot="alert-close" type="button" onClick={onClose} aria-label={closeLabel}>
          <X size={16} />
        </button>
      )}
    </div>
  )
}
