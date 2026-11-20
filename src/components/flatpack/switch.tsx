import * as React from 'react'
import { Switch as BaseSwitch } from '@base-ui/react/switch'

export type SwitchProps = Omit<BaseSwitch.Root.Props, 'className' | 'children' | 'render'> & {
  label?: React.ReactNode
  /** Class for the wrapping label. */
  className?: string
}

/** Controlled (`checked`) or uncontrolled (`defaultChecked`). Base UI root props pass through. */
export function Switch({ label, className, ...props }: SwitchProps) {
  const root = (
      <BaseSwitch.Root
        aria-label={typeof label === 'string' ? label : undefined}
        data-slot="switch-track"
        render={(rootProps, state) => (
          <span {...rootProps} data-state={state.checked ? 'checked' : 'unchecked'} />
        )}
        className={label == null ? className : undefined}
        {...props}
      >
        <BaseSwitch.Thumb data-slot="switch-thumb" />
      </BaseSwitch.Root>
  )
  // Without a label the track stands alone, so an outer <Label> or aria-label can name it.
  if (label == null) return root
  return (
    <label data-slot="switch" data-disabled={props.disabled ? 'true' : 'false'} className={className}>
      {root}
      <span data-slot="switch-label">{label}</span>
    </label>
  )
}
