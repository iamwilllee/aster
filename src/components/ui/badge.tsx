import { Badge as FlatBadge } from '@/components/flatpack/badge'
import type { ComponentProps } from 'react'

// Aster keeps the shadcn name `destructive`; Flatpack calls the red badge `danger`.
type BadgeProps = Omit<ComponentProps<typeof FlatBadge>, 'variant'> & {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
}

function Badge({ variant = 'default', ...props }: BadgeProps) {
  return <FlatBadge variant={variant === 'destructive' ? 'danger' : variant} {...props} />
}

export { Badge }
