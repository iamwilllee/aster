import * as React from 'react'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { CircleCheck, CircleAlert, Info, X } from 'lucide-react'

/*
 * Two ways to use toasts.
 *
 * 1. Request-local (apps with SSR): wrap the app in <ToastProvider> and call
 *    const toast = useToast(); toast.add({ title, description, type }) from components.
 *    Nothing is created at module load, so server rendering shares no state.
 * 2. Global (static sites, demos): mount <Toaster /> once, then call toast({ … }) from anywhere.
 */

export type ToastOptions = {
  title: React.ReactNode
  description?: React.ReactNode
  type?: 'default' | 'success' | 'error'
  /** ms before it closes; 0 keeps it open */
  timeout?: number
  action?: { label: string; onClick: () => void }
}

// Created on first use, never at import time.
let manager: ReturnType<typeof BaseToast.createToastManager> | undefined
const getManager = () => (manager ??= BaseToast.createToastManager())

export function toast({ title, description, type = 'default', timeout, action }: ToastOptions) {
  return getManager().add({
    title,
    description,
    type,
    timeout,
    actionProps: action ? { children: action.label, onClick: action.onClick } : undefined,
  })
}
toast.close = (id: string) => getManager().close(id)

/** The toast manager of the nearest <ToastProvider>: add, close, update, promise. */
export const useToast = BaseToast.useToastManager

const ICON = { default: Info, success: CircleCheck, error: CircleAlert }

function ToastList({ dismissLabel }: { dismissLabel: string }) {
  const { toasts } = BaseToast.useToastManager()
  return toasts.map((t) => {
    const type = (t.type ?? 'default') as keyof typeof ICON
    const Icon = ICON[type] ?? Info
    return (
      <BaseToast.Root key={t.id} toast={t} data-slot="toast" data-type={type}>
        <span data-slot="toast-icon"><Icon size={16} /></span>
        <BaseToast.Content data-slot="toast-body">
          <BaseToast.Title data-slot="toast-title" />
          <BaseToast.Description data-slot="toast-description" />
          {t.actionProps && <BaseToast.Action data-slot="button" data-variant="outline" data-size="sm" />}
        </BaseToast.Content>
        <BaseToast.Close data-slot="toast-close" aria-hidden={false} aria-label={dismissLabel}><X size={16} /></BaseToast.Close>
      </BaseToast.Root>
    )
  })
}

export type ToastViewportProps = {
  /** Accessible name of each close button, for localized products. */
  dismissLabel?: string
  /** Accessible name of the notification region. */
  regionLabel?: string
}

function ToastPortal({ dismissLabel = 'Close', regionLabel = 'Notifications' }: ToastViewportProps) {
  return (
    <BaseToast.Portal>
      <BaseToast.Viewport data-slot="toast-viewport" aria-label={regionLabel}>
        <ToastList dismissLabel={dismissLabel} />
      </BaseToast.Viewport>
    </BaseToast.Portal>
  )
}

/** Request-local toasts: provide once near the root, then use useToast() below it. */
export function ToastProvider({ children, timeout = 5000, limit = 3, ...labels }: ToastViewportProps & { children?: React.ReactNode; timeout?: number; limit?: number }) {
  return (
    <BaseToast.Provider timeout={timeout} limit={limit}>
      {children}
      <ToastPortal {...labels} />
    </BaseToast.Provider>
  )
}

/** Global toasts: mount once, then call toast({ … }) from anywhere. */
export function Toaster({ timeout = 4000, limit = 3, ...labels }: ToastViewportProps & { timeout?: number; limit?: number }) {
  return (
    <BaseToast.Provider toastManager={getManager()} timeout={timeout} limit={limit}>
      <ToastPortal {...labels} />
    </BaseToast.Provider>
  )
}
