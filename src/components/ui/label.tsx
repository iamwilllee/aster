import type { ComponentProps } from 'react'
import { cn } from 'cn'
import { Label as FlatLabel } from '@/components/flatpack/input'

// Flatpack labels sit above a control with a bottom margin; Aster forms lay out with gap.
function Label({ className, ...props }: ComponentProps<typeof FlatLabel>) {
  return (
    <FlatLabel className={cn('mb-0 flex items-center gap-2 select-none', className)} {...props} />
  )
}

export { Label }
