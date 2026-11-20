import * as React from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'

export type TooltipProps = {
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  /** Controlled (`open` + `onOpenChange`) or uncontrolled (`defaultOpen`). */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Milliseconds before it opens on hover. */
  delay?: number
  disabled?: boolean
  className?: string
  children: React.ReactElement
}

export function Tooltip({ content, side = 'top', align, sideOffset = 8, open, defaultOpen, onOpenChange, delay = 120, disabled, className, children }: TooltipProps) {
  return (
    <BaseTooltip.Provider delay={delay}>
      <BaseTooltip.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} disabled={disabled}>
        <BaseTooltip.Trigger render={<span data-slot="tooltip">{children}</span>} />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner data-slot="tooltip-positioner" side={side} align={align} sideOffset={sideOffset}>
            <BaseTooltip.Popup data-slot="tooltip-content" data-side={side} role="tooltip" className={className} style={{ pointerEvents: 'none' }}>
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  )
}

/* ---- compound API: the full Base UI surface -------------------------------
 * <TooltipProvider delay={400}>…
 *   <TooltipRoot>
 *     <TooltipTrigger render={<Button aria-label="Filters" />}>…</TooltipTrigger>
 *     <TooltipContent>Filter the list</TooltipContent>
 *   </TooltipRoot>
 * </TooltipProvider>
 * The trigger gets aria-describedby pointing at the content, so the tooltip is also
 * read as a description of the control.
 */
export const TooltipProvider = BaseTooltip.Provider

const TooltipIdContext = React.createContext<string | undefined>(undefined)

export function TooltipRoot({ children, ...props }: Omit<BaseTooltip.Root.Props, 'children'> & { children?: React.ReactNode }) {
  const id = React.useId()
  return (
    <TooltipIdContext.Provider value={id}>
      <BaseTooltip.Root {...props}>{children}</BaseTooltip.Root>
    </TooltipIdContext.Provider>
  )
}

export function TooltipTrigger(props: BaseTooltip.Trigger.Props) {
  const id = React.useContext(TooltipIdContext)
  return (
    <BaseTooltip.Trigger
      {...props}
      aria-describedby={[props['aria-describedby'], id].filter(Boolean).join(' ') || undefined}
    />
  )
}

export type TooltipContentProps = Omit<BaseTooltip.Popup.Props, 'className'> & {
  className?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

export function TooltipContent({ className, side = 'top', align, sideOffset = 8, ...props }: TooltipContentProps) {
  const id = React.useContext(TooltipIdContext)
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner data-slot="tooltip-positioner" side={side} align={align} sideOffset={sideOffset}>
        <BaseTooltip.Popup data-slot="tooltip-content" data-side={side} className={className} {...props} id={id} role="tooltip" />
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}
