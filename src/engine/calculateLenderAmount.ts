import type {
  AffordabilityResult,
  BorrowerProfile,
  ConfidenceLevel,
  FairRateResult,
  LenderAmountResult,
  ProductType,
} from '../types'
import { formatInr } from '../utils/currency'
import { mergeConfidence, widenRange } from '../utils/confidence'
import { resolveRepaymentIncome } from './calculateAffordability'
import { calculateSupportedPrincipal } from './calculateEmi'
import {
  DEFAULT_TENURE_MONTHS,
  LENDER_AMOUNT_RULES,
} from './rules'

function lenderFoir(borrowerFoir: number | null): number {
  const base = borrowerFoir ?? 0.35
  return Math.min(0.55, base + LENDER_AMOUNT_RULES.lenderFoirPremium)
}

function incomeBucket(profile: BorrowerProfile, distressed: boolean): keyof typeof LENDER_AMOUNT_RULES.unsecuredIncomeMonths {
  if (distressed) return 'distressed'
  if (profile.hasFormalCreditHistory === false) return 'thin'
  if (
    profile.creditScoreBand === 'unknown' ||
    (profile.creditScoreBand === null && profile.creditScore === null)
  ) {
    return 'thin'
  }
  if (
    profile.creditScoreBand === '800_plus' ||
    profile.creditScoreBand === '750_799' ||
    (profile.creditScore !== null && profile.creditScore >= 750)
  ) {
    return 'excellent'
  }
  if (
    profile.creditScoreBand === '700_749' ||
    (profile.creditScore !== null && profile.creditScore >= 700)
  ) {
    return 'good'
  }
  if (profile.creditScoreBand === 'below_650') return 'distressed'
  return 'fair'
}

/**
 * Estimated lender sanction range — NOT underwriting.
 * Calculated separately from the borrower's safe amount.
 */
export function calculateLenderAmount(
  profile: BorrowerProfile,
  product: ProductType,
  affordability: AffordabilityResult,
  fairRate: FairRateResult,
): LenderAmountResult {
  const { income } = resolveRepaymentIncome(profile)
  const factors: string[] = []
  let confidence: ConfidenceLevel = fairRate.confidence

  if (income === null) {
    return {
      estimatedLenderAmountRange: { low: null, high: null },
      confidence: 'low',
      explanation: {
        label: 'Estimated lender range',
        summary:
          'Estimated lender range is unknown because income is unavailable.',
        text: 'This is an indicative estimate, not a lender approval or guarantee.',
        factors: ['Missing income'],
        missingInputs: ['monthly income'],
      },
      breakdown: {
        title: 'Why this lender range?',
        oneLiner: 'Unknown — income missing.',
        inputsUsed: [],
        steps: ['Income unavailable'],
        ruleUsed: 'Illustrative lender heuristics',
        assumptions: [],
      },
    }
  }

  const existingEmi = profile.existingEmi
  const tenure =
    profile.desiredTenureMonths ?? DEFAULT_TENURE_MONTHS[product]
  const rate = fairRate.expected

  const foir = lenderFoir(affordability.applicableFoir)
  const lenderTotalEmi = income * foir
  const lenderNewEmi =
    existingEmi === null ? null : Math.max(0, lenderTotalEmi - existingEmi)

  let incomeCapacity: number | null = null
  if (lenderNewEmi !== null && rate !== null && tenure !== null) {
    incomeCapacity = calculateSupportedPrincipal(lenderNewEmi, rate, tenure)
  }

  // Fallback crude months-of-income proxy when EMI inverse cannot run
  const bucket = incomeBucket(profile, affordability.isDistressed)
  const months = LENDER_AMOUNT_RULES.unsecuredIncomeMonths[bucket]
  const crude = income * months
  if (incomeCapacity === null) {
    incomeCapacity = crude
    factors.push(
      `Using illustrative ${months}× monthly income proxy (${bucket} profile)`,
    )
    confidence = mergeConfidence([confidence, 'medium'])
  } else {
    factors.push(
      `Lender-side EMI capacity ~${formatInr(lenderNewEmi)} at illustrative FOIR ${(foir * 100).toFixed(0)}%`,
    )
    factors.push(
      `Income-supported illustrative sanction capacity ~${formatInr(incomeCapacity)}`,
    )
  }

  let center = incomeCapacity

  if (
    (product === 'SECURED_BUSINESS' || product === 'HOME') &&
    profile.collateralValue !== null &&
    profile.collateralValue > 0
  ) {
    const collatCap =
      profile.collateralValue * LENDER_AMOUNT_RULES.securedCollateralLtv
    center =
      incomeCapacity * LENDER_AMOUNT_RULES.securedIncomeWeight +
      collatCap * LENDER_AMOUNT_RULES.securedCollateralWeight
    factors.push(
      `Collateral ${formatInr(profile.collateralValue)} at illustrative LTV ${(LENDER_AMOUNT_RULES.securedCollateralLtv * 100).toFixed(0)}% → ${formatInr(collatCap)}`,
    )
    factors.push(
      'Collateral can raise estimated lender range for secured products but never sets your safe borrowing amount alone',
    )
  }

  if (
    profile.creditScoreBand === 'unknown' ||
    profile.hasFormalCreditHistory === false ||
    (profile.creditScoreBand === null && profile.creditScore === null)
  ) {
    confidence = mergeConfidence([confidence, 'low'])
    factors.push(
      'Bureau information unavailable / thin file — estimated lender range widened; not scored as bad credit',
    )
  }

  const width = LENDER_AMOUNT_RULES.rangeWidth[confidence]
  let low = center * (1 - width)
  let high = center * (1 + width)

  const widened = widenRange(low, high, confidence)
  low = widened.low ?? low
  high = widened.high ?? high

  // Floor at zero; keep as range
  low = Math.max(0, low)
  high = Math.max(low, high)

  return {
    estimatedLenderAmountRange: {
      low,
      high,
      midpoint: (low + high) / 2,
    },
    confidence,
    explanation: {
      label: 'Estimated lender range',
      summary: `Estimated lender range ${formatInr(low)} – ${formatInr(high)}.`,
      text: 'This is an indicative estimate, not a lender approval or guarantee. A lender may theoretically offer more than you should safely accept.',
      factors,
    },
    breakdown: {
      title: 'Why this lender range?',
      oneLiner:
        'Estimated lender range is a separate illustrative calculation from your safe borrowing amount — not an approval.',
      inputsUsed: [
        `Income ${formatInr(income)}`,
        `Product ${product}`,
        `Collateral ${formatInr(profile.collateralValue)}`,
      ],
      steps: factors,
      ruleUsed: 'Illustrative lender capacity heuristics in rules.ts',
      assumptions: [
        'Not a sanction decision',
        'Collateral may raise lender estimate for secured products only',
      ],
    },
  }
}
