import type { ComponentProps } from 'react'
import {
  Tabs,
  TabsList,
  TabsTrigger as FlatTabsTrigger,
  TabsContent as FlatTabsContent,
} from '@/components/flatpack/tabs'
import { useHydrated } from '@/lib/use-hydrated'

export { Tabs, TabsList }

function TabsTrigger(props: ComponentProps<typeof FlatTabsTrigger>) {
  const hydrated = useHydrated()
  return <FlatTabsTrigger {...props} disabled={!hydrated || props.disabled} />
}

// Aster unmounts inactive panels (Flatpack keeps them mounted by default), so heavy panels
// and their entrance motion start when the tab opens.
function TabsContent({ keepMounted = false, ...props }: ComponentProps<typeof FlatTabsContent>) {
  return <FlatTabsContent keepMounted={keepMounted} {...props} />
}

export { TabsTrigger, TabsContent }
