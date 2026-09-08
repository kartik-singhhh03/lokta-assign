import type { ReactNode } from 'react'
import type { AssessmentResult, BorrowRecommendation } from '../types'
import {
  formatInr,
  formatInrRange,
  formatPercentPoints,
} from '../utils'
import { NegotiationCardView } from './NegotiationCardView'
import { WhyThisNumber } from './WhyThisNumber'

interface ResultContainerProps {
  result: AssessmentResult
  onRestart: () => void
  onEditAnswers: () => void
}

function decisionLabel(code: BorrowRecommendation): string {
  switch (code) {
    case 'BORROW':
      return 'BORROW'
    case 'BORROW_LESS':
      return 'BORROW LESS'
    case 'DONT_BORROW':
      return "DON'T BORROW"
  }
}

function decisionTone(code: BorrowRecommendation): string {
  switch (code) {
    case 'BORROW':
      return 'text-[var(--ok)]'
    case 'BORROW_LESS':
      return 'text-[var(--amber)]'
    case 'DONT_BORROW':
      return 'text-[var(--danger)]'
  }
}

function stressLabel(status: AssessmentResult['stress']['status']): string {
  switch (status) {
    case 'comfortable':
      return 'Comfortable'
    case 'tight':
      return 'Tight'
    case 'stressed':
      return 'Stressed'
    default:
      return 'Unknown'
  }
}

export function ResultContainer({
  result,
  onRestart,
  onEditAnswers,
}: ResultContainerProps) {
  const decision = result.borrowDecision.recommendation

  return (
    <section className="mx-auto flex min-h-[100svh] w-full max-w-lg flex-col px-5 pb-16 pt-6 sm:px-8 print:max-w-none print:px-0">
      <header className="mb-8 flex items-center justify-between print:hidden">
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

      <div className="animate-rise print:hidden">
        <p className="text-xs tracking-[0.12em] text-[var(--muted)] uppercase">
          Self-assessment · not a lender decision
        </p>
        <h1
          className={`mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight sm:text-4xl ${decisionTone(decision)}`}
        >
          {decisionLabel(decision)}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--ink-soft)]">
          {result.oneLiners.decision}
        </p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Confidence:{' '}
          <span className="font-medium text-[var(--ink)] uppercase">
            {result.overallConfidence}
          </span>
          {' — '}
          {result.confidenceReason}
        </p>
      </div>

      <div className="animate-rise-delay-1 mt-8 space-y-8 print:hidden">
        <ResultCard title="1. Should you borrow?">
          <p className={`text-lg font-medium ${decisionTone(decision)}`}>
            {decisionLabel(decision)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
            {result.borrowDecision.explanation.text}
          </p>
          {result.borrowDecision.positiveFactors.length > 0 ? (
            <FactorList
              label="Supportive"
              items={result.borrowDecision.positiveFactors}
            />
          ) : null}
          {result.borrowDecision.riskFactors.length > 0 ? (
            <FactorList label="Watch" items={result.borrowDecision.riskFactors} />
          ) : null}
          {result.borrowDecision.nextSteps.length > 0 ? (
            <FactorList
              label="Constructive next steps"
              items={result.borrowDecision.nextSteps}
            />
          ) : null}
        </ResultCard>

        <ResultCard title="2. How much?">
          <Metric
            label="Estimated lender range"
            value={formatInrRange(
              result.capacity.likelySanction.low,
              result.capacity.likelySanction.high,
            )}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            This is an indicative estimate, not a lender approval or guarantee.
          </p>
          <Metric
            label="Safe borrower range (comfortable)"
            value={formatInrRange(
              result.capacity.safeCarry.low,
              result.capacity.safeCarry.high,
            )}
          />
          <Metric
            label="Recommended amount"
            value={formatInr(result.capacity.recommendedAmount)}
          />
          {result.safeAmount.mathematicalMaximum !== null ? (
            <Metric
              label="Mathematical maximum (longest tenure)"
              value={formatInr(result.safeAmount.mathematicalMaximum)}
            />
          ) : null}
          <p className="mt-4 border-l-2 border-[var(--teal)] pl-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            {result.oneLiners.lenderVsSafe}
          </p>
          <WhyThisNumber breakdown={result.safeAmount.breakdown} />
          <WhyThisNumber breakdown={result.lenderAmount.breakdown} />
          <p className="mt-2 text-xs text-[var(--muted)]">
            Product route: {result.product.product.replaceAll('_', ' ')} —{' '}
            {result.product.explanation.summary}
          </p>
        </ResultCard>

        <ResultCard title="3. Fair rate">
          <Metric
            label={
              result.fairRate.indicativeOnly
                ? 'Indicative fair rate (low confidence band)'
                : 'Indicative fair rate'
            }
            value={`${formatPercentPoints(result.fairRate.low)} – ${formatPercentPoints(result.fairRate.high)}`}
          />
          <Metric
            label="Expected"
            value={formatPercentPoints(result.fairRate.expected)}
          />
          <Metric label="All-in APR" value={formatPercentPoints(result.apr.apr)} />
          <Metric
            label="Illustrative fee assumption"
            value={`${formatPercentPoints(result.apr.processingFeePercent)} (${formatInr(result.apr.processingFeeAmount)})`}
          />
          <Metric
            label="Net amount received"
            value={formatInr(result.apr.netDisbursal)}
          />
          <Metric
            label="Total repayment"
            value={formatInr(result.apr.totalRepayment)}
          />
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {result.oneLiners.rate}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{result.oneLiners.apr}</p>
          <WhyThisNumber breakdown={result.fairRate.breakdown} />
          <WhyThisNumber breakdown={result.apr.breakdown} />
        </ResultCard>

        <ResultCard title="4. EMI">
          <Metric
            label="Recommended EMI ceiling"
            value={`${formatInr(result.emiGuidance.safeNewEmiCeiling)} / month`}
          />
          <Metric
            label="Suggested tenure"
            value={
              result.emiGuidance.suggestedTenureMonths !== null
                ? `${result.emiGuidance.suggestedTenureMonths} months`
                : '—'
            }
          />
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            {result.oneLiners.safeEmi}
          </p>
          <WhyThisNumber breakdown={result.affordability.breakdown} />
          {result.emiGuidance.tenureTradeoffs.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[280px] text-left text-xs">
                <thead>
                  <tr className="text-[var(--muted)]">
                    <th className="py-1 font-medium">Tenure</th>
                    <th className="py-1 font-medium">EMI</th>
                    <th className="py-1 font-medium">Total interest</th>
                  </tr>
                </thead>
                <tbody>
                  {result.emiGuidance.tenureTradeoffs.map((row) => (
                    <tr
                      key={row.tenureMonths}
                      className="border-t border-[var(--line)]"
                    >
                      <td className="py-2 tabular-nums">{row.tenureMonths} mo</td>
                      <td className="py-2 tabular-nums">{formatInr(row.emi)}</td>
                      <td className="py-2 tabular-nums">
                        {formatInr(row.totalInterest)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Shorter tenure → higher EMI, lower total interest. Longer tenure
                → lower EMI, higher total interest.
              </p>
            </div>
          ) : null}
        </ResultCard>

        <ResultCard title="Stress test">
          <p className="text-sm font-medium text-[var(--ink)]">
            {result.stress.scenarioLabel}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Status: {stressLabel(result.stress.status)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
            {result.stress.explanation.text}
          </p>
        </ResultCard>

        <ResultCard title="Why this result?">
          <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-[var(--ink-soft)]">
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ol>
        </ResultCard>

        <ResultCard title="What we don’t know">
          <ul className="space-y-2 text-sm text-[var(--ink-soft)]">
            {result.whatWeDontKnow.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[var(--teal)]" aria-hidden="true">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </ResultCard>
      </div>

      <div className="animate-rise-delay-2 mt-10 print:mt-0">
        <NegotiationCardView card={result.negotiation} />
      </div>

      <p className="mt-8 text-xs leading-relaxed text-[var(--muted)] print:hidden">
        {result.disclaimer}
      </p>

      <div className="mt-8 flex flex-col gap-3 print:hidden">
        <button
          type="button"
          onClick={onEditAnswers}
          className="inline-flex items-center justify-center rounded-md bg-[var(--teal)] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-[var(--teal-deep)]"
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

function ResultCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="border-t border-[var(--line)] pt-6">
      <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2 text-sm last:border-b-0">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium tabular-nums text-[var(--ink)]">
        {value}
      </span>
    </div>
  )
}

function FactorList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="text-xs tracking-[0.1em] text-[var(--muted)] uppercase">
        {label}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-[var(--ink-soft)]">
        {items.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
    </div>
  )
}
