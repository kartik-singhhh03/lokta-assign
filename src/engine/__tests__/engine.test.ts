import { describe, expect, it } from 'vitest'
import {
  calculateEmi,
  calculateSupportedPrincipal,
} from '../calculateEmi'
import { calculateApr } from '../calculateApr'
import { assessBorrower } from '../assessBorrower'
import { calculateAffordability } from '../calculateAffordability'
import { calculateRate } from '../calculateRate'
import { determineProduct } from '../determineProduct'
import { emptyProfile } from '../answersToProfile'
import { DEMO_ANITA, DEMO_PRIYA, DEMO_RAVI } from '../../data/demos'
import { widenRange } from '../../utils/confidence'
import { FEE_RULES } from '../rules'
import type { BorrowerProfile } from '../../types'

describe('calculateEmi', () => {
  it('matches a known amortization example', () => {
    // P=100000, 12% annual, 12 months → EMI ≈ 8884.88
    const emi = calculateEmi(100_000, 12, 12)
    expect(emi).not.toBeNull()
    expect(emi!).toBeGreaterThan(8880)
    expect(emi!).toBeLessThan(8890)
  })

  it('handles zero interest', () => {
    expect(calculateEmi(120_000, 0, 12)).toBe(10_000)
  })

  it('returns null for unknown / invalid inputs', () => {
    expect(calculateEmi(null, 12, 12)).toBeNull()
    expect(calculateEmi(100_000, null, 12)).toBeNull()
    expect(calculateEmi(100_000, 12, null)).toBeNull()
    expect(calculateEmi(0, 12, 12)).toBeNull()
  })

  it('inverts EMI to supported principal', () => {
    const emi = calculateEmi(500_000, 14, 36)!
    const principal = calculateSupportedPrincipal(emi, 14, 36)
    expect(principal).not.toBeNull()
    expect(Math.abs(principal! - 500_000)).toBeLessThan(1)
  })

  it('supported principal is 0 when EMI is 0', () => {
    expect(calculateSupportedPrincipal(0, 12, 24)).toBe(0)
  })
})

describe('calculateApr', () => {
  it('APR exceeds headline rate when a processing fee applies', () => {
    const result = calculateApr({
      principal: 8_00_000,
      annualRatePercent: 12,
      tenureMonths: 36,
      processingFeePercent: FEE_RULES.illustrativeProcessingFeePercent,
    })
    expect(result.processingFeeAmount).toBe(16_000)
    expect(result.netDisbursal).toBe(7_84_000)
    expect(result.apr).not.toBeNull()
    expect(result.apr!).toBeGreaterThan(12)
    expect(result.methodNote.toLowerCase()).toContain('irr')
  })

  it('does not invent APR when principal is unknown', () => {
    const result = calculateApr({
      principal: null,
      annualRatePercent: 12,
      tenureMonths: 36,
    })
    expect(result.apr).toBeNull()
    expect(result.netDisbursal).toBeNull()
  })
})

describe('demo borrowers', () => {
  it('Priya is BORROW or BORROW_LESS, never DONT_BORROW, with distinct ranges and strong rate', () => {
    const result = assessBorrower(DEMO_PRIYA)
    expect(result.borrowDecision.recommendation).not.toBe('DONT_BORROW')
    expect(['BORROW', 'BORROW_LESS']).toContain(
      result.borrowDecision.recommendation,
    )
    expect(result.product.product).toBe('PERSONAL')

    const lenderHigh = result.capacity.likelySanction.high
    const safeHigh = result.capacity.safeCarry.high
    expect(lenderHigh).not.toBeNull()
    expect(safeHigh).not.toBeNull()
    expect(
      result.capacity.likelySanction.low !== result.capacity.safeCarry.low ||
        lenderHigh !== safeHigh,
    ).toBe(true)

    expect(result.fairRate.expected).not.toBeNull()
    expect(result.fairRate.expected!).toBeLessThan(13.5)
    expect(result.fairRate.low!).toBeLessThan(12)
    expect(result.affordability.safeNewEmi!).toBeGreaterThan(20_000)
  })

  it('Ravi routes toward secured business and does not make 15L magically safe', () => {
    const result = assessBorrower(DEMO_RAVI)
    expect(result.product.product).toBe('SECURED_BUSINESS')
    expect(result.borrowDecision.recommendation).not.toBe('BORROW')
    expect(['BORROW_LESS', 'DONT_BORROW']).toContain(
      result.borrowDecision.recommendation,
    )

    const safeHigh = result.safeAmount.safeAmountRange.high
    expect(safeHigh).not.toBeNull()
    expect(safeHigh!).toBeLessThan(15_00_000)

    const lenderHigh = result.lenderAmount.estimatedLenderAmountRange.high
    expect(lenderHigh).not.toBeNull()
    expect(lenderHigh!).toBeGreaterThan(safeHigh!)

    expect(['low', 'medium']).toContain(result.overallConfidence)
    expect(result.confidenceReason.toLowerCase()).toMatch(
      /credit|thin|variable|missing|unavailable|uncertain/,
    )
  })

  it('Anita is DONT_BORROW with near-zero safe EMI', () => {
    const result = assessBorrower(DEMO_ANITA)
    expect(result.borrowDecision.recommendation).toBe('DONT_BORROW')
    expect(result.affordability.safeNewEmi).not.toBeNull()
    expect(result.affordability.safeNewEmi!).toBeLessThanOrEqual(500)
    expect(result.product.product).toBe('VEHICLE')
    expect(result.borrowDecision.explanation.text.toLowerCase()).toMatch(
      /bounce|stress|fragile|unsafe|don't|do not/,
    )
  })
})

describe('domain safety invariants', () => {
  it('unknown credit widens rate band and lowers confidence without assigning a bad score', () => {
    const base: BorrowerProfile = {
      ...DEMO_PRIYA,
      creditScore: null,
      creditScoreBand: null,
      hasFormalCreditHistory: null,
    }
    const known = assessBorrower(DEMO_PRIYA)
    const unknown = assessBorrower(base)
    expect(unknown.fairRate.high! - unknown.fairRate.low!).toBeGreaterThan(
      known.fairRate.high! - known.fairRate.low!,
    )
    expect(['low', 'medium']).toContain(unknown.fairRate.confidence)
    expect(unknown.fairRate.reasons.join(' ').toLowerCase()).toMatch(
      /unavailable|widened|not assumed bad/,
    )
  })

  it('negative disposable income stresses affordability', () => {
    const profile: BorrowerProfile = {
      ...emptyProfile(),
      monthlyIncome: 40_000,
      existingEmi: 20_000,
      monthlyExpenses: 25_000,
      employmentType: 'salaried',
      incomeStability: 'stable',
      requestedAmount: 2_00_000,
      loanPurpose: 'consumption',
      recentBouncedEmi: false,
    }
    const aff = calculateAffordability(profile)
    expect(aff.disposableCashFlow!).toBeLessThan(0)
    expect(aff.safeNewEmi!).toBe(0)
    expect(aff.isDistressed).toBe(true)
  })

  it('recent bounced EMI worsens rate and decision path', () => {
    const clean = assessBorrower({ ...DEMO_PRIYA, recentBouncedEmi: false })
    const bounced = assessBorrower({ ...DEMO_PRIYA, recentBouncedEmi: true })
    expect(bounced.fairRate.high!).toBeGreaterThan(clean.fairRate.high!)
    expect(bounced.affordability.applicableFoir!).toBeLessThanOrEqual(
      clean.affordability.applicableFoir!,
    )
  })

  it('requested amount above safe amount yields BORROW_LESS when capacity exists', () => {
    const result = assessBorrower({
      ...DEMO_PRIYA,
      requestedAmount: 50_00_000,
    })
    expect(result.borrowDecision.recommendation).toBe('BORROW_LESS')
  })

  it('collateral without affordability does not create a safe 15L personal loan', () => {
    const profile: BorrowerProfile = {
      ...emptyProfile(),
      monthlyIncome: 30_000,
      existingEmi: 0,
      monthlyExpenses: 22_000,
      employmentType: 'self_employed',
      incomeStability: 'moderate',
      hasCollateral: true,
      collateralValue: 45_00_000,
      requestedAmount: 15_00_000,
      loanPurpose: 'business_expansion',
      desiredTenureMonths: 60,
      hasFormalCreditHistory: false,
      recentBouncedEmi: false,
    }
    const result = assessBorrower(profile)
    expect(result.product.product).toBe('SECURED_BUSINESS')
    expect(result.safeAmount.safeAmountRange.high!).toBeLessThan(15_00_000)
    expect(result.borrowDecision.recommendation).not.toBe('BORROW')
  })

  it('lower confidence widens numeric ranges', () => {
    const tight = widenRange(100, 200, 'high')
    const wide = widenRange(100, 200, 'low')
    expect(wide.high! - wide.low!).toBeGreaterThan(tight.high! - tight.low!)
  })

  it('determineProduct maps wedding to PERSONAL', () => {
    const product = determineProduct({
      ...emptyProfile(),
      loanPurpose: 'wedding',
      requestedAmount: 8_00_000,
    })
    expect(product.product).toBe('PERSONAL')
  })

  it('calculateRate stays within absolute clamps', () => {
    const aff = calculateAffordability(DEMO_ANITA)
    const rate = calculateRate(DEMO_ANITA, 'VEHICLE', aff)
    expect(rate.low!).toBeGreaterThanOrEqual(7.5)
    expect(rate.high!).toBeLessThanOrEqual(36)
  })
})
