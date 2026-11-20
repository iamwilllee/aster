import * as React from 'react'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Check, Minus } from 'lucide-react'

export type CheckboxProps = Omit<BaseCheckbox.Root.Props, 'className' | 'children' | 'render'> & {
  /** Text beside the box. A string label also becomes the accessible name unless aria-label is set. */
  label?: React.ReactNode
  /** Class for the wrapping label. */
  className?: string
}

/**
 * Controlled (`checked` + `onCheckedChange`) or uncontrolled (`defaultChecked`). Every Base UI
 * root prop passes through: id, name, value, required, readOnly, form, inputRef, aria-*.
 */
export function Checkbox({ label, className, ...props }: CheckboxProps) {
  const root = (
    <BaseCheckbox.Root aria-label={typeof label === 'string' ? label : undefined} className={label == null ? className : undefined} {...props}>
        <BaseCheckbox.Indicator
          keepMounted
          data-slot="checkbox-box"
          render={(indicatorProps, state) => (
            <span
              {...indicatorProps}
              data-state={state.indeterminate ? 'indeterminate' : state.checked ? 'checked' : 'unchecked'}
            >
              {state.indeterminate
                ? <Minus size={12} strokeWidth={2.5} />
                : state.checked
                  ? <Check size={12} strokeWidth={2.5} />
                  : null}
            </span>
          )}
        />
    </BaseCheckbox.Root>
  )
  // Without a label the box stands alone, so an outer <Label> or aria-label can name it.
  // An empty wrapping <label> would otherwise become its (empty) accessible name.
  if (label == null) return root
  return (
    <label data-slot="checkbox" data-disabled={props.disabled ? 'true' : 'false'} className={className}>
      {root}
      <span data-slot="checkbox-label">{label}</span>
    </label>
  )
}
