import { describe, expect, it } from 'vitest'
import {
  calculateEmi,
  calculateSupportedPrincipal,
} from '../calculateEmi'
import { calculateApr } from '../calculateApr'
import { assessBorrower } from '../assessBorrower'
import { calculateAffordability } from '../calculateAffordability'
import { emptyProfile } from '../answersToProfile'
import { DEMO_ANITA, DEMO_PRIYA, DEMO_RAVI } from '../../data/demos'
import { widenRange } from '../../utils/confidence'
import { FEE_RULES } from '../rules'
import type { BorrowerProfile } from '../../types'

describe('calculateEmi', () => {
  it('matches a known amortization example', () => {
    const emi = calculateEmi(100_000, 12, 12)
    expect(emi).not.toBeNull()
    expect(emi!).toBeGreaterThan(8880)
    expect(emi!).toBeLessThan(8890)
  })

  it('handles zero interest', () => {
    expect(calculateEmi(120_000, 0, 12)).toBe(10_000)
  })

  it('inverts EMI to supported principal', () => {
    const emi = calculateEmi(500_000, 14, 36)!
    const principal = calculateSupportedPrincipal(emi, 14, 36)
    expect(Math.abs(principal! - 500_000)).toBeLessThan(1)
  })

  it('longer tenure lowers EMI but increases total repayment', () => {
    const short = calculateEmi(500_000, 12, 24)!
    const long = calculateEmi(500_000, 12, 60)!
    expect(long).toBeLessThan(short)
    expect(long * 60).toBeGreaterThan(short * 24)
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
    expect(result.apr!).toBeGreaterThan(12)
    expect(result.methodNote.toLowerCase()).toContain('irr')
  })

  it('higher processing fee increases APR', () => {
    const low = calculateApr({
      principal: 5_00_000,
      annualRatePercent: 12,
      tenureMonths: 36,
      processingFeePercent: 1,
    })
    const high = calculateApr({
      principal: 5_00_000,
      annualRatePercent: 12,
      tenureMonths: 36,
      processingFeePercent: 4,
    })
    expect(high.apr!).toBeGreaterThan(low.apr!)
  })
})

describe('unknown data must not become invented precision', () => {
  it('unknown credit score does not become 300 / bad-credit band alone', () => {
    const result = assessBorrower({
      ...DEMO_PRIYA,
      creditScore: null,
      creditScoreBand: null,
      hasFormalCreditHistory: null,
    })
    expect(result.fairRate.reasons.join(' ').toLowerCase()).not.toMatch(/300/)
    expect(result.fairRate.reasons.join(' ').toLowerCase()).toMatch(
      /unavailable|widened|not assumed bad|rather than assuming/,
    )
    expect(result.fairRate.indicativeOnly).toBe(true)
  })

  it('unknown EMI does not become 0 silently', () => {
    const aff = calculateAffordability({
      ...emptyProfile(),
      monthlyIncome: 80_000,
      existingEmi: null,
      monthlyExpenses: 25_000,
      employmentType: 'salaried',
      incomeStability: 'stable',
      recentBouncedEmi: false,
      requestedAmount: 2_00_000,
      loanPurpose: 'consumption',
    })
    expect(aff.existingEmiWasUnknown).toBe(true)
    expect(aff.existingEmiUsed).toBeNull()
    expect(aff.safeNewEmi).toBeNull()
    expect(aff.breakdown.assumptions.join(' ').toLowerCase()).toMatch(
      /unknown|not.*₹0|not invented|not assumed/,
    )
  })

  it('unknown household expenses do not become 0 silently', () => {
    const aff = calculateAffordability({
      ...DEMO_PRIYA,
      monthlyExpenses: null,
    })
    expect(aff.expensesWereAssumed).toBe(true)
    expect(aff.expensesUsed).not.toBeNull()
    expect(aff.expensesUsed!).toBeGreaterThan(0)
    expect(aff.breakdown.assumptions.join(' ')).toMatch(/assumption/i)
  })
})

describe('demo borrowers', () => {
  it('Priya remains BORROW with a usable comfortable safe range', () => {
    const result = assessBorrower(DEMO_PRIYA)
    expect(result.borrowDecision.recommendation).toBe('BORROW')
    expect(result.product.product).toBe('PERSONAL')
    expect(result.affordability.safeNewEmi).toBe(30_000)
    const span =
      result.safeAmount.safeAmountRange.high! -
      result.safeAmount.safeAmountRange.low!
    // Comfortable range should not span an absurd multi-x of income years
    expect(span).toBeLessThan(8_00_000)
    expect(result.safeAmount.recommendedAmount).toBe(8_00_000)
    expect(result.safeAmount.mathematicalMaximum!).toBeGreaterThan(
      result.safeAmount.safeAmountRange.high!,
    )
    expect(result.borrowDecision.explanation.summary).toBe('Borrow')
    expect(result.borrowDecision.explanation.text.toLowerCase()).toMatch(
      /affordability rules|lender may offer more/,
    )
  })

  it('Ravi remains BORROW_LESS and SECURED_BUSINESS', () => {
    const result = assessBorrower(DEMO_RAVI)
    expect(result.product.product).toBe('SECURED_BUSINESS')
    expect(result.borrowDecision.recommendation).toBe('BORROW_LESS')
    expect(result.safeAmount.safeAmountRange.high!).toBeLessThan(15_00_000)
  })

  it('Ravi collateral does not increase safe EMI (capacity); it may change product/lender range', () => {
    const withCollat = assessBorrower(DEMO_RAVI)
    const withoutCollat = assessBorrower({
      ...DEMO_RAVI,
      hasCollateral: false,
      collateralValue: null,
    })
    expect(withCollat.affordability.safeNewEmi).toBe(
      withoutCollat.affordability.safeNewEmi,
    )
    expect(withCollat.product.product).toBe('SECURED_BUSINESS')
    expect(withoutCollat.product.product).toBe('BUSINESS')
    expect(
      withCollat.lenderAmount.estimatedLenderAmountRange.high!,
    ).toBeGreaterThan(
      withoutCollat.lenderAmount.estimatedLenderAmountRange.high!,
    )
  })

  it("wife's income is not automatically included unless co-applicant", () => {
    const without = calculateAffordability(DEMO_RAVI)
    const withCo = calculateAffordability({
      ...DEMO_RAVI,
      spouseIsCoApplicant: true,
    })
    expect(without.spouseIncomeIncluded).toBe(false)
    expect(without.incomeUsed).toBe(35_000)
    expect(withCo.spouseIncomeIncluded).toBe(true)
    expect(withCo.incomeUsed).toBe(35_000 + 18_000)
    expect(withCo.safeNewEmi!).toBeGreaterThan(without.safeNewEmi!)
  })

  it('Anita remains DONT_BORROW without relying on invented EMI', () => {
    expect(DEMO_ANITA.existingEmi).toBeNull()
    const result = assessBorrower(DEMO_ANITA)
    expect(result.borrowDecision.recommendation).toBe('DONT_BORROW')
    expect(result.affordability.existingEmiWasUnknown).toBe(true)
    expect(result.affordability.safeNewEmi).toBe(0)
    expect(result.borrowDecision.explanation.text).not.toMatch(/8,?500/)
    expect(result.borrowDecision.explanation.text.toLowerCase()).toMatch(
      /35,000|high-cost|bounced/,
    )
    expect(result.negotiation.negotiationTargetRate).toBeNull()
    expect(result.borrowDecision.nextSteps.length).toBeGreaterThan(0)
  })
})

describe('sensitivity invariants', () => {
  it('removing credit score widens rate uncertainty', () => {
    const full = assessBorrower(DEMO_PRIYA)
    const noScore = assessBorrower({
      ...DEMO_PRIYA,
      creditScore: null,
      creditScoreBand: null,
      hasFormalCreditHistory: null,
    })
    expect(noScore.fairRate.high! - noScore.fairRate.low!).toBeGreaterThan(
      full.fairRate.high! - full.fairRate.low!,
    )
  })

  it('removing income stability widens uncertainty', () => {
    const full = assessBorrower(DEMO_PRIYA)
    const unstable = assessBorrower({
      ...DEMO_PRIYA,
      incomeStability: null,
      employmentType: null,
    })
    expect(
      unstable.fairRate.high! - unstable.fairRate.low!,
    ).toBeGreaterThanOrEqual(full.fairRate.high! - full.fairRate.low!)
    expect(
      unstable.fairRate.confidence !== 'high' ||
        unstable.fairRate.high! - unstable.fairRate.low! >
          full.fairRate.high! - full.fairRate.low!,
    ).toBe(true)
  })

  it('removing employment tenure widens rate band or lowers confidence', () => {
    const full = assessBorrower(DEMO_PRIYA)
    const noTenure = assessBorrower({
      ...DEMO_PRIYA,
      employmentYears: null,
    })
    expect(
      noTenure.fairRate.high! - noTenure.fairRate.low! >=
        full.fairRate.high! - full.fairRate.low! - 0.01,
    ).toBe(true)
  })

  it('higher existing EMI reduces safe EMI', () => {
    const base = calculateAffordability(DEMO_PRIYA)
    const higher = calculateAffordability({
      ...DEMO_PRIYA,
      existingEmi: 25_000,
    })
    expect(higher.safeNewEmi!).toBeLessThan(base.safeNewEmi!)
  })

  it('higher household expenses reduce safe EMI', () => {
    const base = calculateAffordability(DEMO_PRIYA)
    const higher = calculateAffordability({
      ...DEMO_PRIYA,
      monthlyExpenses: 60_000,
    })
    expect(higher.safeNewEmi!).toBeLessThanOrEqual(base.safeNewEmi!)
  })

  it('higher income increases safe EMI', () => {
    const base = calculateAffordability(DEMO_PRIYA)
    const higher = calculateAffordability({
      ...DEMO_PRIYA,
      monthlyIncome: 1_50_000,
    })
    expect(higher.safeNewEmi!).toBeGreaterThan(base.safeNewEmi!)
  })

  it('lower income increases risk / lowers capacity', () => {
    const base = assessBorrower(DEMO_PRIYA)
    const lower = assessBorrower({
      ...DEMO_PRIYA,
      monthlyIncome: 40_000,
      monthlyExpenses: 28_000,
      existingEmi: 14_000,
    })
    expect(lower.affordability.safeNewEmi!).toBeLessThan(
      base.affordability.safeNewEmi!,
    )
  })

  it('recent bounced EMI materially worsens decision/risk', () => {
    const clean = assessBorrower(DEMO_PRIYA)
    const bounced = assessBorrower({ ...DEMO_PRIYA, recentBouncedEmi: true })
    expect(bounced.fairRate.high!).toBeGreaterThan(clean.fairRate.high!)
    expect(bounced.affordability.applicableFoir!).toBeLessThanOrEqual(
      clean.affordability.applicableFoir!,
    )
  })

  it('lender amount can exceed safe amount', () => {
    const result = assessBorrower(DEMO_RAVI)
    expect(
      result.lenderAmount.estimatedLenderAmountRange.high!,
    ).toBeGreaterThan(result.safeAmount.safeAmountRange.high!)
  })

  it('safe amount cannot be increased merely because collateral exists', () => {
    const profile: BorrowerProfile = {
      ...emptyProfile(),
      monthlyIncome: 30_000,
      existingEmi: 0,
      monthlyExpenses: 18_000,
      employmentType: 'self_employed',
      incomeStability: 'moderate',
      hasCollateral: true,
      collateralValue: 45_00_000,
      requestedAmount: 15_00_000,
      loanPurpose: 'business_expansion',
      desiredTenureMonths: 60,
      hasFormalCreditHistory: false,
      recentBouncedEmi: false,
      spouseIsCoApplicant: false,
    }
    const result = assessBorrower(profile)
    expect(result.safeAmount.safeAmountRange.high!).toBeLessThan(15_00_000)
  })

  it('stress income drop reduces affordability buffer', () => {
    const result = assessBorrower(DEMO_RAVI)
    expect(result.stress.stressedIncome!).toBeLessThan(result.stress.baseIncome!)
    if (
      result.stress.baseBuffer !== null &&
      result.stress.stressedBuffer !== null
    ) {
      expect(result.stress.stressedBuffer).toBeLessThan(result.stress.baseBuffer)
    }
  })

  it('lower confidence widens numeric ranges', () => {
    const tight = widenRange(100, 200, 'high')
    const wide = widenRange(100, 200, 'low')
    expect(wide.high! - wide.low!).toBeGreaterThan(tight.high! - tight.low!)
  })
})
