import type { MaybeNumber } from '../types'

/**
 * Standard reducing-balance EMI mathematics.
 * Rounding is deferred to presentation — these return raw numbers or null.
 */

function isValidPositive(value: MaybeNumber): value is number {
  return value !== null && Number.isFinite(value) && value > 0
}

function isValidNonNegative(value: MaybeNumber): value is number {
  return value !== null && Number.isFinite(value) && value >= 0
}

/**
 * EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * where r is monthly rate. Zero annual interest → EMI = P / n.
 */
export function calculateEmi(
  principal: MaybeNumber,
  annualRatePercent: MaybeNumber,
  tenureMonths: MaybeNumber,
): MaybeNumber {
  if (
    !isValidPositive(principal) ||
    !isValidPositive(tenureMonths) ||
    annualRatePercent === null ||
    !Number.isFinite(annualRatePercent) ||
    annualRatePercent < 0
  ) {
    return null
  }

  if (annualRatePercent === 0) {
    return principal / tenureMonths
  }

  const r = annualRatePercent / 100 / 12
  const factor = (1 + r) ** tenureMonths
  return (principal * r * factor) / (factor - 1)
}

/**
 * Inverse EMI: maximum principal supported by a given EMI capacity.
 * P = EMI * ((1+r)^n - 1) / (r * (1+r)^n)
 */
export function calculateSupportedPrincipal(
  monthlyEmi: MaybeNumber,
  annualRatePercent: MaybeNumber,
  tenureMonths: MaybeNumber,
): MaybeNumber {
  if (
    !isValidNonNegative(monthlyEmi) ||
    !isValidPositive(tenureMonths) ||
    annualRatePercent === null ||
    !Number.isFinite(annualRatePercent) ||
    annualRatePercent < 0
  ) {
    return null
  }

  if (monthlyEmi === 0) return 0

  if (annualRatePercent === 0) {
    return monthlyEmi * tenureMonths
  }

  const r = annualRatePercent / 100 / 12
  const factor = (1 + r) ** tenureMonths
  return (monthlyEmi * (factor - 1)) / (r * factor)
}

/** Total repayment = EMI × n (when EMI is known). */
export function calculateTotalRepayment(
  emi: MaybeNumber,
  tenureMonths: MaybeNumber,
): MaybeNumber {
  if (!isValidNonNegative(emi) || !isValidPositive(tenureMonths)) return null
  return emi * tenureMonths
}

export function calculateTotalInterest(
  principal: MaybeNumber,
  emi: MaybeNumber,
  tenureMonths: MaybeNumber,
): MaybeNumber {
  const total = calculateTotalRepayment(emi, tenureMonths)
  if (total === null || principal === null || !Number.isFinite(principal)) {
    return null
  }
  return total - principal
}
