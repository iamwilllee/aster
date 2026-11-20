import * as React from 'react'
import { Progress as BaseProgress } from '@base-ui/react/progress'

export type ProgressProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  value: number
  max?: number
  label?: React.ReactNode
  showValue?: boolean
  size?: 'sm' | 'default' | 'lg'
}

/** Pass `aria-label` when there is no visible `label`, so the bar still has an accessible name. */
export function Progress({ value, max = 100, label, showValue, size = 'default', ...rest }: ProgressProps) {
  const total = Number.isFinite(max) && max > 0 ? max : 1
  const current = Number.isFinite(value) ? Math.max(0, Math.min(total, value)) : 0
  const pct = (current / total) * 100
  return (
    <BaseProgress.Root value={current} max={total} data-slot="progress" data-size={size} {...rest}>
      {(label || showValue) && (
        <div data-slot="progress-header">
          {label && <span data-slot="progress-label">{label}</span>}
          {showValue && <span data-slot="progress-value">{Math.round(pct)}%</span>}
        </div>
      )}
      <BaseProgress.Track data-slot="progress-track">
        <BaseProgress.Indicator data-slot="progress-bar" style={{ width: `${pct}%` }} />
      </BaseProgress.Track>
    </BaseProgress.Root>
  )
}
