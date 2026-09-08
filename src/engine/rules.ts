/**
 * Central rules configuration for Borrower Copilot.
 *
 * IMPORTANT: These are Lokta PRODUCT JUDGEMENT assumptions for a borrower
 * self-assessment — NOT RBI-mandated FOIR limits, NOT exact market quotes,
 * and NOT lender underwriting policy. Change values here during interviews.
 */

import type { ProductType } from '../types'

/** Affordability FOIR ceilings by profile bucket (product judgement). */
export const AFFORDABILITY_RULES = {
  /** Stable salaried safe FOIR */
  stableSalariedFoir: 0.4,
  /** Documented self-employed / business safe FOIR */
  selfEmployedFoir: 0.35,
  /** Variable / informal / gig safe FOIR */
  variableInformalFoir: 0.3,
  /** Financially stressed safe FOIR (bounces, severe burden, fragile income) */
  financiallyStressedFoir: 0.25,

  /**
   * After income − expenses − existing EMI, only this share of residual
   * cash flow may be committed to a new EMI (conservative guardrail).
   */
  disposableCashFlowShare: 0.5,

  /** Absolute minimum residual buffer the household should retain (₹ / month). */
  minimumHouseholdBuffer: 5_000,

  /** Existing EMI / income ratio above which we treat the borrower as stressed. */
  stressedExistingBurdenRatio: 0.45,

  /** Safe new EMI at or below this is treated as effectively zero. */
  nearZeroEmiThreshold: 500,

  /** Requested amount may exceed safe high by this fraction before BORROW_LESS. */
  borrowLessTolerance: 0.05,
} as const

/**
 * Illustrative rate bands by product × profile (annual % points).
 * Labelled as judgement assumptions — not live lender quotes.
 */
export const RATE_BANDS = {
  personal: {
    excellentSalaried: { low: 10.5, high: 13.0 },
    goodSalaried: { low: 11.5, high: 14.0 },
    fairSalaried: { low: 13.0, high: 16.0 },
    selfEmployedDocumented: { low: 12.0, high: 16.0 },
    thinOrNoBureau: { low: 14.0, high: 20.0 },
    distressed: { low: 18.0, high: 28.0 },
  },
  business: {
    documented: { low: 13.0, high: 18.0 },
    thinOrNoBureau: { low: 15.0, high: 22.0 },
    distressed: { low: 18.0, high: 28.0 },
  },
  securedBusiness: {
    strong: { low: 9.5, high: 12.5 },
    standard: { low: 10.5, high: 14.0 },
    thinOrNoBureau: { low: 11.5, high: 16.0 },
    distressed: { low: 14.0, high: 20.0 },
  },
  vehicle: {
    strong: { low: 9.0, high: 12.0 },
    standard: { low: 10.5, high: 14.5 },
    thinOrNoBureau: { low: 12.0, high: 18.0 },
    distressed: { low: 16.0, high: 24.0 },
  },
  home: {
    strong: { low: 8.5, high: 10.5 },
    standard: { low: 9.0, high: 11.5 },
    thinOrNoBureau: { low: 10.0, high: 13.0 },
  },
  other: {
    standard: { low: 12.0, high: 18.0 },
    thinOrNoBureau: { low: 14.0, high: 22.0 },
    distressed: { low: 18.0, high: 28.0 },
  },
} as const

/** Absolute clamps so adjustments cannot create absurd rates. */
export const RATE_LIMITS = {
  absoluteFloor: 7.5,
  absoluteCeiling: 36.0,
} as const

/**
 * Additive / multiplicative rate adjustments (percentage points unless noted).
 * Kept here so interview tweaks do not require hunting through modules.
 */
export const RATE_ADJUSTMENTS = {
  credit: {
    score_800_plus: -0.75,
    score_750_799: -0.5,
    score_700_749: 0,
    score_650_699: 1.25,
    score_below_650: 3.0,
    /** Unknown score: widen band rather than assign a low score */
    unknownWidenLow: -1.0,
    unknownWidenHigh: 2.5,
  },
  income: {
    stableSalaried: -0.5,
    documentedSelfEmployed: 0.25,
    variableInformal: 1.5,
  },
  history: {
    years5Plus: -0.35,
    years2to5: 0,
    yearsUnder2: 0.75,
    unknownWiden: 0.75,
  },
  repayment: {
    recentBounceWidenLow: 1.5,
    recentBounceWidenHigh: 4.0,
  },
  /** Extra half-width applied when confidence is medium / low */
  confidenceWiden: {
    high: 0,
    medium: 0.75,
    low: 1.75,
  },
} as const

/** Illustrative processing fee assumption (not an actual lender quote). */
export const FEE_RULES = {
  illustrativeProcessingFeePercent: 2,
  feeDisclaimer:
    'Processing fee is an illustrative assumption for APR education — not a quoted lender fee.',
} as const

/** Stress-test assumptions. */
export const STRESS_RULES = {
  incomeStressPercent: 0.15,
  rateStressPercentagePoints: 2,
} as const

/** Sensible tenure options (months) by product. */
export const TENURE_OPTIONS: Record<ProductType, readonly number[]> = {
  PERSONAL: [12, 24, 36, 48, 60],
  BUSINESS: [12, 24, 36, 48, 60],
  SECURED_BUSINESS: [24, 36, 48, 60, 84, 120],
  VEHICLE: [12, 24, 36, 48, 60, 72],
  HOME: [60, 120, 180, 240],
  OTHER: [12, 24, 36, 48, 60],
} as const

/** Default suggested tenure when borrower does not specify one. */
export const DEFAULT_TENURE_MONTHS: Record<ProductType, number> = {
  PERSONAL: 36,
  BUSINESS: 36,
  SECURED_BUSINESS: 60,
  VEHICLE: 48,
  HOME: 180,
  OTHER: 36,
}

/**
 * Lender-amount (estimated sanction) heuristics — illustrative only.
 * Multipliers apply to annualised income capacity; separately from safe amount.
 */
export const LENDER_AMOUNT_RULES = {
  /** Months of income used as a crude unsecured sanction proxy */
  unsecuredIncomeMonths: {
    excellent: 18,
    good: 14,
    fair: 10,
    thin: 6,
    distressed: 3,
  },
  /** Secured products may use a conservative fraction of collateral value */
  securedCollateralLtv: 0.5,
  /** Blend weight when both income capacity and collateral inform the range */
  securedIncomeWeight: 0.55,
  securedCollateralWeight: 0.45,
  /** Range half-width factors by confidence */
  rangeWidth: {
    high: 0.12,
    medium: 0.2,
    low: 0.32,
  },
  /**
   * Lender FOIR used only for estimated sanction (often looser than our
   * borrower-safe FOIR). Still a judgement assumption.
   */
  lenderFoirPremium: 0.05,
} as const

/** Safe-amount range construction around the EMI-supported principal. */
export const SAFE_AMOUNT_RULES = {
  /** Lower / upper band around the primary supported principal */
  lowFactor: 0.85,
  highFactor: 1.05,
  /** Recommended amount sits at this fraction of the safe high (capped). */
  recommendedFactorOfHigh: 0.92,
  /** Also never recommend above this fraction of the mid-point. */
  recommendedFactorOfMid: 1.0,
} as const

/** Meaningful collateral threshold (₹) before suggesting secured routes. */
export const COLLATERAL_RULES = {
  meaningfulCollateralInr: 10_00_000,
} as const

/** Purpose → product routing hints. */
export const PURPOSE_PRODUCT_MAP: Record<string, ProductType> = {
  wedding: 'PERSONAL',
  consumption: 'PERSONAL',
  medical: 'PERSONAL',
  education: 'PERSONAL',
  home_improvement: 'HOME',
  home: 'HOME',
  debt_consolidation: 'PERSONAL',
  business: 'BUSINESS',
  business_expansion: 'BUSINESS',
  inventory: 'BUSINESS',
  productive_asset: 'BUSINESS',
  vehicle: 'VEHICLE',
  scooter: 'VEHICLE',
  other: 'OTHER',
}

export const LENDER_QUESTIONS = {
  common: [
    'What is the APR, not just the headline interest rate?',
    'What processing and other fees are included?',
    'Is the rate fixed or floating?',
    'What is my total repayment over the full tenure?',
    'Are there foreclosure/prepayment charges?',
    'Can you offer a lower rate based on my profile?',
  ],
  secured: [
    'What loan-to-value will you apply against my collateral?',
    'What happens to the collateral if I prepay early?',
  ],
  vehicle: [
    'Is the vehicle hypothecated for the full tenure?',
    'Does the quote include insurance and other add-on charges?',
  ],
} as const

/** Must-know fields for confidence scoring. */
export const CONFIDENCE_FIELDS = {
  mustAnswer: [
    'monthlyIncome',
    'requestedAmount',
    'loanPurpose',
  ] as const,
  important: [
    'existingEmi',
    'monthlyExpenses',
    'employmentType',
    'incomeStability',
    'creditScoreBand',
    'desiredTenureMonths',
    'recentBouncedEmi',
    'hasFormalCreditHistory',
  ] as const,
}

export const RULES_META = {
  version: '1.0.0',
  nature:
    'Illustrative Lokta product-judgement assumptions for borrower self-assessment. Not underwriting, not RBI limits, not live market quotes.',
} as const
