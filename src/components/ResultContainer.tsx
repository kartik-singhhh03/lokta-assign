import type { Answer } from '../types'
import { isEngineReady } from '../engine'
import { formatInr } from '../utils'

interface ResultContainerProps {
  answers: Answer[]
  onRestart: () => void
  onEditAnswers: () => void
}

/** Placeholder result shell — engine rules are not wired yet. */
export function ResultContainer({
  answers,
  onRestart,
  onEditAnswers,
}: ResultContainerProps) {
  const knownCount = answers.filter((a) => a.value !== null).length
  const unknownCount = answers.length - knownCount
  const engineReady = isEngineReady()

  return (
    <section className="mx-auto flex min-h-[100svh] w-full max-w-lg flex-col px-5 pb-12 pt-6 sm:px-8">
      <header className="mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onEditAnswers}
          className="text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
        >
          Edit answers
        </button>
        <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          Your outlook
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="text-sm text-[var(--muted)] transition hover:text-[var(--ink-soft)]"
        >
          Reset
        </button>
      </header>

      <div className="animate-rise">
        <p className="text-xs tracking-[0.12em] text-[var(--muted)] uppercase">
          Assessment captured
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[var(--ink)]">
          Results will appear here
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--ink-soft)]">
          Your answers are ready. The calculation engine is intentionally not
          connected yet, so we will not invent figures or treat unknowns as{' '}
          {formatInr(0)}.
        </p>
      </div>

      <div className="animate-rise-delay-1 mt-8 space-y-3 border-y border-[var(--line)] py-6">
        <ResultRow label="Answers recorded" value={String(answers.length)} />
        <ResultRow label="Known values" value={String(knownCount)} />
        <ResultRow label="Left unknown" value={String(unknownCount)} />
        <ResultRow
          label="Engine status"
          value={engineReady ? 'Ready' : 'Stub — pending rules'}
        />
      </div>

      <div className="animate-rise-delay-2 mt-8 space-y-6">
        <OutcomeSlot
          title="1. Should I borrow?"
          body="Borrow / caution / avoid — with an explainable rationale."
        />
        <OutcomeSlot
          title="2. Sanction vs safe carry"
          body="Likely lender sanction range beside the amount you can safely service."
        />
        <OutcomeSlot
          title="3. Fair rate & all-in APR"
          body="A confidence-aware interest band. Missing credit data widens the range."
        />
        <OutcomeSlot
          title="4. EMI to agree to"
          body="Recommended EMI band in ₹, never forced to zero when inputs are missing."
        />
        <OutcomeSlot
          title="Negotiation Card"
          body="Talking points, max acceptable EMI, and watchouts for the lender conversation."
        />
      </div>

      <div className="animate-rise-delay-3 mt-10 flex flex-col gap-3">
        <button
          type="button"
          onClick={onEditAnswers}
          className="inline-flex items-center justify-center rounded-md bg-[var(--teal)] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-[var(--teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
        >
          Refine answers
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="py-2 text-sm text-[var(--muted)] transition hover:text-[var(--ink-soft)]"
        >
          Start over
        </button>
      </div>
    </section>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium tabular-nums text-[var(--ink)]">{value}</span>
    </div>
  )
}

function OutcomeSlot({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
    </div>
  )
}
