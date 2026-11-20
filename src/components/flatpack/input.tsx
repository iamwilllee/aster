import * as React from 'react'
import { Input as BaseInput } from '@base-ui/react/input'

/** `default` is accepted as an alias of `md`, the name Button uses. */
export type ControlSize = 'sm' | 'md' | 'default' | 'lg'

export type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  /** sm 32 / md 40 / lg 48, same as Button. Controls in one row share one size. */
  size?: ControlSize
  /** The native `size` attribute: the visible width in characters. */
  htmlSize?: number
  /** outline: 1px border (default). filled: light grey fill, no border, e.g. a search box. */
  variant?: 'outline' | 'filled'
  /** Icon before the text, e.g. <Search />. */
  leading?: React.ReactNode
  /** Icon or short text after the text, e.g. a unit or <Kbd>. */
  trailing?: React.ReactNode
}

/**
 * A Base UI input, so it joins Field (labels, validity, dirty/touched) and forwards `ref`.
 * Every native input attribute passes through.
 */
export function Input({ className, style, size: sizeProp = 'md', htmlSize, variant = 'outline', leading, trailing, ...props }: InputProps) {
  const size = sizeProp === 'default' ? 'md' : sizeProp
  if (leading == null && trailing == null) {
    return <BaseInput data-slot="input" data-size={size} data-variant={variant} size={htmlSize} className={className} style={style} {...props} />
  }
  // With icons the group draws the field; the inner input is bare.
  return (
    <div data-slot="input-group" data-size={size} data-variant={variant} data-disabled={props.disabled ? 'true' : undefined} className={className} style={style}>
      {leading != null && <span data-slot="input-adornment" aria-hidden="true">{leading}</span>}
      <BaseInput data-slot="input-bare" size={htmlSize} {...props} />
      {trailing != null && <span data-slot="input-adornment">{trailing}</span>}
    </div>
  )
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label data-slot="label" className={className} {...props} />
}
