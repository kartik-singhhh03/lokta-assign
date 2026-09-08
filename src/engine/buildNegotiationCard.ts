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

  const dontBorrow = decision.recommendation === 'DONT_BORROW'
  const rateIndicativeOnly = fairRate.indicativeOnly || confidence !== 'high'

  const questions = dontBorrow
    ? [
        'Can you help me restructure or close my high-cost loans first?',
        'What documentation would improve my profile for a future application?',
        'Is there a smaller, secured option once my current EMIs are stable?',
      ]
    : [
        ...LENDER_QUESTIONS.common,
        ...(product === 'SECURED_BUSINESS' || product === 'HOME'
          ? LENDER_QUESTIONS.secured
          : []),
        ...(product === 'VEHICLE' ? LENDER_QUESTIONS.vehicle : []),
      ].slice(0, 6)

  const negotiationTarget = dontBorrow
    ? null
    : fairRate.low !== null &&
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

  const whyReasons = dontBorrow
    ? decision.riskFactors.slice(0, 3)
    : reasons.slice(0, 3)

  const talkingPoints = dontBorrow
    ? [
        'Do not take a new loan at this time.',
        'Reassess after high-cost debt is under control and income is more stable.',
        ...decision.nextSteps.slice(0, 2),
      ]
    : [
        negotiationTarget !== null
          ? `Ask to price at or below ${formatPercentPoints(negotiationTarget)}${rateIndicativeOnly ? ' (indicative — low/medium confidence)' : ''}.`
          : 'Ask how the offered rate was derived from your profile.',
        `Keep EMI at or under ${formatInr(affordability.safeNewEmi)} / month.`,
        `Do not accept a principal above your safe range high of ${formatInr(safeAmount.safeAmountRange.high)}.`,
      ]

  const watchouts = [
    'Do not treat an estimated lender range as an approval.',
    'Watch for processing fees, insurance add-ons and floating-rate resets.',
  ]
  if (dontBorrow) {
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
    purpose: profile.loanPurpose,
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
    reasons: whyReasons,
    questionsToAskLender: questions,
    confidence,
    confidenceReason,
    rateIndicativeOnly,
    fairRateBand,
    maxAcceptableEmi: affordability.safeNewEmi,
    maxAcceptablePrincipal: safeAmount.safeAmountRange.high,
    talkingPoints,
    watchouts,
    nextSteps: decision.nextSteps,
    explanation: {
      label: 'Your borrower card',
      summary: dontBorrow
        ? 'DO NOT TAKE A NEW LOAN AT THIS TIME'
        : `Negotiation anchors: rate ≤ ${formatPercentPoints(negotiationTarget)}, EMI ≤ ${formatInr(affordability.safeNewEmi)}.`,
      text: confidenceReason,
      factors: whyReasons,
    },
  }
}
