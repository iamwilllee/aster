import type { ComponentProps } from 'react'
import { Switch as FlatSwitch } from '@/components/flatpack/switch'
import { useHydrated } from '@/lib/use-hydrated'

function Switch(props: ComponentProps<typeof FlatSwitch>) {
  const hydrated = useHydrated()
  return <FlatSwitch {...props} disabled={!hydrated || props.disabled} />
}

export { Switch }
