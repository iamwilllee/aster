import type { ComponentProps } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent as FlatDropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/flatpack/dropdown-menu'

// Compose the trigger with render={<Button ... />} to share geometry and hydration handling.
// Aster menus open toward the end edge of their trigger.
function DropdownMenuContent({
  align = 'end',
  ...props
}: ComponentProps<typeof FlatDropdownMenuContent>) {
  return <FlatDropdownMenuContent align={align} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
