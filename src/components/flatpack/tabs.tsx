import { Tabs as BaseTabs } from '@base-ui/react/tabs'

export type TabsProps = Omit<BaseTabs.Root.Props, 'className'> & { className?: string }

/** Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`). The active tab is styled from Base UI's data-active. */
export function Tabs({ className, ...props }: TabsProps) {
  return <BaseTabs.Root data-slot="tabs" className={className} {...props} />
}

export function TabsList({ className, ...props }: Omit<BaseTabs.List.Props, 'className'> & { className?: string }) {
  return <BaseTabs.List data-slot="tabs-list" className={className} {...props} />
}

export function TabsTrigger({ className, ...props }: Omit<BaseTabs.Tab.Props, 'className'> & { className?: string }) {
  return <BaseTabs.Tab data-slot="tabs-trigger" className={className} {...props} />
}

/** Panels stay mounted by default so form state survives a tab switch. Pass keepMounted={false} to unmount. */
export function TabsContent({ className, keepMounted = true, ...props }: Omit<BaseTabs.Panel.Props, 'className'> & { className?: string }) {
  return <BaseTabs.Panel data-slot="tabs-content" keepMounted={keepMounted} className={className} {...props} />
}
