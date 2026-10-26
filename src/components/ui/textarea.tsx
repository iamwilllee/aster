import type { ComponentProps } from 'react'
import { cn } from 'cn'
import { controlVariants } from './control'
import { useHydrated } from '@/lib/use-hydrated'

function Textarea({ className, rows = 3, ...props }: ComponentProps<'textarea'>) {
  const hydrated = useHydrated()
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(
        controlVariants({ size: null }),
        'block min-h-24 resize-y py-2 [--control-radius:var(--radius-lg)]',
        className,
      )}
      {...props}
      disabled={!hydrated || props.disabled}
    />
  )
}

export { Textarea }
