import type {
  Answer,
  BorrowerProfile,
  CityTier,
  CreditScoreBand,
  EmploymentType,
  IncomeStability,
  Question,
} from '../types'
import { ASSESSMENT_QUESTIONS } from '../data/questions'

function emptyProfile(): BorrowerProfile {
  return {
    name: null,
    age: null,
    city: null,
    cityTier: null,
    monthlyIncome: null,
    monthlyIncomeLow: null,
    monthlyIncomeHigh: null,
    documentedAnnualIncome: null,
    spouseMonthlyIncome: null,
    spouseIsCoApplicant: null,
    employmentType: null,
    incomeStability: null,
    employmentYears: null,
    employerDescription: null,
    existingEmi: null,
    outstandingUnsecuredDebt: null,
    hasHighCostDebt: null,
    monthlyExpenses: null,
    dependents: null,
    recentBouncedEmi: null,
    spouseUnemployed: null,
    creditScoreBand: null,
    creditScore: null,
    hasFormalCreditHistory: null,
    hasCollateral: null,
    collateralValue: null,
    collateralDescription: null,
    requestedAmount: null,
    desiredTenureMonths: null,
    loanPurpose: null,
    quotedProcessingFeePercent: null,
  }
}

function asNumber(value: Answer['value']): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const trimmed = String(value).trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function asBoolean(value: Answer['value']): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 'yes') return true
  if (value === 'false' || value === 'no') return false
  return null
}

function asString(value: Answer['value']): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value)
  }
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const EMPLOYMENT: EmploymentType[] = [
  'salaried',
  'self_employed',
  'business',
  'gig',
  'informal',
  'other',
]
const STABILITY: IncomeStability[] = ['stable', 'moderate', 'variable']
const CREDIT: CreditScoreBand[] = [
  'below_650',
  '650_699',
  '700_749',
  '750_799',
  '800_plus',
  'unknown',
]
const TIERS: CityTier[] = ['tier1', 'tier2', 'tier3', 'other']

function assignField(
  profile: BorrowerProfile,
  key: keyof BorrowerProfile,
  value: Answer['value'],
): void {
  switch (key) {
    case 'monthlyIncome':
    case 'monthlyIncomeLow':
    case 'monthlyIncomeHigh':
    case 'documentedAnnualIncome':
    case 'spouseMonthlyIncome':
    case 'employmentYears':
    case 'existingEmi':
    case 'outstandingUnsecuredDebt':
    case 'monthlyExpenses':
    case 'dependents':
    case 'creditScore':
    case 'collateralValue':
    case 'requestedAmount':
    case 'desiredTenureMonths':
    case 'quotedProcessingFeePercent':
    case 'age':
      profile[key] = asNumber(value)
      break
    case 'recentBouncedEmi':
    case 'hasCollateral':
    case 'hasFormalCreditHistory':
    case 'spouseIsCoApplicant':
    case 'hasHighCostDebt':
    case 'spouseUnemployed': {
      profile[key] = asBoolean(value)
      break
    }
    case 'employmentType': {
      const s = asString(value)
      profile.employmentType =
        s && (EMPLOYMENT as string[]).includes(s)
          ? (s as EmploymentType)
          : null
      break
    }
    case 'incomeStability': {
      const s = asString(value)
      profile.incomeStability =
        s && (STABILITY as string[]).includes(s)
          ? (s as IncomeStability)
          : null
      break
    }
    case 'creditScoreBand': {
      const s = asString(value)
      profile.creditScoreBand =
        s && (CREDIT as string[]).includes(s) ? (s as CreditScoreBand) : null
      if (profile.creditScoreBand === 'unknown') {
        // Explicit unknown — not a score, and not thin-file by itself
        profile.creditScore = null
      }
      break
    }
    case 'cityTier': {
      const s = asString(value)
      profile.cityTier =
        s && (TIERS as string[]).includes(s) ? (s as CityTier) : null
      break
    }
    case 'name':
    case 'city':
    case 'employerDescription':
    case 'collateralDescription':
    case 'loanPurpose':
      profile[key] = asString(value)
      break
    default:
      break
  }
}

/** Build a BorrowerProfile from answers. Unknown / skipped stays null. */
export function answersToProfile(
  questions: Question[] = ASSESSMENT_QUESTIONS,
  answers: Answer[],
): BorrowerProfile {
  const profile = emptyProfile()
  const byId = new Map(answers.map((a) => [a.questionId, a]))

  for (const question of questions) {
    const answer = byId.get(question.id)
    if (!answer) continue
    // Explicit null answer → leave field null (unknown)
    if (answer.value === null) continue
    assignField(profile, question.profileKey, answer.value)
  }

  // Derive formal credit history hint from score band when not asked directly
  if (
    profile.hasFormalCreditHistory === null &&
    profile.creditScoreBand !== null
  ) {
    if (profile.creditScoreBand === 'unknown') {
      // leave null — "I don't know" ≠ thin file
      profile.hasFormalCreditHistory = null
    } else {
      profile.hasFormalCreditHistory = true
    }
  }

  return profile
}

export { emptyProfile }
