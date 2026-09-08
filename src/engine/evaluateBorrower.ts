import type {
  AffordabilityResult,
  BorrowDecision,
  BorrowerProfile,
  LenderAmountResult,
  SafeAmountResult,
} from '../types'
import { formatInr } from '../utils/currency'
import { hasHighCostDebtStress } from './calculateAffordability'
import { AFFORDABILITY_RULES as RULES } from './rules'

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
  const { profile, affordability, safeAmount, lenderAmount } = params
  const positive: string[] = []
  const risks: string[] = []
  const nextSteps: string[] = []
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
  if (
    profile.outstandingUnsecuredDebt !== null &&
    profile.outstandingUnsecuredDebt > 0
  ) {
    risks.push(
      `Outstanding unsecured / app-loan debt ${formatInr(profile.outstandingUnsecuredDebt)}${profile.hasHighCostDebt ? ' at high cost (30%+)' : ''}`,
    )
  }
  if (affordability.status === 'stressed') {
    risks.push('Affordability status is stressed')
  }
  if (
    affordability.disposableCashFlow !== null &&
    affordability.disposableCashFlow < RULES.minimumHouseholdBuffer
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
  if (profile.dependents !== null && profile.dependents >= 2) {
    risks.push(`${profile.dependents} dependents`)
  }
  if (profile.spouseUnemployed === true) {
    risks.push('Spouse currently unemployed')
  }
  if (affordability.existingEmiWasUnknown) {
    risks.push('Exact existing EMI unknown — not invented')
  }

  if (
    profile.employmentType === 'salaried' &&
    profile.incomeStability === 'stable'
  ) {
    positive.push('Stable salaried income')
  }
  if (profile.creditScore !== null && profile.creditScore >= 750) {
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
    safeEmi > RULES.nearZeroEmiThreshold
  ) {
    positive.push(`Meaningful safe new-EMI headroom (${formatInr(safeEmi)})`)
  }

  const lenderHigh = lenderAmount.estimatedLenderAmountRange.high
  if (
    lenderHigh !== null &&
    safeHigh !== null &&
    lenderHigh > safeHigh * 1.25
  ) {
    risks.push(
      'Estimated lender range exceeds safe borrower range — do not treat a larger offer as safer',
    )
  }

  const nearZeroEmi =
    safeEmi !== null && safeEmi <= RULES.nearZeroEmiThreshold
  const nearZeroAmount =
    safeHigh !== null && safeHigh <= RULES.nearZeroEmiThreshold

  const highCostPath =
    hasHighCostDebtStress(profile) ||
    (profile.recentBouncedEmi === true &&
      (profile.incomeStability === 'variable' ||
        profile.employmentType === 'gig' ||
        profile.employmentType === 'informal') &&
      (profile.outstandingUnsecuredDebt !== null ||
        profile.dependents !== null))

  if (
    nearZeroEmi ||
    nearZeroAmount ||
    highCostPath ||
    (affordability.isDistressed &&
      affordability.status === 'stressed' &&
      (safeEmi === null || safeEmi <= RULES.nearZeroEmiThreshold * 4))
  ) {
    nextSteps.push(
      'Build 2–3 months of more stable income before taking new debt.',
    )
    nextSteps.push(
      'Clear or restructure high-cost app / unsecured debt where possible, then reassess.',
    )
    if (profile.loanPurpose === 'scooter' || profile.loanPurpose === 'vehicle') {
      nextSteps.push(
        'An electric scooter could potentially improve earning capacity later — but that future upside does not make a new loan safe today.',
      )
    }

    return {
      recommendation: 'DONT_BORROW',
      confidence: affordability.confidence,
      positiveFactors: positive,
      riskFactors: risks,
      nextSteps,
      explanation: {
        summary: "Don't borrow right now",
        text: buildDontBorrowText(profile, affordability, risks),
        factors: [...risks, ...positive],
      },
    }
  }

  if (
    requested !== null &&
    safeHigh !== null &&
    requested > safeHigh * (1 + RULES.borrowLessTolerance)
  ) {
    risks.push(
      `Requested ${formatInr(requested)} exceeds safe range high ${formatInr(safeHigh)}`,
    )
    if (
      profile.collateralValue !== null &&
      lenderHigh !== null &&
      lenderHigh > safeHigh
    ) {
      nextSteps.push(
        'Consider a smaller secured facility sized to documented income, not to property value alone.',
      )
    }
    return {
      recommendation: 'BORROW_LESS',
      confidence: safeAmount.confidence,
      positiveFactors: positive,
      riskFactors: risks,
      nextSteps,
      explanation: {
        summary: 'Borrow less',
        text: buildBorrowLessText(profile, safeLow, safeHigh, recommended, lenderHigh),
        factors: [...risks, ...positive],
      },
    }
  }

  if (safeHigh === null || safeEmi === null || requested === null) {
    return {
      recommendation: 'BORROW_LESS',
      confidence: 'low',
      positiveFactors: positive,
      riskFactors: [...risks, 'Incomplete inputs for a clear BORROW decision'],
      nextSteps: ['Complete income, EMI and expense details to refine this assessment.'],
      explanation: {
        summary: 'Borrow less',
        text: 'You may be able to borrow, but key inputs are incomplete, so we will not green-light the full request. Unknowns stay unknown; we do not invent capacity.',
        factors: [...risks, ...positive],
        missingInputs: ['complete affordability inputs'],
      },
    }
  }

  positive.push(`Requested ${formatInr(requested)} is within your safe range`)
  return {
    recommendation: 'BORROW',
    confidence: safeAmount.confidence,
    positiveFactors: positive,
    riskFactors: risks,
    nextSteps: [
      'Verify APR, fees and total repayment with the lender before signing.',
      'Do not accept a larger sanctioned amount just because it is offered.',
    ],
    explanation: {
      summary: 'Borrow',
      text: `You appear able to carry the requested borrowing within our affordability rules. Requested ${formatInr(requested)} sits within your comfortable safe borrower range of ${formatInr(safeLow)} – ${formatInr(safeHigh)}. A lender may offer more than you should borrow.`,
      factors: [...positive, ...risks],
    },
  }
}

function buildDontBorrowText(
  profile: BorrowerProfile,
  affordability: AffordabilityResult,
  risks: string[],
): string {
  const parts: string[] = [
    'Your current repayment position does not leave enough safe headroom for a new loan.',
  ]
  if (
    profile.outstandingUnsecuredDebt !== null &&
    profile.recentBouncedEmi === true
  ) {
    parts.push(
      `You have ${formatInr(profile.outstandingUnsecuredDebt)} of high-cost app-loan debt and a recent bounced EMI, so we cannot treat your current debt burden as safely serviceable for a new loan.`,
    )
  }
  if (profile.loanPurpose === 'scooter' || profile.loanPurpose === 'vehicle') {
    parts.push(
      `An electric scooter could potentially improve earning capacity, but the current debt position makes a new ${formatInr(profile.requestedAmount)} loan unsafe today.`,
    )
  }
  if (affordability.existingEmiWasUnknown) {
    parts.push(
      'Exact existing EMI was not provided — we did not invent one.',
    )
  }
  parts.push(`Key issues: ${risks.join('; ')}.`)
  return parts.join(' ')
}

function buildBorrowLessText(
  profile: BorrowerProfile,
  safeLow: number | null,
  safeHigh: number | null,
  recommended: number | null,
  lenderHigh: number | null,
): string {
  const parts = [
    'You may be able to borrow, but the amount you requested is above the amount we consider comfortable.',
    `Your safe borrower range is about ${formatInr(safeLow)} – ${formatInr(safeHigh)}.`,
  ]
  if (
    profile.collateralValue !== null &&
    lenderHigh !== null &&
    safeHigh !== null &&
    lenderHigh > safeHigh
  ) {
    parts.push(
      'Your property may make a larger secured facility possible, but your documented income does not make that larger amount comfortable to repay.',
    )
  }
  parts.push(
    `Consider sizing closer to ${formatInr(recommended)}. A lender may offer more than you should borrow.`,
  )
  return parts.join(' ')
}
