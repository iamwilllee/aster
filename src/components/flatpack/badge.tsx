import * as React from 'react'

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'danger'
}

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return <span data-slot="badge" data-variant={variant} className={className} {...props} />
}
