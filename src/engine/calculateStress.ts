import type {
  AffordabilityResult,
  BorrowerProfile,
  FairRateResult,
  MaybeNumber,
  ProductType,
  StressTestResult,
} from '../types'
import { formatInr, formatPercentPoints } from '../utils/currency'
import { resolveHouseholdIncome } from './calculateAffordability'
import { calculateEmi } from './calculateEmi'
import { AFFORDABILITY_RULES, STRESS_RULES } from './rules'

export function calculateStress(params: {
  profile: BorrowerProfile
  product: ProductType
  affordability: AffordabilityResult
  fairRate: FairRateResult
  proposedPrincipal: MaybeNumber
  tenureMonths: number
}): StressTestResult {
  const { profile, affordability, fairRate, proposedPrincipal, tenureMonths } =
    params
  const { income } = resolveHouseholdIncome(profile)
  const baseRate = fairRate.expected

  const baseEmi = calculateEmi(proposedPrincipal, baseRate, tenureMonths)

  // Prefer income stress for variable/informal; rate stress for stable salaried floating-like personal/business
  const useIncomeStress =
    profile.incomeStability === 'variable' ||
    profile.employmentType === 'gig' ||
    profile.employmentType === 'informal' ||
    profile.employmentType === 'self_employed' ||
    profile.employmentType === 'business'

  const stressedIncome =
    income === null
      ? null
      : income * (1 - STRESS_RULES.incomeStressPercent)

  const stressedRate =
    baseRate === null
      ? null
      : baseRate + STRESS_RULES.rateStressPercentagePoints

  const stressedEmi = useIncomeStress
    ? baseEmi
    : calculateEmi(proposedPrincipal, stressedRate, tenureMonths)

  const existingKnown = profile.existingEmi

  const expenses = profile.monthlyExpenses

  const baseBuffer =
    income === null ||
    expenses === null ||
    existingKnown === null ||
    baseEmi === null
      ? null
      : income - expenses - existingKnown - baseEmi

  const stressedBuffer = useIncomeStress
    ? stressedIncome === null ||
      expenses === null ||
      existingKnown === null ||
      stressedEmi === null
      ? null
      : stressedIncome - expenses - existingKnown - stressedEmi
    : income === null ||
        expenses === null ||
        existingKnown === null ||
        stressedEmi === null
      ? null
      : income - expenses - existingKnown - stressedEmi

  const safeCeiling = affordability.safeNewEmi
  const stillWithinSafeCeiling =
    safeCeiling === null || stressedEmi === null
      ? null
      : stressedEmi <= safeCeiling

  const scenarioLabel = useIncomeStress
    ? `Income stress (−${(STRESS_RULES.incomeStressPercent * 100).toFixed(0)}%)`
    : `Rate stress (+${STRESS_RULES.rateStressPercentagePoints} pp)`

  let text: string
  if (useIncomeStress) {
    text = `After a ${(STRESS_RULES.incomeStressPercent * 100).toFixed(0)}% income drop, income would fall from ${formatInr(income)} to ${formatInr(stressedIncome)}. Proposed EMI stays about ${formatInr(baseEmi)}, so your monthly buffer moves from ${formatInr(baseBuffer)} to ${formatInr(stressedBuffer)}.`
  } else {
    text = `If the rate rises by ${STRESS_RULES.rateStressPercentagePoints} percentage points from ${formatPercentPoints(baseRate)} to ${formatPercentPoints(stressedRate)}, EMI would move from ${formatInr(baseEmi)} to ${formatInr(stressedEmi)}. Monthly buffer would move from ${formatInr(baseBuffer)} to ${formatInr(stressedBuffer)}.`
  }

  if (stillWithinSafeCeiling === false) {
    text += ' Under stress, the EMI no longer fits inside your safe ceiling.'
  } else if (stillWithinSafeCeiling === true) {
    text += ' Even under stress, the EMI stays within your safe ceiling — buffers still matter.'
  }

  if (
    stressedBuffer !== null &&
    stressedBuffer < AFFORDABILITY_RULES.minimumHouseholdBuffer
  ) {
    text += ' Residual cash flow under stress falls below our minimum household buffer.'
  }

  return {
    scenarioLabel,
    baseIncome: income,
    stressedIncome: useIncomeStress ? stressedIncome : income,
    baseRate,
    stressedRate: useIncomeStress ? baseRate : stressedRate,
    baseEmi,
    stressedEmi,
    baseBuffer,
    stressedBuffer,
    stillWithinSafeCeiling,
    explanation: {
      label: 'Stress test',
      summary: `${scenarioLabel}: buffer ${formatInr(baseBuffer)} → ${formatInr(stressedBuffer)}.`,
      text,
      factors: [
        scenarioLabel,
        `Base EMI ${formatInr(baseEmi)}`,
        `Stressed EMI ${formatInr(stressedEmi)}`,
        `Safe new-EMI ceiling ${formatInr(safeCeiling)}`,
      ],
    },
  }
}
