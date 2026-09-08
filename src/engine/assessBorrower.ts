import type {
  AssessmentResult,
  BorrowerProfile,
  EmiGuidance,
  LoanScenario,
  MaybeNumber,
  RateRange,
} from '../types'
import { assessProfileConfidence } from '../utils/confidence'
import { formatInr } from '../utils/currency'
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
import { FEE_RULES, TENURE_OPTIONS } from './rules'

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
    principal: principalForPricing,
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
    .filter((t) => t <= 84 || productResult.product === 'SECURED_BUSINESS' || productResult.product === 'HOME')
    .slice(0, 5)
    .map((tenureMonths) => {
      const emi = calculateEmi(principalForPricing, fairRate.expected, tenureMonths)
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
      affordability.safeTotalEmi !== null &&
      profile.monthlyIncome !== null &&
      profile.monthlyIncome > 0
        ? recommendedEmi / profile.monthlyIncome
        : null,
    confidence: affordability.confidence,
    explanation: {
      label: 'EMI guidance',
      summary: `Keep new EMI at or under ${formatInr(affordability.safeNewEmi)}; suggested tenure ${safeAmount.tenureMonths} months.`,
      text: `Shorter tenures raise EMI and lower total interest; longer tenures lower EMI and raise total interest. Stay inside your safe EMI ceiling.`,
      factors: [
        `Safe new EMI ceiling ${formatInr(affordability.safeNewEmi)}`,
        `EMI at recommended size ${formatInr(recommendedEmi)}`,
        `Suggested tenure ${safeAmount.tenureMonths} months`,
      ],
    },
    tenureTradeoffs,
  }

  const gap =
    lenderAmount.estimatedLenderAmountRange.midpoint !== null &&
    lenderAmount.estimatedLenderAmountRange.midpoint !== undefined &&
    safeAmount.safeAmountRange.midpoint !== null &&
    safeAmount.safeAmountRange.midpoint !== undefined
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

  const reasons = [
    decision.explanation.summary,
    ...decision.positiveFactors.slice(0, 2),
    ...decision.riskFactors.slice(0, 2),
    productResult.explanation.summary,
    fairRate.reasons[0] ?? 'Indicative rate band applied from product rules',
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
        summary:
          'Estimated lender range and safe borrower range are calculated separately.',
        text: 'The amount a lender may sanction is not necessarily the amount you should borrow.',
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
    reasons: reasons.slice(0, 5),
    assessedAt: new Date().toISOString(),
  }
}

export function isEngineReady(): boolean {
  return true
}
