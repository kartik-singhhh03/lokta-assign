import type {
  AffordabilityResult,
  BorrowerProfile,
  ConfidenceLevel,
  MaybeNumber,
} from '../types'
import { formatInr, formatPercentPoints } from '../utils/currency'
import { AFFORDABILITY_RULES } from './rules'

/**
 * Resolve the monthly income figure used for affordability.
 * Prefer documented income (ITR/12) when cash income is a wide band.
 * Never invent income — return null when unknown.
 */
export function resolveMonthlyIncome(profile: BorrowerProfile): {
  income: MaybeNumber
  source: string | null
} {
  const documentedMonthly =
    profile.documentedAnnualIncome !== null &&
    Number.isFinite(profile.documentedAnnualIncome) &&
    profile.documentedAnnualIncome > 0
      ? profile.documentedAnnualIncome / 12
      : null

  const bandLow = profile.monthlyIncomeLow
  const bandHigh = profile.monthlyIncomeHigh
  const hasBand =
    bandLow !== null &&
    bandHigh !== null &&
    Number.isFinite(bandLow) &&
    Number.isFinite(bandHigh) &&
    bandHigh >= bandLow

  // Variable cash band: prefer documented when present; else use conservative low.
  if (hasBand && documentedMonthly !== null) {
    return {
      income: documentedMonthly,
      source: 'documented annual income (ITR ÷ 12)',
    }
  }
  if (hasBand) {
    return {
      income: bandLow,
      source: 'conservative low end of cash-income band',
    }
  }

  if (
    profile.monthlyIncome !== null &&
    Number.isFinite(profile.monthlyIncome) &&
    profile.monthlyIncome > 0
  ) {
    return { income: profile.monthlyIncome, source: 'stated monthly income' }
  }

  if (documentedMonthly !== null) {
    return {
      income: documentedMonthly,
      source: 'documented annual income (ITR ÷ 12)',
    }
  }

  return { income: null, source: null }
}

/** Household income including known spouse contribution. */
export function resolveHouseholdIncome(profile: BorrowerProfile): {
  income: MaybeNumber
  borrowerIncome: MaybeNumber
  spouseIncome: MaybeNumber
  source: string | null
} {
  const { income: borrowerIncome, source } = resolveMonthlyIncome(profile)
  const spouse =
    profile.spouseMonthlyIncome !== null &&
    Number.isFinite(profile.spouseMonthlyIncome) &&
    profile.spouseMonthlyIncome > 0
      ? profile.spouseMonthlyIncome
      : null

  if (borrowerIncome === null && spouse === null) {
    return {
      income: null,
      borrowerIncome: null,
      spouseIncome: null,
      source: null,
    }
  }

  const total = (borrowerIncome ?? 0) + (spouse ?? 0)
  // Only treat as known if at least one component is known; zeros here are
  // additive placeholders for a missing component, not invented income.
  return {
    income: total,
    borrowerIncome,
    spouseIncome: spouse,
    source:
      spouse !== null && borrowerIncome !== null
        ? `${source ?? 'borrower income'} + spouse income`
        : spouse !== null
          ? 'spouse income only'
          : source,
  }
}

function selectFoir(profile: BorrowerProfile, distressed: boolean): {
  foir: number
  label: string
} {
  if (distressed) {
    return {
      foir: AFFORDABILITY_RULES.financiallyStressedFoir,
      label: 'financially stressed affordability rule (25%)',
    }
  }

  if (
    profile.incomeStability === 'variable' ||
    profile.employmentType === 'gig' ||
    profile.employmentType === 'informal'
  ) {
    return {
      foir: AFFORDABILITY_RULES.variableInformalFoir,
      label: 'variable / informal affordability rule (30%)',
    }
  }

  if (
    profile.employmentType === 'self_employed' ||
    profile.employmentType === 'business'
  ) {
    return {
      foir: AFFORDABILITY_RULES.selfEmployedFoir,
      label: 'self-employed affordability rule (35%)',
    }
  }

  if (
    profile.employmentType === 'salaried' ||
    profile.incomeStability === 'stable'
  ) {
    return {
      foir: AFFORDABILITY_RULES.stableSalariedFoir,
      label: 'stable salaried affordability rule (40%)',
    }
  }

  // Unknown employment: use moderate self-employed FOIR, not the most generous.
  return {
    foir: AFFORDABILITY_RULES.selfEmployedFoir,
    label: 'default cautious affordability rule (35%) — employment type unknown',
  }
}

export function detectDistress(profile: BorrowerProfile, income: MaybeNumber): boolean {
  if (profile.recentBouncedEmi === true) return true

  if (
    income !== null &&
    profile.existingEmi !== null &&
    income > 0 &&
    profile.existingEmi / income >= AFFORDABILITY_RULES.stressedExistingBurdenRatio
  ) {
    return true
  }

  if (
    income !== null &&
    profile.monthlyExpenses !== null &&
    profile.existingEmi !== null
  ) {
    const disposable = income - profile.monthlyExpenses - profile.existingEmi
    if (disposable < AFFORDABILITY_RULES.minimumHouseholdBuffer) return true
  }

  return false
}

export function calculateAffordability(
  profile: BorrowerProfile,
): AffordabilityResult {
  const household = resolveHouseholdIncome(profile)
  const income = household.income
  const existingEmi =
    profile.existingEmi === null
      ? null
      : Number.isFinite(profile.existingEmi)
        ? Math.max(0, profile.existingEmi)
        : null
  const expenses =
    profile.monthlyExpenses === null
      ? null
      : Number.isFinite(profile.monthlyExpenses)
        ? Math.max(0, profile.monthlyExpenses)
        : null

  const distressed = detectDistress(profile, income)
  const { foir, label } = selectFoir(profile, distressed)

  let confidence: ConfidenceLevel = 'high'
  const missing: string[] = []
  if (income === null) {
    missing.push('monthly income')
    confidence = 'low'
  }
  if (existingEmi === null) {
    missing.push('existing EMI')
    confidence = confidence === 'high' ? 'medium' : confidence
  }
  if (expenses === null) {
    missing.push('household expenses')
    confidence = confidence === 'high' ? 'medium' : 'low'
  }
  if (profile.employmentType === null && profile.incomeStability === null) {
    missing.push('employment / income stability')
    confidence = confidence === 'high' ? 'medium' : confidence
  }

  if (income === null) {
    return {
      applicableFoir: foir,
      foirLabel: label,
      safeTotalEmi: null,
      safeNewEmi: null,
      disposableCashFlow: null,
      cashFlowConstrainedEmi: null,
      status: 'unknown',
      isDistressed: distressed,
      confidence,
      explanation: {
        label: 'Why this ceiling?',
        summary:
          'Affordability cannot be computed because monthly income is unknown.',
        text: 'We do not invent income. Without a known income figure, the safe EMI ceiling stays unknown and confidence is low.',
        factors: missing.map((m) => `Missing: ${m}`),
        missingInputs: missing,
      },
    }
  }

  const safeTotalEmi = income * foir
  // Treat unknown existing EMI as unknown for FOIR headroom — do NOT assume 0
  // when the field was never answered. If the borrower skipped and we have
  // explicit 0 from demos/answers, existingEmi is 0.
  // When existingEmi is null, safeNewEmi from FOIR alone is unknown; cash-flow
  // path similarly needs expenses.
  const foirNewEmi =
    existingEmi === null ? null : Math.max(0, safeTotalEmi - existingEmi)

  const disposableCashFlow =
    expenses === null || existingEmi === null
      ? null
      : income - expenses - existingEmi

  const cashFlowConstrainedEmi =
    disposableCashFlow === null
      ? null
      : Math.max(
          0,
          (disposableCashFlow - AFFORDABILITY_RULES.minimumHouseholdBuffer) *
            AFFORDABILITY_RULES.disposableCashFlowShare,
        )

  let safeNewEmi: MaybeNumber = null
  if (foirNewEmi !== null && cashFlowConstrainedEmi !== null) {
    safeNewEmi = Math.max(0, Math.min(foirNewEmi, cashFlowConstrainedEmi))
  } else if (foirNewEmi !== null) {
    // Expenses unknown — FOIR only, but confidence already reduced
    safeNewEmi = foirNewEmi
  } else if (cashFlowConstrainedEmi !== null) {
    safeNewEmi = cashFlowConstrainedEmi
  }

  let status: AffordabilityResult['status'] = 'healthy'
  if (distressed || (safeNewEmi !== null && safeNewEmi <= AFFORDABILITY_RULES.nearZeroEmiThreshold)) {
    status = 'stressed'
  } else if (
    safeNewEmi !== null &&
    income > 0 &&
    safeNewEmi / income < 0.08
  ) {
    status = 'stretched'
  } else if (safeNewEmi === null) {
    status = 'unknown'
  }

  const factors: string[] = [
    `Income basis: ${formatInr(income)} / month (${household.source ?? 'known'})`,
    `Our ${label} → total EMI ceiling ${formatInr(safeTotalEmi)}`,
  ]
  if (existingEmi !== null) {
    factors.push(`Existing EMI ${formatInr(existingEmi)}`)
  }
  if (foirNewEmi !== null) {
    factors.push(`FOIR new-EMI headroom ${formatInr(foirNewEmi)}`)
  }
  if (disposableCashFlow !== null) {
    factors.push(
      `Disposable cash flow ${formatInr(disposableCashFlow)} after expenses & existing EMI`,
    )
  }
  if (cashFlowConstrainedEmi !== null) {
    factors.push(
      `Cash-flow guardrail (≤ ${formatPercentPoints(AFFORDABILITY_RULES.disposableCashFlowShare * 100)} of residual after ${formatInr(AFFORDABILITY_RULES.minimumHouseholdBuffer)} buffer) → ${formatInr(cashFlowConstrainedEmi)}`,
    )
  }
  if (distressed) {
    factors.push('Distress signals detected — stressed FOIR applied')
  }

  const textParts = [
    `Your ${formatInr(income)} monthly income supports a ${formatInr(safeTotalEmi)} total EMI ceiling under our ${label}.`,
  ]
  if (existingEmi !== null && foirNewEmi !== null) {
    textParts.push(
      `After your existing ${formatInr(existingEmi)} EMI, FOIR headroom is ${formatInr(foirNewEmi)}.`,
    )
  }
  if (cashFlowConstrainedEmi !== null) {
    textParts.push(
      `Household cash flow further caps a safe new EMI at ${formatInr(cashFlowConstrainedEmi)}.`,
    )
  }
  if (safeNewEmi !== null) {
    textParts.push(`The binding safe new-EMI ceiling is ${formatInr(safeNewEmi)}.`)
  }
  textParts.push(
    'These FOIR figures are Lokta product-judgement assumptions, not RBI-mandated limits.',
  )

  return {
    applicableFoir: foir,
    foirLabel: label,
    safeTotalEmi,
    safeNewEmi,
    disposableCashFlow,
    cashFlowConstrainedEmi,
    status,
    isDistressed: distressed,
    confidence,
    explanation: {
      label: 'Why this ceiling?',
      summary:
        safeNewEmi !== null
          ? `Safe new EMI ceiling is ${formatInr(safeNewEmi)} under our affordability rules.`
          : 'Safe new EMI ceiling is unknown due to missing inputs.',
      text: textParts.join(' '),
      factors,
      missingInputs: missing.length ? missing : undefined,
    },
  }
}
