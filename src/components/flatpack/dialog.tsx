import * as React from 'react'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'

type TriggerVariant = 'default' | 'secondary' | 'outline' | 'ghost'

/**
 * Controlled (`open` + `onOpenChange`) or uncontrolled (`defaultOpen`). Every Base UI root prop
 * passes through, e.g. `modal`, `onOpenChangeComplete`, `actionsRef`.
 */
export function Dialog(props: BaseDialog.Root.Props) {
  return <BaseDialog.Root {...props} />
}

export type DialogTriggerProps = Omit<BaseDialog.Trigger.Props, 'className'> & {
  size?: 'sm' | 'md' | 'default' | 'lg'
  variant?: TriggerVariant
  className?: string
}

/** A Button that opens the dialog. Pass `render={<Button …/>}` to use your own element instead. */
export function DialogTrigger({ size = 'md', variant = 'outline', className, render, ...props }: DialogTriggerProps) {
  const own = render === undefined
  return (
    <BaseDialog.Trigger
      className={className}
      render={render}
      {...(own ? { 'data-slot': 'button', 'data-variant': variant, 'data-size': size === 'md' ? 'default' : size } : {})}
      {...props}
    />
  )
}

export type DialogContentProps = Omit<BaseDialog.Popup.Props, 'className'> & {
  className?: string
  /** A corner × button. Off by default; Footer buttons usually close the dialog. */
  showCloseButton?: boolean
  /** Accessible name of the × button, for localized products. */
  closeLabel?: string
}

export function DialogContent({ children, className, showCloseButton = false, closeLabel = 'Close', ...props }: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop data-slot="dialog-overlay" />
      <BaseDialog.Popup data-slot="dialog-content" className={className} {...props}>
        {children}
        {showCloseButton && (
          <BaseDialog.Close data-slot="button" data-variant="ghost" data-size="icon-sm" aria-label={closeLabel} style={{ position: 'absolute', top: 'var(--fp-space-3)', right: 'var(--fp-space-3)' }}>
            <X size={16} />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="dialog-header" className={className} {...props} />
}

export function DialogTitle({ className, ...props }: Omit<BaseDialog.Title.Props, 'className'> & { className?: string }) {
  return <BaseDialog.Title data-slot="dialog-title" className={className} {...props} />
}

export function DialogDescription({ className, ...props }: Omit<BaseDialog.Description.Props, 'className'> & { className?: string }) {
  return <BaseDialog.Description data-slot="dialog-description" className={className} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="dialog-footer" className={className} {...props} />
}

/** Closes the dialog. A ghost Button by default; pass `render` to compose with another element. */
export function DialogClose({ className, render, ...props }: Omit<BaseDialog.Close.Props, 'className'> & { className?: string }) {
  const own = render === undefined
  return (
    <BaseDialog.Close
      className={className}
      render={render}
      {...(own ? { 'data-slot': 'button', 'data-variant': 'ghost', 'data-size': 'default' } : {})}
      {...props}
    />
  )
}
