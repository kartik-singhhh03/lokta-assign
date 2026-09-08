interface ProgressIndicatorProps {
  current: number
  total: number
  sectionLabel?: string
}

export function ProgressIndicator({
  current,
  total,
  sectionLabel,
}: ProgressIndicatorProps) {
  const safeTotal = Math.max(total, 1)
  const clamped = Math.min(Math.max(current, 0), safeTotal)
  const percent = Math.round((clamped / safeTotal) * 100)

  return (
    <div className="w-full animate-fade" role="status" aria-live="polite">
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-[var(--ink-soft)]">
          {sectionLabel ?? 'Assessment'}
        </span>
        <span className="tabular-nums text-[var(--muted)]">
          {clamped} / {safeTotal}
          <span className="sr-only"> questions · {percent}% complete</span>
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-sm bg-[var(--mist-deep)]"
        aria-hidden="true"
      >
        <div
          className="h-full origin-left rounded-sm bg-[var(--teal)] transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
