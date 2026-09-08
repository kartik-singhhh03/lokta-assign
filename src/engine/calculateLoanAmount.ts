import type {
  AffordabilityResult,
  BorrowerProfile,
  FairRateResult,
  ProductType,
  SafeAmountResult,
} from '../types'
import { formatInr } from '../utils/currency'
import { mergeConfidence, widenRange } from '../utils/confidence'
import {
  calculateSupportedPrincipal,
} from './calculateEmi'
import {
  AFFORDABILITY_RULES,
  DEFAULT_TENURE_MONTHS,
  SAFE_AMOUNT_RULES,
  TENURE_OPTIONS,
} from './rules'

function pickTenure(
  profile: BorrowerProfile,
  product: ProductType,
): number {
  const desired = profile.desiredTenureMonths
  const options = TENURE_OPTIONS[product]
  if (desired !== null && options.includes(desired)) return desired
  if (desired !== null) {
    // Snap to nearest available option
    return options.reduce((best, n) =>
      Math.abs(n - desired) < Math.abs(best - desired) ? n : best,
    )
  }
  return DEFAULT_TENURE_MONTHS[product]
}

export function calculateLoanAmount(
  profile: BorrowerProfile,
  product: ProductType,
  affordability: AffordabilityResult,
  fairRate: FairRateResult,
): SafeAmountResult & { tenureMonths: number } {
  const tenureMonths = pickTenure(profile, product)
  const rate = fairRate.expected
  const safeEmi = affordability.safeNewEmi

  if (
    safeEmi === null ||
    rate === null ||
    safeEmi <= AFFORDABILITY_RULES.nearZeroEmiThreshold
  ) {
    const nearZero =
      safeEmi !== null && safeEmi <= AFFORDABILITY_RULES.nearZeroEmiThreshold
    return {
      tenureMonths,
      safeAmountRange: {
        low: nearZero ? 0 : null,
        high: nearZero ? 0 : null,
        recommended: nearZero ? 0 : null,
        midpoint: nearZero ? 0 : null,
      },
      recommendedAmount: nearZero ? 0 : null,
      confidence: affordability.confidence,
      explanation: {
        label: 'Safe borrowing amount',
        summary: nearZero
          ? 'Safe borrowing amount is effectively ₹0 given current repayment stress.'
          : 'Safe borrowing amount is unknown until a safe EMI ceiling and rate are available.',
        text: nearZero
          ? 'Your safe new-EMI ceiling is near zero, so the amount you should borrow is zero or near zero — regardless of what a lender might theoretically sanction.'
          : 'We do not invent a safe principal when EMI capacity or rate inputs are missing.',
        factors: [
          `Safe new EMI: ${safeEmi === null ? 'unknown' : formatInr(safeEmi)}`,
          `Indicative rate: ${rate === null ? 'unknown' : `${rate}%`}`,
          `Tenure basis: ${tenureMonths} months`,
        ],
        missingInputs:
          safeEmi === null || rate === null
            ? ['safe EMI and/or rate']
            : undefined,
      },
    }
  }

  const supported = calculateSupportedPrincipal(safeEmi, rate, tenureMonths)
  if (supported === null) {
    return {
      tenureMonths,
      safeAmountRange: { low: null, high: null, recommended: null },
      recommendedAmount: null,
      confidence: 'low',
      explanation: {
        label: 'Safe borrowing amount',
        summary: 'Could not derive a supported principal from the safe EMI.',
        text: 'Inverse EMI calculation returned unknown.',
        factors: [],
      },
    }
  }

  // Also check longer tenure upper bound within product options for range high
  const longest = TENURE_OPTIONS[product][TENURE_OPTIONS[product].length - 1]!
  const shortest = TENURE_OPTIONS[product][0]!
  const atLong = calculateSupportedPrincipal(safeEmi, rate, longest) ?? supported
  const atShort =
    calculateSupportedPrincipal(safeEmi, rate, shortest) ?? supported

  let low = Math.min(supported, atShort) * SAFE_AMOUNT_RULES.lowFactor
  let high = Math.max(supported, atLong) * SAFE_AMOUNT_RULES.highFactor

  const widened = widenRange(low, high, affordability.confidence)
  low = widened.low ?? low
  high = widened.high ?? high
  low = Math.max(0, low)
  high = Math.max(low, high)

  const mid = (low + high) / 2
  let recommended = Math.min(
    high * SAFE_AMOUNT_RULES.recommendedFactorOfHigh,
    mid * SAFE_AMOUNT_RULES.recommendedFactorOfMid,
    supported,
  )

  // Prefer not recommending above the primary tenure-supported amount
  recommended = Math.max(0, Math.min(recommended, supported))

  // If borrower requested less and it's within safe range, recommend requested
  if (
    profile.requestedAmount !== null &&
    profile.requestedAmount > 0 &&
    profile.requestedAmount <= high
  ) {
    recommended = Math.min(recommended, profile.requestedAmount)
    // If requested is comfortably inside, use requested as recommendation
    if (profile.requestedAmount <= supported) {
      recommended = profile.requestedAmount
    }
  }

  const confidence = mergeConfidence([
    affordability.confidence,
    fairRate.confidence,
  ])

  return {
    tenureMonths,
    safeAmountRange: {
      low,
      high,
      midpoint: mid,
      recommended,
    },
    recommendedAmount: recommended,
    confidence,
    explanation: {
      label: 'Safe borrowing amount',
      summary: `Safe borrower range ${formatInr(low)} – ${formatInr(high)}; recommended ${formatInr(recommended)}.`,
      text: `Using your safe new-EMI ceiling of ${formatInr(safeEmi)} at an indicative ${rate}% over about ${tenureMonths} months, the principal you can safely carry is around ${formatInr(supported)}. The published range reflects tenure flexibility and confidence. Collateral never overrides this affordability constraint.`,
      factors: [
        `Safe new EMI ceiling ${formatInr(safeEmi)}`,
        `Indicative rate ${rate}%`,
        `Primary tenure ${tenureMonths} months → supported ~${formatInr(supported)}`,
        `Recommended ${formatInr(recommended)}`,
      ],
    },
  }
}

export { pickTenure }
