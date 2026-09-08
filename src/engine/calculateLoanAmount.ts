import type {
  AffordabilityResult,
  BorrowerProfile,
  FairRateResult,
  ProductType,
  SafeAmountResult,
} from '../types'
import { formatInr } from '../utils/currency'
import { mergeConfidence } from '../utils/confidence'
import { calculateSupportedPrincipal } from './calculateEmi'
import {
  AFFORDABILITY_RULES,
  DEFAULT_TENURE_MONTHS,
  SAFE_AMOUNT_RULES,
  TENURE_OPTIONS,
} from './rules'

function pickTenure(profile: BorrowerProfile, product: ProductType): number {
  const desired = profile.desiredTenureMonths
  const options = TENURE_OPTIONS[product]
  if (desired !== null && options.includes(desired)) return desired
  if (desired !== null) {
    return options.reduce((best, n) =>
      Math.abs(n - desired) < Math.abs(best - desired) ? n : best,
    )
  }
  return DEFAULT_TENURE_MONTHS[product]
}

function tenureNeighbors(
  product: ProductType,
  selected: number,
  steps: number,
): { shorter: number; longer: number } {
  const options = [...TENURE_OPTIONS[product]]
  const idx = Math.max(0, options.indexOf(selected))
  const shorter = options[Math.max(0, idx - steps)] ?? selected
  const longer =
    options[Math.min(options.length - 1, idx + steps)] ?? selected
  return { shorter, longer }
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
      mathematicalMaximum: nearZero ? 0 : null,
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
        ],
      },
      breakdown: {
        title: 'Why this safe amount?',
        oneLiner: nearZero
          ? 'Safe amount is ₹0 because safe EMI headroom is exhausted.'
          : 'Safe amount unknown — missing EMI ceiling or rate.',
        inputsUsed: [],
        steps: [],
        ruleUsed: 'Inverse EMI from safe new-EMI ceiling',
        assumptions: [],
      },
    }
  }

  const supported = calculateSupportedPrincipal(safeEmi, rate, tenureMonths)
  if (supported === null) {
    return {
      tenureMonths,
      safeAmountRange: { low: null, high: null, recommended: null },
      mathematicalMaximum: null,
      recommendedAmount: null,
      confidence: 'low',
      explanation: {
        label: 'Safe borrowing amount',
        summary: 'Could not derive a supported principal from the safe EMI.',
        text: 'Inverse EMI calculation returned unknown.',
        factors: [],
      },
      breakdown: {
        title: 'Why this safe amount?',
        oneLiner: 'Could not invert EMI to principal.',
        inputsUsed: [],
        steps: [],
        ruleUsed: 'Inverse EMI',
        assumptions: [],
      },
    }
  }

  const { shorter, longer } = tenureNeighbors(
    product,
    tenureMonths,
    SAFE_AMOUNT_RULES.tenureWindowSteps,
  )

  const rateLow = fairRate.low ?? rate
  const rateHigh = fairRate.high ?? rate
  const rateSpread =
    ((rateHigh - rateLow) / 2) * SAFE_AMOUNT_RULES.rateSpreadShare
  const rateForLowPrincipal = rate + rateSpread // higher rate → lower principal
  const rateForHighPrincipal = Math.max(rate - rateSpread, rateLow)

  const atShorterHigherRate =
    calculateSupportedPrincipal(safeEmi, rateForLowPrincipal, shorter) ??
    supported
  const atLongerLowerRate =
    calculateSupportedPrincipal(safeEmi, rateForHighPrincipal, longer) ??
    supported
  const atSelected = supported

  let comfortableLow =
    Math.min(atShorterHigherRate, atSelected) *
    SAFE_AMOUNT_RULES.comfortableLowFactor
  let comfortableHigh =
    Math.max(atLongerLowerRate, atSelected) *
    SAFE_AMOUNT_RULES.comfortableHighFactor

  comfortableLow = Math.max(0, comfortableLow)
  comfortableHigh = Math.max(comfortableLow, comfortableHigh)

  const longest = TENURE_OPTIONS[product][TENURE_OPTIONS[product].length - 1]!
  const mathematicalMaximum =
    calculateSupportedPrincipal(safeEmi, rateLow, longest) ?? supported

  const mid = (comfortableLow + comfortableHigh) / 2
  let recommended = Math.min(
    comfortableHigh * SAFE_AMOUNT_RULES.recommendedFactorOfHigh,
    mid * SAFE_AMOUNT_RULES.recommendedFactorOfMid,
    atSelected,
  )
  recommended = Math.max(0, Math.min(recommended, atSelected))

  if (
    profile.requestedAmount !== null &&
    profile.requestedAmount > 0 &&
    profile.requestedAmount <= comfortableHigh
  ) {
    if (profile.requestedAmount <= atSelected) {
      recommended = profile.requestedAmount
    } else {
      recommended = Math.min(recommended, profile.requestedAmount)
    }
  }

  const confidence = mergeConfidence([
    affordability.confidence,
    fairRate.confidence,
  ])

  const oneLiner =
    profile.requestedAmount !== null &&
    recommended === profile.requestedAmount
      ? `${formatInr(recommended)} because this loan amount keeps the proposed EMI within your safe monthly ceiling of ${formatInr(safeEmi)}.`
      : `Comfortable safe range ${formatInr(comfortableLow)} – ${formatInr(comfortableHigh)} from your ${formatInr(safeEmi)} EMI ceiling at ~${rate.toFixed(1)}% over about ${tenureMonths} months.`

  return {
    tenureMonths,
    safeAmountRange: {
      low: comfortableLow,
      high: comfortableHigh,
      midpoint: mid,
      recommended,
    },
    mathematicalMaximum,
    recommendedAmount: recommended,
    confidence,
    explanation: {
      label: 'Safe borrowing amount',
      summary: `Safe (comfortable) range ${formatInr(comfortableLow)} – ${formatInr(comfortableHigh)}; recommended ${formatInr(recommended)}. Mathematical maximum at longest tenure: ${formatInr(mathematicalMaximum)}.`,
      text: `${oneLiner} The comfortable range uses a narrow tenure window around ${tenureMonths} months and rate uncertainty — not the full product maximum. Collateral never increases this amount.`,
      factors: [
        `Safe new EMI ceiling ${formatInr(safeEmi)}`,
        `Indicative rate ${rate.toFixed(2)}%`,
        `Selected tenure ${tenureMonths} months → ~${formatInr(atSelected)}`,
        `Comfortable window tenures ${shorter}–${longer} months`,
        `Mathematical max (${longest} mo @ ${rateLow.toFixed(1)}%): ${formatInr(mathematicalMaximum)}`,
      ],
    },
    breakdown: {
      title: 'Why this safe amount?',
      oneLiner,
      inputsUsed: [
        `Safe EMI ${formatInr(safeEmi)}`,
        `Expected rate ${rate.toFixed(2)}%`,
        `Tenure ${tenureMonths} months`,
      ],
      steps: [
        `Primary supported principal at ${tenureMonths} months ≈ ${formatInr(atSelected)}`,
        `Comfortable low (shorter tenure / higher rate pad) ≈ ${formatInr(comfortableLow)}`,
        `Comfortable high (nearby longer tenure / lower rate pad) ≈ ${formatInr(comfortableHigh)}`,
        `Mathematical maximum (longest product tenure) ≈ ${formatInr(mathematicalMaximum)} — shown separately, not as the safe range`,
        `Recommended ${formatInr(recommended)}`,
      ],
      ruleUsed:
        'Comfortable range from inverse EMI over a narrow tenure/rate window; mathematical max is separate',
      assumptions: [
        'Safe amount is repayment-capacity driven — collateral does not increase it',
      ],
    },
  }
}

export { pickTenure }
