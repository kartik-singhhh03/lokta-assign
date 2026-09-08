import type { BorrowerProfile } from '../types'
import { emptyProfile } from '../engine/answersToProfile'

/** Canonical demo borrowers — only fields stated in the brief (or explicit nulls). */
export const DEMO_PRIYA: BorrowerProfile = {
  ...emptyProfile(),
  name: 'Priya',
  age: 29,
  city: 'Bengaluru',
  cityTier: 'tier1',
  monthlyIncome: 1_10_000,
  employmentType: 'salaried',
  incomeStability: 'stable',
  employmentYears: 5,
  employerDescription: 'Software engineer at large MNC',
  existingEmi: 14_000,
  monthlyExpenses: 28_000,
  dependents: 0,
  recentBouncedEmi: false,
  creditScore: 780,
  creditScoreBand: '750_799',
  hasFormalCreditHistory: true,
  hasCollateral: false,
  requestedAmount: 8_00_000,
  desiredTenureMonths: 36,
  loanPurpose: 'wedding',
}

export const DEMO_RAVI: BorrowerProfile = {
  ...emptyProfile(),
  name: 'Ravi',
  age: 42,
  city: 'Mysuru',
  cityTier: 'tier2',
  monthlyIncome: null,
  monthlyIncomeLow: 40_000,
  monthlyIncomeHigh: 80_000,
  documentedAnnualIncome: 4_20_000,
  spouseMonthlyIncome: 18_000,
  /** Wife’s income is known but she is not automatically a co-applicant */
  spouseIsCoApplicant: false,
  employmentType: 'self_employed',
  incomeStability: 'moderate',
  employmentYears: 14,
  employerDescription: 'Kirana store owner',
  existingEmi: 0,
  /** Household expenses not stated in the brief — left unknown (disclosed assumption in engine) */
  monthlyExpenses: null,
  dependents: 2,
  recentBouncedEmi: false,
  creditScore: null,
  creditScoreBand: null,
  hasFormalCreditHistory: false,
  hasCollateral: true,
  collateralValue: 45_00_000,
  collateralDescription: 'Unencumbered shop',
  requestedAmount: 15_00_000,
  desiredTenureMonths: 60,
  loanPurpose: 'business_expansion',
}

export const DEMO_ANITA: BorrowerProfile = {
  ...emptyProfile(),
  name: 'Anita',
  age: 35,
  city: 'Hubballi',
  cityTier: 'tier3',
  monthlyIncome: null,
  monthlyIncomeLow: 26_000,
  monthlyIncomeHigh: 30_000,
  employmentType: 'informal',
  incomeStability: 'variable',
  employmentYears: 3,
  employerDescription: 'Delivery rider + tailoring',
  /** Exact EMI not stated in the brief — must stay unknown */
  existingEmi: null,
  outstandingUnsecuredDebt: 35_000,
  hasHighCostDebt: true,
  /** Household expenses not stated — left unknown */
  monthlyExpenses: null,
  dependents: 2,
  recentBouncedEmi: true,
  spouseUnemployed: true,
  spouseMonthlyIncome: 0,
  spouseIsCoApplicant: false,
  creditScore: null,
  creditScoreBand: null,
  hasFormalCreditHistory: true,
  hasCollateral: false,
  requestedAmount: 1_50_000,
  desiredTenureMonths: 24,
  loanPurpose: 'scooter',
}

export const DEMO_BORROWERS = {
  priya: DEMO_PRIYA,
  ravi: DEMO_RAVI,
  anita: DEMO_ANITA,
} as const
