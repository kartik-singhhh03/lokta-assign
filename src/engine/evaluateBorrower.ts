import type {
  AffordabilityResult,
  BorrowDecision,
  BorrowerProfile,
  LenderAmountResult,
  SafeAmountResult,
} from '../types'
import { formatInr } from '../utils/currency'
import { AFFORDABILITY_RULES } from './rules'

/**
 * Final decision: exactly one of BORROW | BORROW_LESS | DONT_BORROW.
 * Lender estimated sanction must NEVER override safe borrower calculation.
 */
export function evaluateBorrower(params: {
  profile: BorrowerProfile
  affordability: AffordabilityResult
  safeAmount: SafeAmountResult
  lenderAmount: LenderAmountResult
}): BorrowDecision {
  const { profile, affordability, safeAmount } = params
  const positive: string[] = []
  const risks: string[] = []
  const requested = profile.requestedAmount
  const safeHigh = safeAmount.safeAmountRange.high
  const safeLow = safeAmount.safeAmountRange.low
  const recommended = safeAmount.recommendedAmount
  const safeEmi = affordability.safeNewEmi

  if (affordability.isDistressed) {
    risks.push('Financial distress signals present')
  }
  if (profile.recentBouncedEmi === true) {
    risks.push('Recent bounced / missed EMI')
  }
  if (affordability.status === 'stressed') {
    risks.push('Affordability status is stressed')
  }
  if (
    affordability.disposableCashFlow !== null &&
    affordability.disposableCashFlow < AFFORDABILITY_RULES.minimumHouseholdBuffer
  ) {
    risks.push('Disposable cash flow below minimum household buffer')
  }
  if (
    profile.incomeStability === 'variable' ||
    profile.employmentType === 'informal' ||
    profile.employmentType === 'gig'
  ) {
    risks.push('Income is variable / informal')
  }

  if (
    profile.employmentType === 'salaried' &&
    profile.incomeStability === 'stable'
  ) {
    positive.push('Stable salaried income')
  }
  if (
    profile.creditScore !== null &&
    profile.creditScore >= 750
  ) {
    positive.push(`Strong credit score (${profile.creditScore})`)
  } else if (
    profile.creditScoreBand === '750_799' ||
    profile.creditScoreBand === '800_plus'
  ) {
    positive.push('Strong credit band')
  }
  if (profile.employmentYears !== null && profile.employmentYears >= 5) {
    positive.push(`${profile.employmentYears}+ years work/business history`)
  }
  if (
    safeEmi !== null &&
    safeEmi > AFFORDABILITY_RULES.nearZeroEmiThreshold
  ) {
    positive.push(`Meaningful safe new-EMI headroom (${formatInr(safeEmi)})`)
  }

  // DONT_BORROW hierarchy
  const nearZeroEmi =
    safeEmi !== null && safeEmi <= AFFORDABILITY_RULES.nearZeroEmiThreshold
  const nearZeroAmount =
    safeHigh !== null && safeHigh <= AFFORDABILITY_RULES.nearZeroEmiThreshold

  const severeBounceCombo =
    profile.recentBouncedEmi === true &&
    (profile.incomeStability === 'variable' ||
      profile.employmentType === 'gig' ||
      profile.employmentType === 'informal') &&
    (affordability.disposableCashFlow === null ||
      affordability.disposableCashFlow <
        AFFORDABILITY_RULES.minimumHouseholdBuffer * 2)

  if (
    nearZeroEmi ||
    nearZeroAmount ||
    severeBounceCombo ||
    (affordability.isDistressed &&
      affordability.status === 'stressed' &&
      (safeEmi === null ||
        safeEmi <= AFFORDABILITY_RULES.nearZeroEmiThreshold * 4))
  ) {
    return {
      recommendation: 'DONT_BORROW',
      confidence: affordability.confidence,
      positiveFactors: positive,
      riskFactors: risks,
      explanation: {
        summary:
          'Don’t borrow right now — repayment capacity is too fragile for new debt.',
        text: buildDontBorrowText(profile, affordability, risks),
        factors: [...risks, ...positive],
      },
    }
  }

  // BORROW_LESS when requested materially exceeds safe high
  if (
    requested !== null &&
    safeHigh !== null &&
    requested > safeHigh * (1 + AFFORDABILITY_RULES.borrowLessTolerance)
  ) {
    risks.push(
      `Requested ${formatInr(requested)} exceeds safe range high ${formatInr(safeHigh)}`,
    )
    return {
      recommendation: 'BORROW_LESS',
      confidence: safeAmount.confidence,
      positiveFactors: positive,
      riskFactors: risks,
      explanation: {
        summary: `Borrow less — you can afford some debt, but ${formatInr(requested)} is above your safe range.`,
        text: `Your safe borrower range is about ${formatInr(safeLow)} – ${formatInr(safeHigh)}. The amount a lender may sanction is calculated separately and must not override what you can safely repay. Consider sizing closer to ${formatInr(recommended)}.`,
        factors: [...risks, ...positive],
      },
    }
  }

  // Insufficient data when we cannot establish safe amount but not clearly distressed
  if (safeHigh === null || safeEmi === null || requested === null) {
    return {
      recommendation: 'BORROW_LESS',
      confidence: 'low',
      positiveFactors: positive,
      riskFactors: [...risks, 'Incomplete inputs for a clear BORROW decision'],
      explanation: {
        summary:
          'Borrow cautiously / less — key inputs are incomplete, so we will not green-light the full request.',
        text: 'Missing income, EMI, or request details prevent a confident BORROW recommendation. Unknowns stay unknown; we do not invent capacity.',
        factors: [...risks, ...positive],
        missingInputs: ['complete affordability inputs'],
      },
    }
  }

  // BORROW — requested within safe range and capacity healthy
  positive.push(`Requested ${formatInr(requested)} is within your safe range`)
  return {
    recommendation: 'BORROW',
    confidence: safeAmount.confidence,
    positiveFactors: positive,
    riskFactors: risks,
    explanation: {
      summary:
        'Borrowing can be reasonable at a safe size — stay within your EMI ceiling and fair rate band.',
      text: `Requested ${formatInr(requested)} sits within your safe borrower range of ${formatInr(safeLow)} – ${formatInr(safeHigh)}. Repayment capacity looks healthy under our affordability rules. Still verify APR, fees and total repayment with the lender.`,
      factors: [...positive, ...risks],
    },
  }
}

function buildDontBorrowText(
  profile: BorrowerProfile,
  affordability: AffordabilityResult,
  risks: string[],
): string {
  const parts = [
    'New borrowing looks unsafe under our self-assessment rules.',
  ]
  if (profile.recentBouncedEmi === true) {
    parts.push('A recent EMI bounce dominates the decision.')
  }
  if (affordability.safeNewEmi !== null) {
    parts.push(
      `Safe new-EMI headroom is only ${formatInr(affordability.safeNewEmi)}.`,
    )
  }
  if (profile.loanPurpose === 'scooter' || profile.loanPurpose === 'vehicle') {
    parts.push(
      'A vehicle that might raise future income is a forward-looking consideration — it does not override today’s affordability risk.',
    )
  }
  parts.push(`Key issues: ${risks.join('; ') || 'severe repayment pressure'}.`)
  return parts.join(' ')
}
