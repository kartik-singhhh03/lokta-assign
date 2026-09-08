import type {
  AffordabilityResult,
  BorrowerProfile,
  FairRateResult,
  MaybeNumber,
  ProductType,
  StressStatus,
  StressTestResult,
} from '../types'
import { formatInr, formatPercentPoints } from '../utils/currency'
import { resolveRepaymentIncome } from './calculateAffordability'
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
  const { income } = resolveRepaymentIncome(profile)
  const baseRate = fairRate.expected

  const baseEmi = calculateEmi(proposedPrincipal, baseRate, tenureMonths)

  const useIncomeStress =
    profile.incomeStability === 'variable' ||
    profile.employmentType === 'gig' ||
    profile.employmentType === 'informal' ||
    profile.employmentType === 'self_employed' ||
    profile.employmentType === 'business'

  const stressedIncome =
    income === null ? null : income * (1 - STRESS_RULES.incomeStressPercent)

  const stressedRate =
    baseRate === null
      ? null
      : baseRate + STRESS_RULES.rateStressPercentagePoints

  const stressedEmi = useIncomeStress
    ? baseEmi
    : calculateEmi(proposedPrincipal, stressedRate, tenureMonths)

  const expenses = affordability.expensesUsed
  const existingKnown = affordability.existingEmiUsed

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

  let status: StressStatus = 'unknown'
  if (stressedBuffer !== null) {
    if (
      stressedBuffer < AFFORDABILITY_RULES.minimumHouseholdBuffer ||
      stillWithinSafeCeiling === false
    ) {
      status = 'stressed'
    } else if (
      stressedBuffer < AFFORDABILITY_RULES.minimumHouseholdBuffer * 3
    ) {
      status = 'tight'
    } else {
      status = 'comfortable'
    }
  }

  const scenarioLabel = useIncomeStress
    ? `Income drops ${(STRESS_RULES.incomeStressPercent * 100).toFixed(0)}%`
    : `Rate rises by ${STRESS_RULES.rateStressPercentagePoints} percentage points`

  let text: string
  if (useIncomeStress) {
    text = `If income drops ${(STRESS_RULES.incomeStressPercent * 100).toFixed(0)}%, it would fall from ${formatInr(income)} to ${formatInr(stressedIncome)}. Your remaining monthly buffer would fall from ${formatInr(baseBuffer)} to ${formatInr(stressedBuffer)}.`
  } else {
    text = `If the rate rises by ${STRESS_RULES.rateStressPercentagePoints} percentage points from ${formatPercentPoints(baseRate)} to ${formatPercentPoints(stressedRate)}, EMI would move from ${formatInr(baseEmi)} to ${formatInr(stressedEmi)}. Your remaining monthly buffer would fall from ${formatInr(baseBuffer)} to ${formatInr(stressedBuffer)}.`
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
    status,
    explanation: {
      label: 'Stress test',
      summary: `${scenarioLabel}: buffer ${formatInr(baseBuffer)} → ${formatInr(stressedBuffer)} (${status}).`,
      text,
      factors: [
        scenarioLabel,
        `Status: ${status}`,
        `Base buffer ${formatInr(baseBuffer)}`,
        `Stressed buffer ${formatInr(stressedBuffer)}`,
      ],
    },
  }
}
