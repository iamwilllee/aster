import type { ComponentProps } from 'react'
import { Checkbox as FlatCheckbox } from '@/components/flatpack/checkbox'
import { useHydrated } from '@/lib/use-hydrated'

function Checkbox(props: ComponentProps<typeof FlatCheckbox>) {
  const hydrated = useHydrated()
  return <FlatCheckbox {...props} disabled={!hydrated || props.disabled} />
}

export { Checkbox }
