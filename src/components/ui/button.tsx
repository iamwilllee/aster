import { Button as FlatButton, buttonProps, type ButtonProps } from '@/components/flatpack/button'
import { useHydrated } from '@/lib/use-hydrated'

export { buttonProps }
export type { ButtonSize, ButtonVariant } from '@/components/flatpack/button'

// Aster behavior on top of Flatpack: inert until React can handle the action during SSR.
function Button(props: ButtonProps) {
  const hydrated = useHydrated()
  return <FlatButton {...props} disabled={!hydrated || props.disabled} />
}

export { Button }
