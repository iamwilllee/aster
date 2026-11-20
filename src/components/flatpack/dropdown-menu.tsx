import { ChevronDown } from 'lucide-react'
import { Menu as BaseMenu } from '@base-ui/react/menu'

/** Controlled (`open` + `onOpenChange`) or uncontrolled (`defaultOpen`). Renders no element of its own. */
export const DropdownMenu = BaseMenu.Root

export type DropdownMenuTriggerProps = Omit<BaseMenu.Trigger.Props, 'className'> & {
  size?: 'sm' | 'md' | 'default' | 'lg'
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
  className?: string
  /** Hide the chevron, e.g. for an icon-only trigger. */
  hideChevron?: boolean
}

/** A Button with a chevron. Pass `render={<Button …/>}` to bring your own trigger element. */
export function DropdownMenuTrigger({ children, size = 'md', variant = 'outline', className, render, hideChevron, ...props }: DropdownMenuTriggerProps) {
  const own = render === undefined
  return (
    <BaseMenu.Trigger
      className={className}
      render={render}
      {...(own ? { 'data-slot': 'button', 'data-variant': variant, 'data-size': size === 'md' ? 'default' : size } : {})}
      {...props}
    >
      {children}
      {own && !hideChevron && <ChevronDown size={16} />}
    </BaseMenu.Trigger>
  )
}

export type DropdownMenuContentProps = Omit<BaseMenu.Popup.Props, 'className'> & {
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  className?: string
}

export function DropdownMenuContent({ side, align = 'start', sideOffset = 6, className, ...props }: DropdownMenuContentProps) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner data-slot="dropdown-positioner" side={side} align={align} sideOffset={sideOffset}>
        <BaseMenu.Popup data-slot="dropdown-content" className={className} {...props} />
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

export type DropdownMenuItemProps = Omit<BaseMenu.Item.Props, 'className'> & {
  className?: string
  /** Red text for an irreversible action. */
  destructive?: boolean
  /** Shorthand for onClick. */
  onSelect?: () => void
}

export function DropdownMenuItem({ className, destructive, onSelect, onClick, ...props }: DropdownMenuItemProps) {
  return (
    <BaseMenu.Item
      data-slot="dropdown-item"
      data-destructive={destructive ? '' : undefined}
      className={className}
      onClick={(event) => {
        onClick?.(event)
        onSelect?.()
      }}
      {...props}
    />
  )
}

export function DropdownMenuSeparator(props: BaseMenu.Separator.Props) {
  return <BaseMenu.Separator data-slot="dropdown-separator" {...props} />
}
