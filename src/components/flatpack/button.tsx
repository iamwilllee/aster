import { Button as BaseButton } from '@base-ui/react/button'

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
/** `md` is accepted as an alias of `default`, the name Input and Select use. */
export type ButtonSize = 'default' | 'md' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'

export type ButtonProps = Omit<BaseButton.Props, 'className'> & {
  className?: string
  variant?: ButtonVariant
  size?: ButtonSize
}

/**
 * The attributes that make any element look like a Button. Spread them onto a link:
 * <a {...buttonProps({ variant: 'outline' })} href="/docs">Docs</a>
 */
export function buttonProps({ variant = 'default', size = 'default' }: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  return { 'data-slot': 'button', 'data-variant': variant, 'data-size': size === 'md' ? 'default' : size } as const
}

export function Button({ variant = 'default', size = 'default', className, type = 'button', ...props }: ButtonProps) {
  // The button identity comes last so a parent that merges its own data-slot (Dialog.Close,
  // Menu.Trigger…) through `render` cannot turn this Button into something else.
  return <BaseButton type={type} className={className} {...props} {...buttonProps({ variant, size })} />
}
