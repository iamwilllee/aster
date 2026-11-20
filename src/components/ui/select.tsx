import type { ComponentProps } from 'react'
import { cn } from 'cn'
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger as FlatSelectTrigger,
  SelectValue,
} from '@/components/flatpack/select'
import { useHydrated } from '@/lib/use-hydrated'

// Aster composes selects from Base UI parts: <Select><SelectTrigger/><SelectContent/></Select>.
const Select = SelectRoot

function SelectTrigger({ className, ...props }: ComponentProps<typeof FlatSelectTrigger>) {
  const hydrated = useHydrated()
  return (
    <FlatSelectTrigger
      className={cn('[&>span]:truncate', className)}
      {...props}
      disabled={!hydrated || props.disabled}
    />
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
