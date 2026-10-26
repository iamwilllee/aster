export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const total = Number.isFinite(max) && max > 0 ? max : 1
  const current = Number.isFinite(value) ? Math.max(0, Math.min(total, value)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </div>
  )
}
