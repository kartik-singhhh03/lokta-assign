import type {
  AffordabilityResult,
  AprResult,
  BorrowDecision,
  BorrowerProfile,
  FairRateResult,
  LenderAmountResult,
  NegotiationCard,
  ProductType,
  RateRange,
  SafeAmountResult,
} from '../types'
import { formatInr, formatPercentPoints } from '../utils/currency'
import { LENDER_QUESTIONS } from './rules'

export function buildNegotiationCard(params: {
  profile: BorrowerProfile
  product: ProductType
  decision: BorrowDecision
  fairRate: FairRateResult
  apr: AprResult
  safeAmount: SafeAmountResult
  lenderAmount: LenderAmountResult
  affordability: AffordabilityResult
  tenureMonths: number
  reasons: string[]
  confidence: NegotiationCard['confidence']
  confidenceReason: string
}): NegotiationCard {
  const {
    profile,
    product,
    decision,
    fairRate,
    apr,
    safeAmount,
    lenderAmount,
    affordability,
    tenureMonths,
    reasons,
    confidence,
    confidenceReason,
  } = params

  const questions = [
    ...LENDER_QUESTIONS.common,
    ...(product === 'SECURED_BUSINESS' || product === 'HOME'
      ? LENDER_QUESTIONS.secured
      : []),
    ...(product === 'VEHICLE' ? LENDER_QUESTIONS.vehicle : []),
  ].slice(0, 6)

  const negotiationTarget =
    fairRate.low !== null &&
    fairRate.high !== null &&
    fairRate.expected !== null
      ? Math.min(
          fairRate.expected,
          fairRate.low + (fairRate.high - fairRate.low) * 0.35,
        )
      : fairRate.expected

  const fairRateBand: RateRange = {
    nominalAnnualPercent: {
      low: fairRate.low,
      high: fairRate.high,
      midpoint: fairRate.expected,
    },
    allInAprPercent: {
      low: apr.apr,
      high: apr.apr,
      midpoint: apr.apr,
    },
    expectedNominalPercent: fairRate.expected,
    confidence: fairRate.confidence,
    explanation: fairRate.explanation,
  }

  const talkingPoints = [
    negotiationTarget !== null
      ? `Ask to price at or below ${formatPercentPoints(negotiationTarget)} if your profile supports it.`
      : 'Ask how the offered rate was derived from your profile.',
    `Keep EMI at or under ${formatInr(affordability.safeNewEmi)} / month.`,
    `Do not accept a principal above your safe range high of ${formatInr(safeAmount.safeAmountRange.high)}.`,
    `Confirm APR (all-in), not just the headline rate — illustrative APR here is ${formatPercentPoints(apr.apr)}.`,
  ]

  const watchouts = [
    'Do not treat an estimated lender range as an approval.',
    'Watch for processing fees, insurance add-ons and floating-rate resets.',
    'A higher sanctioned amount is not automatically a safer amount.',
  ]
  if (decision.recommendation === 'DONT_BORROW') {
    watchouts.unshift(
      'Self-assessment says do not take this loan — walk away if pressured.',
    )
  }
  if (decision.recommendation === 'BORROW_LESS') {
    watchouts.unshift(
      'If offered more than your safe range, negotiate size down — not rate alone.',
    )
  }

  return {
    decision: decision.recommendation,
    product,
    requestedAmount: profile.requestedAmount,
    recommendedAmount: safeAmount.recommendedAmount,
    safeAmountRange: safeAmount.safeAmountRange,
    estimatedLenderAmountRange: lenderAmount.estimatedLenderAmountRange,
    fairRateRange: {
      low: fairRate.low,
      high: fairRate.high,
      midpoint: fairRate.expected,
    },
    expectedRate: fairRate.expected,
    apr: apr.apr,
    processingFeePercent: apr.processingFeePercent,
    processingFeeAmount: apr.processingFeeAmount,
    emiCeiling: affordability.safeNewEmi,
    suggestedTenureMonths: tenureMonths,
    negotiationTargetRate: negotiationTarget,
    reasons: reasons.slice(0, 5),
    questionsToAskLender: questions,
    confidence,
    confidenceReason,
    fairRateBand,
    maxAcceptableEmi: affordability.safeNewEmi,
    maxAcceptablePrincipal: safeAmount.safeAmountRange.high,
    talkingPoints,
    watchouts,
    explanation: {
      label: 'Your borrower card',
      summary: `Negotiation anchors: rate ≤ ${formatPercentPoints(negotiationTarget)}, EMI ≤ ${formatInr(affordability.safeNewEmi)}, principal within ${formatInr(safeAmount.safeAmountRange.low)} – ${formatInr(safeAmount.safeAmountRange.high)}.`,
      text: confidenceReason,
      factors: reasons.slice(0, 5),
    },
  }
}
