import type {
  AffordabilityResult,
  BorrowerProfile,
  ConfidenceLevel,
  FairRateResult,
  ProductType,
} from '../types'
import { formatInr, formatPercentPoints } from '../utils/currency'
import { downgradeConfidence } from '../utils/confidence'
import {
  RATE_ADJUSTMENTS,
  RATE_BANDS,
  RATE_LIMITS,
} from './rules'

type Band = { low: number; high: number }

function clampRate(value: number): number {
  return Math.min(
    RATE_LIMITS.absoluteCeiling,
    Math.max(RATE_LIMITS.absoluteFloor, value),
  )
}

function baseBand(
  product: ProductType,
  profile: BorrowerProfile,
  distressed: boolean,
): { band: Band; label: string } {
  const thin =
    profile.hasFormalCreditHistory === false ||
    profile.creditScoreBand === 'unknown' ||
    (profile.creditScoreBand === null && profile.creditScore === null)

  if (distressed) {
    if (product === 'SECURED_BUSINESS') {
      return {
        band: { ...RATE_BANDS.securedBusiness.distressed },
        label: 'secured distressed illustrative band',
      }
    }
    if (product === 'VEHICLE') {
      return {
        band: { ...RATE_BANDS.vehicle.distressed },
        label: 'vehicle distressed illustrative band',
      }
    }
    if (product === 'BUSINESS') {
      return {
        band: { ...RATE_BANDS.business.distressed },
        label: 'business distressed illustrative band',
      }
    }
    return {
      band: { ...RATE_BANDS.personal.distressed },
      label: 'distressed illustrative band',
    }
  }

  if (product === 'SECURED_BUSINESS') {
    if (thin) {
      return {
        band: { ...RATE_BANDS.securedBusiness.thinOrNoBureau },
        label: 'secured thin-file illustrative band',
      }
    }
    if (isStrongCredit(profile)) {
      return {
        band: { ...RATE_BANDS.securedBusiness.strong },
        label: 'secured strong-profile illustrative band',
      }
    }
    return {
      band: { ...RATE_BANDS.securedBusiness.standard },
      label: 'secured standard illustrative band',
    }
  }

  if (product === 'BUSINESS') {
    if (thin) {
      return {
        band: { ...RATE_BANDS.business.thinOrNoBureau },
        label: 'business thin-file illustrative band',
      }
    }
    return {
      band: { ...RATE_BANDS.business.documented },
      label: 'business documented illustrative band',
    }
  }

  if (product === 'VEHICLE') {
    if (thin) {
      return {
        band: { ...RATE_BANDS.vehicle.thinOrNoBureau },
        label: 'vehicle thin-file illustrative band',
      }
    }
    if (isStrongCredit(profile)) {
      return {
        band: { ...RATE_BANDS.vehicle.strong },
        label: 'vehicle strong-profile illustrative band',
      }
    }
    return {
      band: { ...RATE_BANDS.vehicle.standard },
      label: 'vehicle standard illustrative band',
    }
  }

  if (product === 'HOME') {
    if (thin) {
      return {
        band: { ...RATE_BANDS.home.thinOrNoBureau },
        label: 'home thin-file illustrative band',
      }
    }
    if (isStrongCredit(profile)) {
      return {
        band: { ...RATE_BANDS.home.strong },
        label: 'home strong-profile illustrative band',
      }
    }
    return {
      band: { ...RATE_BANDS.home.standard },
      label: 'home standard illustrative band',
    }
  }

  if (product === 'OTHER') {
    if (thin) {
      return {
        band: { ...RATE_BANDS.other.thinOrNoBureau },
        label: 'other thin-file illustrative band',
      }
    }
    return {
      band: { ...RATE_BANDS.other.standard },
      label: 'other standard illustrative band',
    }
  }

  // PERSONAL
  if (thin) {
    return {
      band: { ...RATE_BANDS.personal.thinOrNoBureau },
      label: 'personal thin-file illustrative band',
    }
  }
  if (
    profile.employmentType === 'self_employed' ||
    profile.employmentType === 'business'
  ) {
    return {
      band: { ...RATE_BANDS.personal.selfEmployedDocumented },
      label: 'personal self-employed illustrative band',
    }
  }
  if (
    profile.creditScoreBand === '800_plus' ||
    (profile.creditScore !== null && profile.creditScore >= 800)
  ) {
    return {
      band: { ...RATE_BANDS.personal.excellentSalaried },
      label: 'excellent salaried personal illustrative band',
    }
  }
  if (isStrongCredit(profile)) {
    return {
      band: { ...RATE_BANDS.personal.excellentSalaried },
      label: 'strong salaried personal illustrative band',
    }
  }
  if (
    profile.creditScoreBand === '700_749' ||
    (profile.creditScore !== null && profile.creditScore >= 700)
  ) {
    return {
      band: { ...RATE_BANDS.personal.goodSalaried },
      label: 'good salaried personal illustrative band',
    }
  }
  if (
    profile.creditScoreBand === '650_699' ||
    (profile.creditScore !== null && profile.creditScore >= 650)
  ) {
    return {
      band: { ...RATE_BANDS.personal.fairSalaried },
      label: 'fair credit personal illustrative band',
    }
  }
  if (profile.creditScoreBand === 'below_650') {
    return {
      band: { ...RATE_BANDS.personal.distressed },
      label: 'below-650 personal illustrative band',
    }
  }
  return {
    band: { ...RATE_BANDS.personal.goodSalaried },
    label: 'default personal illustrative band',
  }
}

function isStrongCredit(profile: BorrowerProfile): boolean {
  return (
    profile.creditScoreBand === '750_799' ||
    profile.creditScoreBand === '800_plus' ||
    (profile.creditScore !== null && profile.creditScore >= 750)
  )
}

function creditAdjustment(profile: BorrowerProfile): {
  lowDelta: number
  highDelta: number
  reason: string | null
  unknown: boolean
} {
  const score = profile.creditScore
  const band = profile.creditScoreBand

  if (profile.hasFormalCreditHistory === false) {
    return {
      lowDelta: RATE_ADJUSTMENTS.credit.unknownWidenLow,
      highDelta: RATE_ADJUSTMENTS.credit.unknownWidenHigh,
      reason:
        'No formal credit history (thin file) — band widened; we do not treat this as a 300 score',
      unknown: true,
    }
  }

  if (band === 'unknown' || (band === null && score === null)) {
    return {
      lowDelta: RATE_ADJUSTMENTS.credit.unknownWidenLow,
      highDelta: RATE_ADJUSTMENTS.credit.unknownWidenHigh,
      reason:
        'Credit score unavailable — indicative band widened and confidence reduced (not assumed bad credit)',
      unknown: true,
    }
  }

  if (band === '800_plus' || (score !== null && score >= 800)) {
    return {
      lowDelta: RATE_ADJUSTMENTS.credit.score_800_plus,
      highDelta: RATE_ADJUSTMENTS.credit.score_800_plus,
      reason: `Credit score ${score ?? '800+'} supports stronger pricing`,
      unknown: false,
    }
  }
  if (band === '750_799' || (score !== null && score >= 750)) {
    return {
      lowDelta: RATE_ADJUSTMENTS.credit.score_750_799,
      highDelta: RATE_ADJUSTMENTS.credit.score_750_799,
      reason: `Credit score ${score ?? '750–799'} supports the lower end of the indicative range`,
      unknown: false,
    }
  }
  if (band === '700_749' || (score !== null && score >= 700)) {
    return {
      lowDelta: RATE_ADJUSTMENTS.credit.score_700_749,
      highDelta: RATE_ADJUSTMENTS.credit.score_700_749 + 0.5,
      reason: `Credit score ${score ?? '700–749'} is moderate for pricing`,
      unknown: false,
    }
  }
  if (band === '650_699' || (score !== null && score >= 650)) {
    return {
      lowDelta: RATE_ADJUSTMENTS.credit.score_650_699,
      highDelta: RATE_ADJUSTMENTS.credit.score_650_699 + 0.75,
      reason: `Credit score ${score ?? '650–699'} pushes pricing higher`,
      unknown: false,
    }
  }
  if (band === 'below_650' || (score !== null && score < 650)) {
    return {
      lowDelta: RATE_ADJUSTMENTS.credit.score_below_650,
      highDelta: RATE_ADJUSTMENTS.credit.score_below_650 + 1.5,
      reason: `Credit score ${score ?? 'below 650'} meaningfully worsens the indicative range`,
      unknown: false,
    }
  }

  return { lowDelta: 0, highDelta: 0, reason: null, unknown: false }
}

export function calculateRate(
  profile: BorrowerProfile,
  product: ProductType,
  affordability: AffordabilityResult,
): FairRateResult {
  const distressed = affordability.isDistressed
  const { band, label } = baseBand(product, profile, distressed)
  const reasons: string[] = [
    `Starting from ${label}: ${band.low}% – ${band.high}%`,
  ]

  let low = band.low
  let high = band.high
  let confidence: ConfidenceLevel = 'high'

  const credit = creditAdjustment(profile)
  low += credit.lowDelta
  high += credit.highDelta
  if (credit.reason) reasons.push(credit.reason)
  if (credit.unknown) confidence = downgradeConfidence(confidence)

  if (
    profile.employmentType === 'salaried' &&
    profile.incomeStability !== 'variable'
  ) {
    low += RATE_ADJUSTMENTS.income.stableSalaried
    high += RATE_ADJUSTMENTS.income.stableSalaried
    reasons.push('Stable salaried income supports better indicative pricing')
  } else if (
    profile.employmentType === 'self_employed' ||
    profile.employmentType === 'business'
  ) {
    low += RATE_ADJUSTMENTS.income.documentedSelfEmployed
    high += RATE_ADJUSTMENTS.income.documentedSelfEmployed
    reasons.push(
      'Self-employed / business income uses a moderate pricing adjustment',
    )
  } else if (
    profile.employmentType === 'gig' ||
    profile.employmentType === 'informal' ||
    profile.incomeStability === 'variable'
  ) {
    low += RATE_ADJUSTMENTS.income.variableInformal
    high += RATE_ADJUSTMENTS.income.variableInformal
    reasons.push('Variable / informal income increases pricing uncertainty')
    confidence = downgradeConfidence(confidence)
  }

  if (profile.employmentYears !== null) {
    if (profile.employmentYears >= 5) {
      low += RATE_ADJUSTMENTS.history.years5Plus
      high += RATE_ADJUSTMENTS.history.years5Plus
      reasons.push(
        `${profile.employmentYears} years of work/business history is a small positive signal`,
      )
    } else if (profile.employmentYears < 2) {
      low += RATE_ADJUSTMENTS.history.yearsUnder2
      high += RATE_ADJUSTMENTS.history.yearsUnder2
      reasons.push(
        'Short employment / business history widens and lifts the range',
      )
    }
  } else {
    high += RATE_ADJUSTMENTS.history.unknownWiden
    reasons.push(
      'Employment / business tenure unknown — slight extra uncertainty',
    )
    confidence = confidence === 'high' ? 'medium' : confidence
  }

  if (profile.recentBouncedEmi === true) {
    low += RATE_ADJUSTMENTS.repayment.recentBounceWidenLow
    high += RATE_ADJUSTMENTS.repayment.recentBounceWidenHigh
    reasons.push(
      'Recent bounced / missed EMI meaningfully worsens the indicative range',
    )
    confidence = 'low'
  }

  const widen = RATE_ADJUSTMENTS.confidenceWiden[confidence]
  if (widen > 0) {
    low -= widen
    high += widen
    reasons.push(
      `Confidence is ${confidence}, so the indicative band is widened by ±${widen} pp`,
    )
  }

  low = clampRate(low)
  high = clampRate(Math.max(high, low + 0.5))

  let expected = clampRate(low + (high - low) * 0.4)

  if (!credit.unknown && !distressed && isStrongCredit(profile)) {
    expected = clampRate(low + (high - low) * 0.25)
    reasons.push(
      `Strong bureau profile anchors the expected rate near ${formatPercentPoints(expected)}`,
    )
  }

  const incomeHint =
    profile.monthlyIncome ??
    (profile.documentedAnnualIncome !== null
      ? profile.documentedAnnualIncome / 12
      : null)
  if (incomeHint !== null) {
    reasons.push(`Income context: ${formatInr(incomeHint)} monthly basis`)
  }

  return {
    low,
    high,
    expected,
    confidence,
    reasons,
    explanation: {
      label: 'Indicative fair rate',
      summary: `Indicative fair rate ${formatPercentPoints(low)} – ${formatPercentPoints(high)} (expected ~${formatPercentPoints(expected)}).`,
      text: `${reasons.join(' ')} These bands are illustrative judgement assumptions — not guaranteed lender offers.`,
      factors: reasons,
    },
  }
}
