import { cva } from 'class-variance-authority'

// Shared geometry for single-line form controls. Change the CSS tokens, not pages.
export const controlSizes = {
  sm: 'h-(--control-sm)',
  default: 'h-(--control-md)',
  lg: 'h-(--control-lg)',
} as const

export type ControlSize = keyof typeof controlSizes

export const controlVariants = cva(
  'w-full min-w-0 rounded-(--control-radius) border border-input bg-transparent px-3 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:ring-destructive/40',
  { variants: { size: controlSizes }, defaultVariants: { size: 'default' } },
)
