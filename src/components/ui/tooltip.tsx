import type { ComponentProps } from 'react'
import { cn } from 'cn'
import {
  TooltipContent as FlatTooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@/components/flatpack/tooltip'

// Aster composes tooltips from parts: <Tooltip><TooltipTrigger/><TooltipContent/></Tooltip>.
const Tooltip = TooltipRoot

// Long text wraps instead of running on one line.
function TooltipContent({ className, ...props }: ComponentProps<typeof FlatTooltipContent>) {
  return <FlatTooltipContent className={cn('max-w-64 whitespace-normal', className)} {...props} />
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
