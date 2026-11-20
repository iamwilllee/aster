import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'

type Size = 'sm' | 'md' | 'default' | 'lg'
/** `default` is accepted as an alias of `md`, the name Button uses. */
const sizeAttr = (size: Size) => (size === 'default' ? 'md' : size)

/* ---- compound API: the full Base UI surface -------------------------------
 * <SelectRoot value onValueChange name required>
 *   <SelectTrigger aria-label="Status"><SelectValue placeholder="Choose" /></SelectTrigger>
 *   <SelectContent><SelectItem value="a">A</SelectItem></SelectContent>
 * </SelectRoot>
 */
export const SelectRoot = BaseSelect.Root
export const SelectValue = BaseSelect.Value

export function SelectTrigger({ className, size = 'md', children, ...props }: Omit<BaseSelect.Trigger.Props, 'className'> & { className?: string; size?: Size }) {
  return (
    <BaseSelect.Trigger data-slot="select-trigger" data-size={sizeAttr(size)} className={className} {...props}>
      {children}
      <BaseSelect.Icon data-slot="select-icon">
        <ChevronDown size={16} />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
}

export function SelectContent({ className, children, ...props }: Omit<BaseSelect.Popup.Props, 'className'> & { className?: string }) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner data-slot="select-positioner" sideOffset={6} align="start" alignItemWithTrigger={false}>
        <BaseSelect.Popup data-slot="select-content" className={className} {...props}>
          <BaseSelect.List>{children}</BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
}

export function SelectItem({ className, children, ...props }: Omit<BaseSelect.Item.Props, 'className'> & { className?: string }) {
  return (
    <BaseSelect.Item data-slot="select-item" className={className} {...props}>
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
      <BaseSelect.ItemIndicator data-slot="select-item-check">
        <Check size={16} />
      </BaseSelect.ItemIndicator>
    </BaseSelect.Item>
  )
}

/* ---- options API: the short form ------------------------------------------ */
type Option = { value: string; label: string; disabled?: boolean }
export type SelectProps = {
  options: Option[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** sm 32 / md 40 / lg 48, same as Button */
  size?: Size
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Form field name, submitted with the surrounding <form>. */
  name?: string
  required?: boolean
  id?: string
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
}

/** Controlled (`value`) or uncontrolled (`defaultValue`). Use SelectTrigger/SelectContent for anything the options form cannot express. */
export function Select({
  options, value, defaultValue, onValueChange, placeholder = 'Select…', disabled, size = 'md',
  open, defaultOpen, onOpenChange, name, required, id, className, ...aria
}: SelectProps) {
  return (
    <BaseSelect.Root
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      name={name}
      required={required}
      items={options}
      onValueChange={(nextValue) => onValueChange?.(nextValue as string)}
    >
      <div data-slot="select" className={className}>
        <BaseSelect.Trigger data-slot="select-trigger" data-size={sizeAttr(size)} id={id} {...aria}>
          <BaseSelect.Value
            render={(props, state) => (
              <span
                {...props}
                data-placeholder={options.some((o) => o.value === state.value) ? 'false' : 'true'}
              />
            )}
          >
            {(current) => options.find((o) => o.value === current)?.label ?? placeholder}
          </BaseSelect.Value>
          <BaseSelect.Icon data-slot="select-icon">
            <ChevronDown size={16} />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
        <BaseSelect.Portal>
          <BaseSelect.Positioner data-slot="select-positioner" sideOffset={6} alignItemWithTrigger={false}>
            <BaseSelect.Popup data-slot="select-content">
              <BaseSelect.List>
                {options.map((o) => (
                  <BaseSelect.Item
                    key={o.value}
                    value={o.value}
                    disabled={o.disabled}
                    data-slot="select-item"
                    render={(props, state) => (
                      <div {...props} data-selected={state.selected ? 'true' : 'false'} />
                    )}
                  >
                    <BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
                    <BaseSelect.ItemIndicator data-slot="select-item-check">
                      <Check size={16} />
                    </BaseSelect.ItemIndicator>
                  </BaseSelect.Item>
                ))}
              </BaseSelect.List>
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </div>
    </BaseSelect.Root>
  )
}
