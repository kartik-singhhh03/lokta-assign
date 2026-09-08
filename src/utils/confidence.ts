import type {
  BorrowerProfile,
  ConfidenceLevel,
  MaybeNumber,
} from '../types'

/**
 * Confidence helpers. Missing information must widen ranges —
 * never invent precision the inputs do not support.
 */

const CONFIDENCE_ORDER: ConfidenceLevel[] = ['low', 'medium', 'high']

export function downgradeConfidence(
  current: ConfidenceLevel,
  steps = 1,
): ConfidenceLevel {
  const idx = CONFIDENCE_ORDER.indexOf(current)
  return CONFIDENCE_ORDER[Math.max(0, idx - steps)]!
}

export function mergeConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) return 'low'
  const minIdx = Math.min(...levels.map((l) => CONFIDENCE_ORDER.indexOf(l)))
  return CONFIDENCE_ORDER[minIdx]!
}

/**
 * Widen a numeric band when confidence is weaker.
 * Returns null endpoints unchanged — unknown stays unknown.
 */
export function widenRange(
  low: MaybeNumber,
  high: MaybeNumber,
  confidence: ConfidenceLevel,
): { low: MaybeNumber; high: MaybeNumber } {
  if (low === null || high === null) {
    return { low, high }
  }

  const mid = (low + high) / 2
  const half = (high - low) / 2
  const factor =
    confidence === 'high' ? 1 : confidence === 'medium' ? 1.25 : 1.5

  return {
    low: Math.max(0, mid - half * factor),
    high: mid + half * factor,
  }
}

/** Count of provided vs expected fields — used to set overall confidence. */
export function confidenceFromCompleteness(
  knownCount: number,
  totalCount: number,
): ConfidenceLevel {
  if (totalCount <= 0) return 'low'
  const ratio = knownCount / totalCount
  if (ratio >= 0.8) return 'high'
  if (ratio >= 0.5) return 'medium'
  return 'low'
}

function isKnown(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (typeof value === 'number' && Number.isNaN(value)) return false
  return true
}

export interface ProfileConfidence {
  level: ConfidenceLevel
  reason: string
  unknownFields: (keyof BorrowerProfile)[]
  missingInputsForPrecision: string[]
}

/**
 * Information-quality confidence for the overall assessment.
 * Not cosmetic — missing bureau/income stability must lower this.
 */
export function assessProfileConfidence(
  profile: BorrowerProfile,
): ProfileConfidence {
  const unknownFields: (keyof BorrowerProfile)[] = []
  const missingInputsForPrecision: string[] = []

  const checks: Array<{
    key: keyof BorrowerProfile
    label: string
    weight: 'must' | 'important'
  }> = [
    { key: 'monthlyIncome', label: 'monthly income', weight: 'must' },
    { key: 'requestedAmount', label: 'requested amount', weight: 'must' },
    { key: 'loanPurpose', label: 'loan purpose', weight: 'must' },
    { key: 'existingEmi', label: 'existing EMI', weight: 'important' },
    { key: 'monthlyExpenses', label: 'household expenses', weight: 'important' },
    { key: 'employmentType', label: 'employment type', weight: 'important' },
    { key: 'incomeStability', label: 'income stability', weight: 'important' },
    { key: 'creditScoreBand', label: 'credit score', weight: 'important' },
    {
      key: 'desiredTenureMonths',
      label: 'desired tenure',
      weight: 'important',
    },
    {
      key: 'recentBouncedEmi',
      label: 'repayment history (bounces)',
      weight: 'important',
    },
    {
      key: 'hasFormalCreditHistory',
      label: 'formal credit history',
      weight: 'important',
    },
    {
      key: 'employmentYears',
      label: 'employment / business history',
      weight: 'important',
    },
  ]

  // Income may be represented via band or documented ITR
  const incomeKnown =
    isKnown(profile.monthlyIncome) ||
    (isKnown(profile.monthlyIncomeLow) && isKnown(profile.monthlyIncomeHigh)) ||
    isKnown(profile.documentedAnnualIncome)

  let mustKnown = 0
  let mustTotal = 0
  let importantKnown = 0
  let importantTotal = 0

  for (const check of checks) {
    mustTotal += check.weight === 'must' ? 1 : 0
    importantTotal += check.weight === 'important' ? 1 : 0

    let known = isKnown(profile[check.key])
    if (check.key === 'monthlyIncome') known = incomeKnown
    if (check.key === 'creditScoreBand') {
      known =
        isKnown(profile.creditScoreBand) &&
        profile.creditScoreBand !== 'unknown'
          ? true
          : isKnown(profile.creditScore)
    }

    if (known) {
      if (check.weight === 'must') mustKnown += 1
      else importantKnown += 1
    } else {
      unknownFields.push(check.key)
      missingInputsForPrecision.push(check.label)
    }
  }

  // Collateral details matter when claimed
  if (profile.hasCollateral === true && !isKnown(profile.collateralValue)) {
    missingInputsForPrecision.push('collateral value')
    unknownFields.push('collateralValue')
  }

  let level: ConfidenceLevel = 'high'
  if (mustKnown < mustTotal) level = 'low'
  else if (
    profile.hasFormalCreditHistory === false ||
    profile.creditScoreBand === 'unknown' ||
    (profile.creditScoreBand === null && profile.creditScore === null)
  ) {
    level = 'medium'
  } else if (importantKnown / Math.max(importantTotal, 1) < 0.5) {
    level = 'medium'
  }

  if (
    profile.incomeStability === 'variable' &&
    (profile.hasFormalCreditHistory === false ||
      profile.creditScoreBand === 'unknown' ||
      (profile.creditScoreBand === null && profile.creditScore === null))
  ) {
    level = 'low'
  }

  if (profile.recentBouncedEmi === true && !incomeKnown) {
    level = 'low'
  }

  // Completeness nudge
  const completeness = confidenceFromCompleteness(
    mustKnown + importantKnown,
    mustTotal + importantTotal,
  )
  level = mergeConfidence([level, completeness])

  const knownCredit =
    (profile.creditScoreBand !== null &&
      profile.creditScoreBand !== 'unknown') ||
    profile.creditScore !== null

  let reason: string
  if (level === 'high') {
    reason =
      'High confidence because income, obligations and credit profile are sufficiently known.'
  } else if (level === 'medium') {
    if (!knownCredit) {
      reason =
        'Medium confidence because your income and existing EMI are known, but your credit score is unavailable.'
    } else {
      reason = `Medium confidence — some important details are missing (${missingInputsForPrecision.slice(0, 3).join(', ') || 'partial profile'}).`
    }
  } else if (
    profile.incomeStability === 'variable' &&
    profile.hasFormalCreditHistory === false
  ) {
    reason =
      'Low confidence because income is variable and there is no formal credit history.'
  } else {
    reason = `Low confidence because key inputs are missing or uncertain (${missingInputsForPrecision.slice(0, 4).join(', ') || 'limited profile'}).`
  }

  return {
    level,
    reason,
    unknownFields,
    missingInputsForPrecision: [
      ...new Set(
        missingInputsForPrecision.map(
          (label) => `What would make this estimate more precise? → ${label}`,
        ),
      ),
    ].map((s) => s.replace('What would make this estimate more precise? → ', '')),
  }
}
