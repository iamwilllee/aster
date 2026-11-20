import type { ComponentProps } from 'react'
import { Textarea as FlatTextarea } from '@/components/flatpack/textarea'
import { useHydrated } from '@/lib/use-hydrated'

function Textarea({ rows = 3, ...props }: ComponentProps<typeof FlatTextarea>) {
  const hydrated = useHydrated()
  return <FlatTextarea rows={rows} {...props} disabled={!hydrated || props.disabled} />
}

export { Textarea }
