import type {
  AffordabilityResult,
  BorrowerProfile,
  ConfidenceLevel,
  MaybeNumber,
  NumberBreakdown,
} from '../types'
import { formatInr } from '../utils/currency'
import {
  AFFORDABILITY_RULES,
  INCOME_NORMALIZATION,
} from './rules'

/**
 * Resolve the monthly income figure used for affordability.
 * Prefer documented income (ITR/12) when a cash band is present.
 * Never invent income — return null when unknown.
 * Never use the high end of a cash band for primary affordability.
 */
export function resolveMonthlyIncome(profile: BorrowerProfile): {
  income: MaybeNumber
  source: string | null
  cashBandNote: string | null
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

  const cashBandNote = hasBand
    ? `Stated cash income band ${formatInr(bandLow)} – ${formatInr(bandHigh)} is informational; ${INCOME_NORMALIZATION.note}`
    : null

  if (
    hasBand &&
    documentedMonthly !== null &&
    INCOME_NORMALIZATION.preferDocumentedWhenBandPresent
  ) {
    return {
      income: documentedMonthly,
      source: 'documented annual income (ITR ÷ 12)',
      cashBandNote,
    }
  }

  if (hasBand) {
    return {
      income: bandLow,
      source: 'conservative low end of cash-income band',
      cashBandNote,
    }
  }

  if (
    profile.monthlyIncome !== null &&
    Number.isFinite(profile.monthlyIncome) &&
    profile.monthlyIncome > 0
  ) {
    return {
      income: profile.monthlyIncome,
      source: 'stated monthly income',
      cashBandNote: null,
    }
  }

  if (documentedMonthly !== null) {
    return {
      income: documentedMonthly,
      source: 'documented annual income (ITR ÷ 12)',
      cashBandNote: null,
    }
  }

  return { income: null, source: null, cashBandNote: null }
}

/**
 * Primary borrower income for repayment capacity.
 * Spouse income is included ONLY when spouseIsCoApplicant === true.
 */
export function resolveRepaymentIncome(profile: BorrowerProfile): {
  income: MaybeNumber
  borrowerIncome: MaybeNumber
  spouseIncomeIncluded: boolean
  spouseIncome: MaybeNumber
  source: string | null
  cashBandNote: string | null
} {
  const resolved = resolveMonthlyIncome(profile)
  const spouse =
    profile.spouseMonthlyIncome !== null &&
    Number.isFinite(profile.spouseMonthlyIncome) &&
    profile.spouseMonthlyIncome > 0
      ? profile.spouseMonthlyIncome
      : null

  const includeSpouse = profile.spouseIsCoApplicant === true && spouse !== null

  if (resolved.income === null && !includeSpouse) {
    return {
      income: null,
      borrowerIncome: null,
      spouseIncomeIncluded: false,
      spouseIncome: spouse,
      source: null,
      cashBandNote: resolved.cashBandNote,
    }
  }

  if (includeSpouse && resolved.income !== null) {
    return {
      income: resolved.income + spouse!,
      borrowerIncome: resolved.income,
      spouseIncomeIncluded: true,
      spouseIncome: spouse,
      source: `${resolved.source} + co-applicant spouse income`,
      cashBandNote: resolved.cashBandNote,
    }
  }

  if (includeSpouse && resolved.income === null) {
    return {
      income: spouse,
      borrowerIncome: null,
      spouseIncomeIncluded: true,
      spouseIncome: spouse,
      source: 'co-applicant spouse income only',
      cashBandNote: resolved.cashBandNote,
    }
  }

  return {
    income: resolved.income,
    borrowerIncome: resolved.income,
    spouseIncomeIncluded: false,
    spouseIncome: spouse,
    source: resolved.source,
    cashBandNote: resolved.cashBandNote,
  }
}

/** @deprecated Use resolveRepaymentIncome — kept for call-site compatibility. */
export function resolveHouseholdIncome(profile: BorrowerProfile) {
  return resolveRepaymentIncome(profile)
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

  return {
    foir: AFFORDABILITY_RULES.selfEmployedFoir,
    label: 'default cautious affordability rule (35%) — employment type unknown',
  }
}

/** High-cost debt + bounce (or similar) without inventing an EMI figure. */
export function hasHighCostDebtStress(profile: BorrowerProfile): boolean {
  if (profile.recentBouncedEmi !== true) return false
  const hasHighCostFlag = profile.hasHighCostDebt === true
  const hasOutstanding =
    profile.outstandingUnsecuredDebt !== null &&
    profile.outstandingUnsecuredDebt > 0
  return hasHighCostFlag || hasOutstanding
}

export function detectDistress(
  profile: BorrowerProfile,
  income: MaybeNumber,
  disposableCashFlow: MaybeNumber,
): boolean {
  if (profile.recentBouncedEmi === true) return true

  if (hasHighCostDebtStress(profile)) return true

  if (
    income !== null &&
    profile.existingEmi !== null &&
    income > 0 &&
    profile.existingEmi / income >= AFFORDABILITY_RULES.stressedExistingBurdenRatio
  ) {
    return true
  }

  if (
    disposableCashFlow !== null &&
    disposableCashFlow < AFFORDABILITY_RULES.minimumHouseholdBuffer
  ) {
    return true
  }

  if (
    income !== null &&
    profile.outstandingUnsecuredDebt !== null &&
    profile.outstandingUnsecuredDebt >=
      income * AFFORDABILITY_RULES.highCostDebtToIncomeStress &&
    profile.hasHighCostDebt === true
  ) {
    return true
  }

  return false
}

export function calculateAffordability(
  profile: BorrowerProfile,
): AffordabilityResult {
  const household = resolveRepaymentIncome(profile)
  const income = household.income
  const existingEmiWasUnknown = profile.existingEmi === null
  const existingEmi =
    profile.existingEmi === null
      ? null
      : Number.isFinite(profile.existingEmi)
        ? Math.max(0, profile.existingEmi)
        : null

  let expensesWereAssumed = false
  let expensesUsed: MaybeNumber = null
  if (
    profile.monthlyExpenses !== null &&
    Number.isFinite(profile.monthlyExpenses)
  ) {
    expensesUsed = Math.max(0, profile.monthlyExpenses)
  } else if (income !== null) {
    expensesWereAssumed = true
    expensesUsed = income * AFFORDABILITY_RULES.unknownExpensesShareOfIncome
  }

  // Pre-compute disposable when we have all three known components
  const disposableKnown =
    income !== null && expensesUsed !== null && existingEmi !== null
      ? income - expensesUsed - existingEmi
      : null

  const distressed = detectDistress(profile, income, disposableKnown)
  const { foir, label } = selectFoir(profile, distressed)

  let confidence: ConfidenceLevel = 'high'
  const missing: string[] = []
  const assumptions: string[] = []

  if (income === null) {
    missing.push('monthly income')
    confidence = 'low'
  }
  if (existingEmiWasUnknown) {
    missing.push('exact existing EMI')
    confidence = confidence === 'high' ? 'medium' : confidence
  }
  if (profile.monthlyExpenses === null) {
    missing.push('household expenses')
    confidence = confidence === 'high' ? 'medium' : 'low'
    if (expensesWereAssumed && expensesUsed !== null) {
      assumptions.push(
        `Household expenses unknown — used disclosed assumption of ${(AFFORDABILITY_RULES.unknownExpensesShareOfIncome * 100).toFixed(0)}% of income = ${formatInr(expensesUsed)}`,
      )
    }
  }
  if (profile.employmentType === null && profile.incomeStability === null) {
    missing.push('employment / income stability')
    confidence = confidence === 'high' ? 'medium' : confidence
  }
  if (
    profile.spouseMonthlyIncome !== null &&
    profile.spouseIsCoApplicant !== true
  ) {
    assumptions.push(
      `Spouse income ${formatInr(profile.spouseMonthlyIncome)} noted but NOT counted in repayment capacity (not marked as co-applicant)`,
    )
  }
  if (household.cashBandNote) {
    assumptions.push(household.cashBandNote)
  }

  if (income === null) {
    const breakdown: NumberBreakdown = {
      title: 'Why this safe EMI?',
      oneLiner:
        'Safe EMI cannot be computed because monthly income is unknown.',
      inputsUsed: [],
      steps: ['Income unknown — we do not invent an income figure'],
      ruleUsed: label,
      assumptions,
    }
    return {
      applicableFoir: foir,
      foirLabel: label,
      safeTotalEmi: null,
      safeNewEmi: null,
      disposableCashFlow: null,
      cashFlowConstrainedEmi: null,
      foirBasedNewEmi: null,
      incomeUsed: null,
      incomeSource: null,
      spouseIncomeIncluded: false,
      expensesUsed: null,
      expensesWereAssumed: false,
      existingEmiUsed: existingEmi,
      existingEmiWasUnknown,
      status: 'unknown',
      isDistressed: distressed,
      confidence,
      explanation: {
        label: 'Why this ceiling?',
        summary:
          'Affordability cannot be computed because monthly income is unknown.',
        text: 'We do not invent income. Without a known income figure, the safe EMI ceiling stays unknown.',
        factors: missing.map((m) => `Missing: ${m}`),
        missingInputs: missing,
      },
      breakdown,
    }
  }

  const safeTotalEmi = income * foir

  // High-cost debt stress without inventing EMI → safe new EMI = 0
  if (hasHighCostDebtStress(profile) && existingEmiWasUnknown) {
    assumptions.push(
      'Exact existing EMI unknown — not invented. High-cost outstanding debt plus a recent bounce is treated as exhausted repayment capacity.',
    )
    const oneLiner =
      profile.outstandingUnsecuredDebt !== null
        ? `We recommend no new EMI because you have ${formatInr(profile.outstandingUnsecuredDebt)} of high-cost debt and a recent bounced EMI, so we cannot treat your current debt burden as safely serviceable for a new loan.`
        : 'We recommend no new EMI because of high-cost debt stress and a recent bounced payment.'

    const breakdown: NumberBreakdown = {
      title: 'Why this safe EMI?',
      oneLiner,
      inputsUsed: [
        `Income used ${formatInr(income)} (${household.source})`,
        `Outstanding unsecured debt ${formatInr(profile.outstandingUnsecuredDebt)}`,
        'Recent bounced EMI: yes',
        'Exact existing EMI: unknown (not invented)',
      ],
      steps: [
        'Exact EMI was not provided — we do not invent one',
        'High-cost debt + recent bounce → stressed affordability rule',
        'Safe new EMI set to ₹0',
      ],
      ruleUsed: label,
      assumptions,
    }

    return {
      applicableFoir: foir,
      foirLabel: label,
      safeTotalEmi,
      safeNewEmi: 0,
      disposableCashFlow: disposableKnown,
      cashFlowConstrainedEmi: 0,
      foirBasedNewEmi: 0,
      incomeUsed: income,
      incomeSource: household.source,
      spouseIncomeIncluded: household.spouseIncomeIncluded,
      expensesUsed,
      expensesWereAssumed,
      existingEmiUsed: null,
      existingEmiWasUnknown: true,
      status: 'stressed',
      isDistressed: true,
      confidence: 'low',
      explanation: {
        label: 'Why this ceiling?',
        summary: oneLiner,
        text: oneLiner,
        factors: breakdown.steps,
        missingInputs: missing,
      },
      breakdown,
    }
  }

  // Unknown existing EMI (without high-cost stress): do NOT treat as 0
  const foirBasedNewEmi =
    existingEmi === null
      ? null
      : Math.max(0, safeTotalEmi - existingEmi)

  const cashFlowConstrainedEmi =
    disposableKnown === null
      ? null
      : Math.max(
          0,
          (disposableKnown - AFFORDABILITY_RULES.minimumHouseholdBuffer) *
            AFFORDABILITY_RULES.disposableCashFlowShare,
        )

  let safeNewEmi: MaybeNumber = null
  if (foirBasedNewEmi !== null && cashFlowConstrainedEmi !== null) {
    safeNewEmi = Math.max(0, Math.min(foirBasedNewEmi, cashFlowConstrainedEmi))
  } else if (foirBasedNewEmi !== null && profile.monthlyExpenses === null) {
    // Expenses assumed already if income known — cash flow should exist
    safeNewEmi = foirBasedNewEmi
  } else if (foirBasedNewEmi !== null) {
    safeNewEmi = foirBasedNewEmi
  } else if (cashFlowConstrainedEmi !== null) {
    safeNewEmi = cashFlowConstrainedEmi
  }

  // If existing EMI unknown and not high-cost stress path: withhold precise ceiling
  if (existingEmiWasUnknown && !hasHighCostDebtStress(profile)) {
    safeNewEmi = null
    assumptions.push(
      'Existing EMI unknown — safe new-EMI ceiling left unknown rather than treating EMI as ₹0',
    )
    confidence = 'low'
  }

  let status: AffordabilityResult['status'] = 'healthy'
  if (
    distressed ||
    (safeNewEmi !== null &&
      safeNewEmi <= AFFORDABILITY_RULES.nearZeroEmiThreshold)
  ) {
    status = 'stressed'
  } else if (safeNewEmi !== null && income > 0 && safeNewEmi / income < 0.08) {
    status = 'stretched'
  } else if (safeNewEmi === null) {
    status = 'unknown'
  }

  const steps: string[] = [
    `${formatInr(income)} monthly income (${household.source})`,
    `× ${(foir * 100).toFixed(0)}% ${label}`,
    `= ${formatInr(safeTotalEmi)} total EMI ceiling`,
  ]
  if (existingEmi !== null) {
    steps.push(`− ${formatInr(existingEmi)} existing EMI`)
    steps.push(`= ${formatInr(foirBasedNewEmi)} FOIR new-EMI headroom`)
  } else {
    steps.push('− existing EMI: unknown (not assumed to be ₹0)')
  }
  if (disposableKnown !== null) {
    steps.push(
      `Cash-flow check: income − expenses ${formatInr(expensesUsed)} − existing EMI = ${formatInr(disposableKnown)} disposable`,
    )
    steps.push(
      `Cash-flow new-EMI cap = max(0, (disposable − ${formatInr(AFFORDABILITY_RULES.minimumHouseholdBuffer)} buffer) × ${AFFORDABILITY_RULES.disposableCashFlowShare}) = ${formatInr(cashFlowConstrainedEmi)}`,
    )
  }
  if (safeNewEmi !== null) {
    steps.push(`Binding safe new EMI = ${formatInr(safeNewEmi)}`)
  }

  const oneLiner =
    safeNewEmi !== null && existingEmi !== null
      ? `${formatInr(safeNewEmi)} because our ${(foir * 100).toFixed(0)}% affordability ceiling gives you ${formatInr(safeTotalEmi)} of total EMI capacity, less your existing ${formatInr(existingEmi)} EMI${cashFlowConstrainedEmi !== null && safeNewEmi === cashFlowConstrainedEmi ? ', further capped by household cash flow' : ''}.`
      : safeNewEmi === 0
        ? 'Safe new EMI is ₹0 given current repayment stress.'
        : 'Safe new EMI is unknown until key obligations are known.'

  const breakdown: NumberBreakdown = {
    title: 'Why this safe EMI?',
    oneLiner,
    inputsUsed: [
      `Income ${formatInr(income)}`,
      `Existing EMI ${existingEmi === null ? 'unknown' : formatInr(existingEmi)}`,
      `Expenses ${expensesUsed === null ? 'unknown' : formatInr(expensesUsed)}${expensesWereAssumed ? ' (assumed)' : ''}`,
      household.spouseIncomeIncluded
        ? 'Spouse income included as co-applicant'
        : 'Spouse income not included in capacity',
    ],
    steps,
    ruleUsed: `min(FOIR-based new EMI, cash-flow-based new EMI); ${label}`,
    assumptions,
  }

  return {
    applicableFoir: foir,
    foirLabel: label,
    safeTotalEmi,
    safeNewEmi,
    disposableCashFlow: disposableKnown,
    cashFlowConstrainedEmi,
    foirBasedNewEmi,
    incomeUsed: income,
    incomeSource: household.source,
    spouseIncomeIncluded: household.spouseIncomeIncluded,
    expensesUsed,
    expensesWereAssumed,
    existingEmiUsed: existingEmi,
    existingEmiWasUnknown,
    status,
    isDistressed: distressed,
    confidence,
    explanation: {
      label: 'Why this ceiling?',
      summary: oneLiner,
      text: `${oneLiner} These FOIR figures are Lokta product-judgement assumptions, not RBI-mandated limits.`,
      factors: steps,
      missingInputs: missing.length ? missing : undefined,
    },
    breakdown,
  }
}
