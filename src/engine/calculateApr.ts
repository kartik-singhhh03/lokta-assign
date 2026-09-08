import type { AprResult, Explanation, MaybeNumber } from '../types'
import { formatInr, formatPercentPoints } from '../utils/currency'
import {
  calculateEmi,
  calculateTotalRepayment,
} from './calculateEmi'
import { FEE_RULES } from './rules'

/**
 * APR / all-in annualised cost from actual cash flows.
 *
 * Cash flows:
 *   t=0:  +netDisbursal  (principal − processing fee)
 *   t=1..n: −EMI         (EMI computed on full principal at headline rate)
 *
 * Solve monthly IRR r with NPV = 0, then
 *   APR = ((1 + r)^12 − 1) × 100
 *
 * This is an effective annual rate — not "headline + fee%".
 */

function solveMonthlyIrr(
  netDisbursal: number,
  emi: number,
  tenureMonths: number,
): number | null {
  if (netDisbursal <= 0 || emi <= 0 || tenureMonths <= 0) return null

  let r = 0.02

  for (let i = 0; i < 50; i += 1) {
    const onePlus = 1 + r
    if (onePlus <= 0) return null

    const invPow = onePlus ** -tenureMonths
    let annuity: number
    let dAnnuity: number

    if (Math.abs(r) < 1e-10) {
      annuity = tenureMonths
      dAnnuity = -(tenureMonths * (tenureMonths + 1)) / 2
    } else {
      annuity = (1 - invPow) / r
      dAnnuity =
        ((tenureMonths * invPow) / onePlus) / r - (1 - invPow) / (r * r)
    }

    const f = netDisbursal - emi * annuity
    const df = -emi * dAnnuity
    if (Math.abs(df) < 1e-14) break

    const next = r - f / df
    if (!Number.isFinite(next)) return null
    if (Math.abs(next - r) < 1e-10) {
      r = next
      break
    }
    r = next
  }

  if (!Number.isFinite(r) || r <= -1) return null
  return r
}

export function calculateApr(params: {
  principal: MaybeNumber
  annualRatePercent: MaybeNumber
  tenureMonths: MaybeNumber
  processingFeePercent?: MaybeNumber
}): AprResult {
  const feePercent =
    params.processingFeePercent === null ||
    params.processingFeePercent === undefined
      ? FEE_RULES.illustrativeProcessingFeePercent
      : params.processingFeePercent

  const empty = (explanation: Explanation): AprResult => ({
    headlineRate: params.annualRatePercent,
    processingFeePercent: feePercent,
    processingFeeAmount: null,
    netDisbursal: null,
    totalRepayment: null,
    apr: null,
    methodNote:
      'Effective annual APR from cash-flow IRR when inputs are complete; otherwise unknown.',
    explanation,
  })

  if (
    params.principal === null ||
    params.annualRatePercent === null ||
    params.tenureMonths === null ||
    feePercent === null ||
    !Number.isFinite(params.principal) ||
    !Number.isFinite(params.annualRatePercent) ||
    !Number.isFinite(params.tenureMonths) ||
    !Number.isFinite(feePercent) ||
    params.principal <= 0 ||
    params.tenureMonths <= 0 ||
    params.annualRatePercent < 0 ||
    feePercent < 0
  ) {
    return empty({
      summary:
        'APR cannot be computed until principal, rate and tenure are known.',
      factors: ['Missing or invalid loan inputs'],
      missingInputs: ['principal', 'rate', 'tenure'],
      label: 'APR',
      text: 'We need a principal, headline rate and tenure to compute an all-in APR.',
    })
  }

  const processingFeeAmount = (params.principal * feePercent) / 100
  const netDisbursal = params.principal - processingFeeAmount
  const emi = calculateEmi(
    params.principal,
    params.annualRatePercent,
    params.tenureMonths,
  )
  const totalRepayment = calculateTotalRepayment(emi, params.tenureMonths)

  if (emi === null || netDisbursal <= 0) {
    return empty({
      summary: 'APR cannot be computed from the current cash flows.',
      factors: ['Invalid EMI or fee larger than principal'],
      label: 'APR',
      text: 'Processing fee or EMI inputs produced an invalid cash-flow set.',
    })
  }

  const monthlyIrr = solveMonthlyIrr(netDisbursal, emi, params.tenureMonths)
  const apr =
    monthlyIrr === null ? null : ((1 + monthlyIrr) ** 12 - 1) * 100

  return {
    headlineRate: params.annualRatePercent,
    processingFeePercent: feePercent,
    processingFeeAmount,
    netDisbursal,
    totalRepayment,
    apr,
    methodNote:
      'APR = effective annual rate from monthly IRR on cash flows (+net disbursal, −EMI × n). Not headline + fee%.',
    explanation: {
      label: 'Interest rate vs APR',
      summary: `Headline ${formatPercentPoints(params.annualRatePercent)} becomes about ${formatPercentPoints(apr)} all-in APR after an illustrative ${formatPercentPoints(feePercent)} processing fee.`,
      text: `On ${formatInr(params.principal)}, an illustrative ${formatPercentPoints(feePercent)} fee is ${formatInr(processingFeeAmount)}. You would receive about ${formatInr(netDisbursal)} but repay EMIs on the full principal. APR annualises that cash-flow difference — it is not simply headline rate + fee%. ${FEE_RULES.feeDisclaimer}`,
      factors: [
        `Headline rate ${formatPercentPoints(params.annualRatePercent)}`,
        `Illustrative processing fee ${formatPercentPoints(feePercent)} → ${formatInr(processingFeeAmount)}`,
        `Net disbursal ${formatInr(netDisbursal)}`,
        `Total repayment ${formatInr(totalRepayment)}`,
      ],
    },
  }
}
