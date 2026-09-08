import { useState, type ReactNode } from 'react'
import type { NumberBreakdown } from '../types'

export function WhyThisNumber({
  breakdown,
  children,
}: {
  breakdown: NumberBreakdown
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-3">
      {children}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 text-xs font-medium text-[var(--teal)] underline-offset-2 hover:underline"
        aria-expanded={open}
      >
        {open ? 'Hide details' : 'Why this number?'}
      </button>
      {open ? (
        <div className="mt-3 space-y-2 rounded-md border border-[var(--line)] bg-white/60 px-3 py-3 text-xs leading-relaxed text-[var(--ink-soft)]">
          <p className="font-medium text-[var(--ink)]">{breakdown.title}</p>
          <p>{breakdown.oneLiner}</p>
          {breakdown.inputsUsed.length > 0 ? (
            <div>
              <p className="text-[10px] tracking-[0.1em] text-[var(--muted)] uppercase">
                Inputs used
              </p>
              <ul className="mt-1 space-y-0.5">
                {breakdown.inputsUsed.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {breakdown.steps.length > 0 ? (
            <div>
              <p className="text-[10px] tracking-[0.1em] text-[var(--muted)] uppercase">
                Steps
              </p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                {breakdown.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}
          <p>
            <span className="text-[var(--muted)]">Rule: </span>
            {breakdown.ruleUsed}
          </p>
          {breakdown.assumptions.length > 0 ? (
            <div>
              <p className="text-[10px] tracking-[0.1em] text-[var(--muted)] uppercase">
                Assumptions
              </p>
              <ul className="mt-1 space-y-0.5">
                {breakdown.assumptions.map((a) => (
                  <li key={a}>· {a}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
