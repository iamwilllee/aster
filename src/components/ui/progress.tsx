import { Progress as FlatProgress } from '@/components/flatpack/progress'

// Aster's `label` is the accessible name (there is no visible caption).
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  return <FlatProgress value={value} max={max} aria-label={label} />
}
