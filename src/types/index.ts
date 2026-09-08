/**
 * Core domain types for Borrower Copilot.
 * Unknown values stay unknown — never coerce missing data to zero.
 */

/** A numeric value that may be genuinely unknown. */
export type MaybeNumber = number | null

/** Discrete confidence band for an estimate or recommendation. */
export type ConfidenceLevel = 'low' | 'medium' | 'high'

/** Why a particular figure or recommendation was produced. */
export interface Explanation {
  /** Short, borrower-facing summary */
  summary: string
  /** Ordered contributing factors */
  factors: string[]
  /** Inputs that were missing and widened uncertainty */
  missingInputs?: string[]
}

/** A closed numeric range with optional midpoint. */
export interface NumericRange {
  low: MaybeNumber
  high: MaybeNumber
  midpoint?: MaybeNumber
}

/** Interest-rate / APR band with confidence and rationale. */
export interface RateRange {
  /** Nominal annual rate band, percent (e.g. 12.5 = 12.5%) */
  nominalAnnualPercent: NumericRange
  /** All-in APR band including fees, percent */
  allInAprPercent: NumericRange
  confidence: ConfidenceLevel
  explanation: Explanation
}

/** A single loan offer scenario the borrower may consider. */
export interface LoanScenario {
  id: string
  label: string
  principal: MaybeNumber
  tenureMonths: MaybeNumber
  /** EMI the borrower would pay under this scenario */
  emi: MaybeNumber
  rate: RateRange
  /** Total interest over the tenure, if computable */
  totalInterest: MaybeNumber
  /** Total amount payable (principal + interest + known fees) */
  totalPayable: MaybeNumber
  explanation: Explanation
}

/**
 * Structured borrower inputs collected during assessment.
 * Fields are optional / nullable so partial profiles remain valid.
 */
export interface BorrowerProfile {
  /** Monthly take-home income in INR */
  monthlyIncome: MaybeNumber
  /** Existing EMI / debt obligations per month in INR */
  existingEmi: MaybeNumber
  /** Monthly essential living expenses in INR */
  monthlyExpenses: MaybeNumber
  /** Requested loan amount in INR */
  requestedAmount: MaybeNumber
  /** Desired tenure in months */
  desiredTenureMonths: MaybeNumber
  /** Stated purpose of borrowing */
  loanPurpose: string | null
  /** Employment type, if known */
  employmentType: EmploymentType | null
  /** Credit score band, if known — never invent a score */
  creditScoreBand: CreditScoreBand | null
  /** City tier / location proxy for rate context */
  cityTier: CityTier | null
  /** Whether the borrower has collateral / security */
  hasCollateral: boolean | null
  /** Any known processing fee % quoted by a lender */
  quotedProcessingFeePercent: MaybeNumber
}

export type EmploymentType =
  | 'salaried'
  | 'self_employed'
  | 'business'
  | 'gig'
  | 'other'

export type CreditScoreBand =
  | 'below_650'
  | '650_699'
  | '700_749'
  | '750_799'
  | '800_plus'
  | 'unknown'

export type CityTier = 'tier1' | 'tier2' | 'tier3' | 'other'

/** Question input control kinds for the assessment flow. */
export type QuestionInputType =
  | 'currency'
  | 'number'
  | 'single_choice'
  | 'boolean'
  | 'text'

export interface QuestionOption {
  value: string
  label: string
  description?: string
}

/** A single assessment question shown to the borrower. */
export interface Question {
  id: string
  /** Section used for progress grouping */
  section: string
  prompt: string
  helpText?: string
  inputType: QuestionInputType
  /** Maps this question onto a BorrowerProfile field */
  profileKey: keyof BorrowerProfile
  options?: QuestionOption[]
  /** Whether the borrower may skip without answering */
  optional: boolean
  /** Soft validation hints — engine still treats empty as unknown */
  min?: number
  max?: number
  unit?: string
}

/** A recorded answer; value is null when skipped / unknown. */
export interface Answer {
  questionId: string
  /** Raw captured value; null means explicitly unknown / skipped */
  value: string | number | boolean | null
  answeredAt: string
}

/** Should-I-borrow recommendation. */
export type BorrowRecommendation = 'borrow' | 'caution' | 'avoid' | 'insufficient_data'

export interface BorrowDecision {
  recommendation: BorrowRecommendation
  confidence: ConfidenceLevel
  explanation: Explanation
}

/** Sanction vs safe-carry comparison. */
export interface CapacityAssessment {
  /** Amount a typical lender may sanction given the profile */
  likelySanction: NumericRange
  /** Amount the borrower can safely service without strain */
  safeCarry: NumericRange
  /** Overlap / gap between sanction and safe-carry */
  gap: MaybeNumber
  confidence: ConfidenceLevel
  explanation: Explanation
}

/** Recommended EMI band the borrower should agree to. */
export interface EmiGuidance {
  recommendedEmi: NumericRange
  /** Share of disposable income this EMI would consume, if known */
  emiToIncomeRatio: MaybeNumber
  confidence: ConfidenceLevel
  explanation: Explanation
}

/**
 * Talking points and anchors for negotiating with a lender.
 * Produced only after assessment; never invents numbers.
 */
export interface NegotiationCard {
  /** Fair rate band the borrower can cite */
  fairRateBand: RateRange
  /** Maximum EMI the borrower should accept */
  maxAcceptableEmi: MaybeNumber
  /** Maximum principal they should take, even if sanctioned higher */
  maxAcceptablePrincipal: MaybeNumber
  /** Suggested counter-offers / talking points */
  talkingPoints: string[]
  /** Red flags to watch for in the offer */
  watchouts: string[]
  confidence: ConfidenceLevel
  explanation: Explanation
}

/** Full deterministic assessment output. */
export interface AssessmentResult {
  profile: BorrowerProfile
  borrowDecision: BorrowDecision
  capacity: CapacityAssessment
  rateGuidance: RateRange
  emiGuidance: EmiGuidance
  scenarios: LoanScenario[]
  negotiation: NegotiationCard
  /** Overall confidence after accounting for missing inputs */
  overallConfidence: ConfidenceLevel
  /** Inputs that remained unknown and widened ranges */
  unknownFields: (keyof BorrowerProfile)[]
  assessedAt: string
}

/** App navigation / flow stages. */
export type AppScreen = 'landing' | 'assessment' | 'results'
