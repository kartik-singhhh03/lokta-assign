import type {
  AssessmentResult,
  BorrowerProfile,
  EmiGuidance,
  LoanScenario,
  MaybeNumber,
  RateRange,
} from '../types'
import { assessProfileConfidence } from '../utils/confidence'
import { formatInrRange } from '../utils/currency'
import { calculateAffordability } from './calculateAffordability'
import { calculateApr } from './calculateApr'
import {
  calculateEmi,
  calculateTotalInterest,
  calculateTotalRepayment,
} from './calculateEmi'
import { calculateLenderAmount } from './calculateLenderAmount'
import { calculateLoanAmount } from './calculateLoanAmount'
import { calculateRate } from './calculateRate'
import { calculateStress } from './calculateStress'
import { determineProduct } from './determineProduct'
import { evaluateBorrower } from './evaluateBorrower'
import { buildNegotiationCard } from './buildNegotiationCard'
import { DISCLAIMER, FEE_RULES, TENURE_OPTIONS } from './rules'

function buildWhatWeDontKnow(profile: BorrowerProfile): string[] {
  const items: string[] = [
    'Exact lender offer / underwriting decision',
    'Actual processing fee the lender will charge',
    'Exact product-specific underwriting criteria',
  ]
  if (
    profile.creditScore === null &&
    (profile.creditScoreBand === null ||
      profile.creditScoreBand === 'unknown')
  ) {
    items.push('Bureau / credit score history')
  }
  if (profile.hasFormalCreditHistory === false) {
    items.push('Formal credit history (thin file)')
  }
  if (profile.existingEmi === null) {
    items.push('Exact existing EMI amounts')
  }
  if (profile.monthlyExpenses === null) {
    items.push('Exact household expenses')
  }
  if (
    profile.outstandingUnsecuredDebt !== null &&
    profile.existingEmi === null
  ) {
    items.push('Exact debt repayment schedule for outstanding loans')
  }
  if (profile.documentedAnnualIncome !== null && profile.monthlyIncomeLow !== null) {
    items.push('Exact business profit vs stated cash income')
  }
  if (profile.collateralValue !== null) {
    items.push('Lender valuation of collateral / LTV they will apply')
  }
  if (
    profile.spouseMonthlyIncome !== null &&
    profile.spouseIsCoApplicant !== true
  ) {
    items.push('Whether spouse will be a co-applicant')
  }
  return items
}

/**
 * Single public orchestration entry point for the deterministic engine.
 * UI must only consume AssessmentResult — no calculations in components.
 */
export function assessBorrower(profile: BorrowerProfile): AssessmentResult {
  const profileConfidence = assessProfileConfidence(profile)
  const productResult = determineProduct(profile)
  const affordability = calculateAffordability(profile)
  const fairRate = calculateRate(profile, productResult.product, affordability)
  const lenderAmount = calculateLenderAmount(
    profile,
    productResult.product,
    affordability,
    fairRate,
  )
  const safeAmount = calculateLoanAmount(
    profile,
    productResult.product,
    affordability,
    fairRate,
  )

  const principalForPricing: MaybeNumber =
    safeAmount.recommendedAmount ??
    profile.requestedAmount ??
    safeAmount.safeAmountRange.midpoint ??
    null

  const apr = calculateApr({
    principal:
      principalForPricing !== null && principalForPricing > 0
        ? principalForPricing
        : null,
    annualRatePercent: fairRate.expected,
    tenureMonths: safeAmount.tenureMonths,
    processingFeePercent:
      profile.quotedProcessingFeePercent ??
      FEE_RULES.illustrativeProcessingFeePercent,
  })

  const decision = evaluateBorrower({
    profile,
    affordability,
    safeAmount,
    lenderAmount,
  })

  const stress = calculateStress({
    profile,
    product: productResult.product,
    affordability,
    fairRate,
    proposedPrincipal: principalForPricing,
    tenureMonths: safeAmount.tenureMonths,
  })

  const rateGuidance: RateRange = {
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

  const recommendedEmi = calculateEmi(
    principalForPricing,
    fairRate.expected,
    safeAmount.tenureMonths,
  )

  const tenureTradeoffs = TENURE_OPTIONS[productResult.product]
    .filter(
      (t) =>
        t <= 84 ||
        productResult.product === 'SECURED_BUSINESS' ||
        productResult.product === 'HOME',
    )
    .slice(0, 5)
    .map((tenureMonths) => {
      const emi = calculateEmi(
        principalForPricing,
        fairRate.expected,
        tenureMonths,
      )
      return {
        tenureMonths,
        emi,
        totalInterest: calculateTotalInterest(
          principalForPricing,
          emi,
          tenureMonths,
        ),
      }
    })

  const emiGuidance: EmiGuidance = {
    recommendedEmi: {
      low: affordability.safeNewEmi,
      high: affordability.safeNewEmi,
      recommended: recommendedEmi,
      midpoint: recommendedEmi,
    },
    safeNewEmiCeiling: affordability.safeNewEmi,
    suggestedTenureMonths: safeAmount.tenureMonths,
    emiToIncomeRatio:
      recommendedEmi !== null &&
      affordability.incomeUsed !== null &&
      affordability.incomeUsed > 0
        ? recommendedEmi / affordability.incomeUsed
        : null,
    confidence: affordability.confidence,
    explanation: {
      label: 'EMI guidance',
      summary: affordability.breakdown.oneLiner,
      text: `Shorter tenures raise EMI and lower total interest; longer tenures lower EMI and raise total interest. Stay inside your safe EMI ceiling.`,
      factors: affordability.breakdown.steps,
    },
    tenureTradeoffs,
  }

  const gap =
    lenderAmount.estimatedLenderAmountRange.midpoint != null &&
    safeAmount.safeAmountRange.midpoint != null
      ? lenderAmount.estimatedLenderAmountRange.midpoint -
        safeAmount.safeAmountRange.midpoint
      : null

  const scenarios: LoanScenario[] = [
    {
      id: 'recommended',
      label: 'Recommended safe size',
      principal: principalForPricing,
      tenureMonths: safeAmount.tenureMonths,
      emi: recommendedEmi,
      rate: rateGuidance,
      totalInterest: calculateTotalInterest(
        principalForPricing,
        recommendedEmi,
        safeAmount.tenureMonths,
      ),
      totalPayable: calculateTotalRepayment(
        recommendedEmi,
        safeAmount.tenureMonths,
      ),
      explanation: {
        summary: 'Primary scenario at recommended principal and indicative rate.',
        factors: fairRate.reasons.slice(0, 3),
      },
    },
  ]

  const lenderVsSafe =
    profile.collateralValue !== null &&
    lenderAmount.estimatedLenderAmountRange.high != null &&
    safeAmount.safeAmountRange.high != null &&
    lenderAmount.estimatedLenderAmountRange.high >
      safeAmount.safeAmountRange.high
      ? 'Your property may make a larger secured facility possible, but your documented income does not make that larger amount comfortable to repay.'
      : 'The amount a lender may sanction is not necessarily the amount you should borrow.'

  const reasons = [
    decision.explanation.summary,
    ...decision.positiveFactors.slice(0, 2),
    ...decision.riskFactors.slice(0, 2),
    productResult.explanation.summary,
  ].filter(Boolean)

  const negotiation = buildNegotiationCard({
    profile,
    product: productResult.product,
    decision,
    fairRate,
    apr,
    safeAmount,
    lenderAmount,
    affordability,
    tenureMonths: safeAmount.tenureMonths,
    reasons,
    confidence: profileConfidence.level,
    confidenceReason: profileConfidence.reason,
  })

  const whatWeDontKnow = buildWhatWeDontKnow(profile)

  return {
    profile,
    product: productResult,
    affordability,
    fairRate,
    apr,
    lenderAmount,
    safeAmount,
    stress,
    borrowDecision: decision,
    capacity: {
      likelySanction: lenderAmount.estimatedLenderAmountRange,
      safeCarry: safeAmount.safeAmountRange,
      recommendedAmount: safeAmount.recommendedAmount,
      gap,
      confidence: safeAmount.confidence,
      explanation: {
        summary: lenderVsSafe,
        text: `${lenderVsSafe} Estimated lender range ${formatInrRange(lenderAmount.estimatedLenderAmountRange.low, lenderAmount.estimatedLenderAmountRange.high)} vs safe borrower range ${formatInrRange(safeAmount.safeAmountRange.low, safeAmount.safeAmountRange.high)}. This is an indicative estimate, not a lender approval or guarantee.`,
        factors: [
          lenderAmount.explanation.summary,
          safeAmount.explanation.summary,
        ],
      },
    },
    rateGuidance,
    emiGuidance,
    scenarios,
    negotiation,
    overallConfidence: profileConfidence.level,
    confidenceReason: profileConfidence.reason,
    unknownFields: profileConfidence.unknownFields,
    missingInputsForPrecision: profileConfidence.missingInputsForPrecision,
    whatWeDontKnow,
    reasons: reasons.slice(0, 5),
    oneLiners: {
      decision: decision.explanation.summary,
      safeEmi: affordability.breakdown.oneLiner,
      safeAmount: safeAmount.breakdown.oneLiner,
      rate: fairRate.breakdown.oneLiner,
      apr: apr.breakdown.oneLiner,
      lenderVsSafe,
    },
    disclaimer: DISCLAIMER,
    assessedAt: new Date().toISOString(),
  }
}

export function isEngineReady(): boolean {
  return true
}
