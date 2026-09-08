import type { NegotiationCard } from '../types'
import {
  formatInr,
  formatInrRange,
  formatPercentPoints,
} from '../utils'

interface NegotiationCardViewProps {
  card: NegotiationCard
}

export function NegotiationCardView({ card }: NegotiationCardViewProps) {
  return (
    <article
      id="borrower-card"
      className="borrower-print-card rounded-lg border border-[var(--line)] bg-[var(--paper)] px-5 py-6 shadow-[var(--shadow-soft)] sm:px-7 sm:py-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
            Lokta · Borrower Copilot
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)] sm:text-3xl">
            Your Borrower Card
          </h2>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden shrink-0 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink-soft)] transition hover:border-[var(--teal)] hover:text-[var(--ink)]"
        >
          Print / Save
        </button>
      </div>

      <p className="mt-2 text-xs text-[var(--muted)]">
        Self-assessment anchors — not a lender approval or guaranteed rate.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 border-y border-[var(--line)] py-5 sm:grid-cols-4">
        <HeroStat
          label="Fair rate"
          value={`${formatPercentPoints(card.fairRateRange.low)} – ${formatPercentPoints(card.fairRateRange.high)}`}
        />
        <HeroStat
          label="Safe EMI"
          value={`${formatInr(card.emiCeiling)} / mo`}
        />
        <HeroStat
          label="Safe borrowing"
          value={formatInrRange(
            card.safeAmountRange.low,
            card.safeAmountRange.high,
          )}
        />
        <HeroStat
          label="Negotiation target"
          value={`≤ ${formatPercentPoints(card.negotiationTargetRate)}`}
        />
      </div>

      <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
        <Row label="Decision" value={card.decision.replaceAll('_', ' ')} />
        <Row
          label="Product"
          value={card.product.replaceAll('_', ' ')}
        />
        <Row label="Requested" value={formatInr(card.requestedAmount)} />
        <Row label="Recommended" value={formatInr(card.recommendedAmount)} />
        <Row
          label="Estimated lender range"
          value={formatInrRange(
            card.estimatedLenderAmountRange.low,
            card.estimatedLenderAmountRange.high,
          )}
        />
        <Row
          label="Expected rate / APR"
          value={`${formatPercentPoints(card.expectedRate)} / ${formatPercentPoints(card.apr)} APR`}
        />
        <Row
          label="Illustrative fee"
          value={`${formatPercentPoints(card.processingFeePercent)} (${formatInr(card.processingFeeAmount)})`}
        />
        <Row
          label="Suggested tenure"
          value={
            card.suggestedTenureMonths !== null
              ? `${card.suggestedTenureMonths} months`
              : '—'
          }
        />
      </div>

      <div className="mt-6">
        <h3 className="text-xs tracking-[0.14em] text-[var(--muted)] uppercase">
          Why this range
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
          {card.reasons.slice(0, 3).map((reason) => (
            <li key={reason}>· {reason}</li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="text-xs tracking-[0.14em] text-[var(--muted)] uppercase">
          Ask the lender
        </h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-[var(--ink-soft)]">
          {card.questionsToAskLender.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-[var(--muted)]">
        Confidence: {card.confidence.toUpperCase()} — {card.confidenceReason}
      </p>
    </article>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.12em] text-[var(--muted)] uppercase">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-base leading-snug text-[var(--ink)] sm:text-lg">
        {value}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-1.5">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <span className="text-right text-sm font-medium tabular-nums text-[var(--ink)]">
        {value}
      </span>
    </div>
  )
}
