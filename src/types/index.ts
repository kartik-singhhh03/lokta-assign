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
  /** Optional labelled explanation block for UI cards */
  label?: string
  /** Longer borrower-facing prose */
  text?: string
}

/** A closed numeric range with optional midpoint / recommended point. */
export interface NumericRange {
  low: MaybeNumber
  high: MaybeNumber
  midpoint?: MaybeNumber
  recommended?: MaybeNumber
}

/** Interest-rate / APR band with confidence and rationale. */
export interface RateRange {
  /** Nominal annual rate band, percent (e.g. 12.5 = 12.5%) */
  nominalAnnualPercent: NumericRange
  /** All-in APR band including fees, percent */
  allInAprPercent: NumericRange
  /** Point estimate within the nominal band */
  expectedNominalPercent?: MaybeNumber
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

export type EmploymentType =
  | 'salaried'
  | 'self_employed'
  | 'business'
  | 'gig'
  | 'informal'
  | 'other'

export type IncomeStability = 'stable' | 'moderate' | 'variable'

export type CreditScoreBand =
  | 'below_650'
  | '650_699'
  | '700_749'
  | '750_799'
  | '800_plus'
  | 'unknown'

export type CityTier = 'tier1' | 'tier2' | 'tier3' | 'other'

export type ProductType =
  | 'PERSONAL'
  | 'BUSINESS'
  | 'SECURED_BUSINESS'
  | 'VEHICLE'
  | 'HOME'
  | 'OTHER'

/** Final borrow decision codes — exactly one. */
export type BorrowRecommendation = 'BORROW' | 'BORROW_LESS' | 'DONT_BORROW'

/**
 * Structured borrower inputs collected during assessment.
 * Fields are optional / nullable so partial profiles remain valid.
 */
export interface BorrowerProfile {
  /** Display / demo name */
  name: string | null
  age: MaybeNumber
  city: string | null
  cityTier: CityTier | null

  /** Monthly take-home / cash income in INR (point estimate when known) */
  monthlyIncome: MaybeNumber
  /** Optional income band for variable earners */
  monthlyIncomeLow: MaybeNumber
  monthlyIncomeHigh: MaybeNumber
  /** Documented annual income (e.g. ITR), INR */
  documentedAnnualIncome: MaybeNumber
  /** Spouse / co-earner monthly income, INR (informational until co-applicant). */
  spouseMonthlyIncome: MaybeNumber
  /**
   * Only when true is spouse income counted in repayment capacity.
   * null = unanswered; false = known but not a co-applicant.
   */
  spouseIsCoApplicant: boolean | null

  employmentType: EmploymentType | null
  incomeStability: IncomeStability | null
  /** Years in current employment / business */
  employmentYears: MaybeNumber
  employerDescription: string | null

  /** Existing EMI / debt obligations per month in INR */
  existingEmi: MaybeNumber
  /** Outstanding unsecured / app-loan debt stock, INR */
  outstandingUnsecuredDebt: MaybeNumber
  /** Stated that existing debt is high-cost (e.g. 30%+ app loans) */
  hasHighCostDebt: boolean | null
  /** Monthly essential living expenses in INR (rent, food, utilities, school) */
  monthlyExpenses: MaybeNumber
  dependents: MaybeNumber
  /** Recent missed / bounced EMI */
  recentBouncedEmi: boolean | null
  /** Spouse currently unemployed / not earning */
  spouseUnemployed: boolean | null

  creditScoreBand: CreditScoreBand | null
  /** Exact score when known — never invent */
  creditScore: MaybeNumber
  /** false = thin file / no formal bureau history */
  hasFormalCreditHistory: boolean | null

  hasCollateral: boolean | null
  collateralValue: MaybeNumber
  collateralDescription: string | null

  requestedAmount: MaybeNumber
  desiredTenureMonths: MaybeNumber
  loanPurpose: string | null

  /** Any known processing fee % quoted by a lender */
  quotedProcessingFeePercent: MaybeNumber
}

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

/** Sanction vs safe-carry comparison. */
export interface CapacityAssessment {
  /** Amount a typical lender may sanction given the profile */
  likelySanction: NumericRange
  /** Amount the borrower can safely service without strain */
  safeCarry: NumericRange
  /** Recommended amount within safe carry */
  recommendedAmount: MaybeNumber
  /** Overlap / gap between sanction mid and safe mid */
  gap: MaybeNumber
  confidence: ConfidenceLevel
  explanation: Explanation
}

/** Recommended EMI band the borrower should agree to. */
export interface EmiGuidance {
  recommendedEmi: NumericRange
  /** Hard ceiling for new EMI from affordability */
  safeNewEmiCeiling: MaybeNumber
  suggestedTenureMonths: MaybeNumber
  /** Share of disposable income this EMI would consume, if known */
  emiToIncomeRatio: MaybeNumber
  confidence: ConfidenceLevel
  explanation: Explanation
  /** Tenure trade-off scenarios for UI */
  tenureTradeoffs: Array<{
    tenureMonths: number
    emi: MaybeNumber
    totalInterest: MaybeNumber
  }>
}

export interface ProductRoutingResult {
  product: ProductType
  alternateProducts: ProductType[]
  confidence: ConfidenceLevel
  explanation: Explanation
}

/** Expandable “Why this number?” breakdown for the UI. */
export interface NumberBreakdown {
  title: string
  /** Short one-sentence borrower-facing explanation */
  oneLiner: string
  inputsUsed: string[]
  steps: string[]
  ruleUsed: string
  assumptions: string[]
}

export interface AffordabilityResult {
  applicableFoir: MaybeNumber
  foirLabel: string | null
  safeTotalEmi: MaybeNumber
  safeNewEmi: MaybeNumber
  disposableCashFlow: MaybeNumber
  cashFlowConstrainedEmi: MaybeNumber
  foirBasedNewEmi: MaybeNumber
  /** Income figure actually used for affordability */
  incomeUsed: MaybeNumber
  incomeSource: string | null
  /** Whether spouse income was included */
  spouseIncomeIncluded: boolean
  /** Expenses figure used (may be assumed) */
  expensesUsed: MaybeNumber
  expensesWereAssumed: boolean
  /** Existing EMI used; null when unknown and not invented */
  existingEmiUsed: MaybeNumber
  existingEmiWasUnknown: boolean
  status: 'healthy' | 'stretched' | 'stressed' | 'unknown'
  isDistressed: boolean
  confidence: ConfidenceLevel
  explanation: Explanation
  breakdown: NumberBreakdown
}

export interface FairRateResult {
  low: MaybeNumber
  high: MaybeNumber
  expected: MaybeNumber
  confidence: ConfidenceLevel
  reasons: string[]
  explanation: Explanation
  breakdown: NumberBreakdown
  /** True when band is widened due to missing bureau / thin file */
  indicativeOnly: boolean
}

export interface AprResult {
  headlineRate: MaybeNumber
  processingFeePercent: MaybeNumber
  processingFeeAmount: MaybeNumber
  netDisbursal: MaybeNumber
  totalRepayment: MaybeNumber
  apr: MaybeNumber
  /** Documents whether exact IRR or approximation was used */
  methodNote: string
  explanation: Explanation
  breakdown: NumberBreakdown
}

export interface LenderAmountResult {
  estimatedLenderAmountRange: NumericRange
  confidence: ConfidenceLevel
  explanation: Explanation
  breakdown: NumberBreakdown
}

export interface SafeAmountResult {
  /** Borrower-facing comfortable / safe range (not the mathematical max) */
  safeAmountRange: NumericRange
  /** Mathematical maximum principal at longest product tenure + best rate in band */
  mathematicalMaximum: MaybeNumber
  recommendedAmount: MaybeNumber
  confidence: ConfidenceLevel
  explanation: Explanation
  breakdown: NumberBreakdown
}

export type StressStatus = 'comfortable' | 'tight' | 'stressed' | 'unknown'

export interface StressTestResult {
  scenarioLabel: string
  baseIncome: MaybeNumber
  stressedIncome: MaybeNumber
  baseRate: MaybeNumber
  stressedRate: MaybeNumber
  baseEmi: MaybeNumber
  stressedEmi: MaybeNumber
  baseBuffer: MaybeNumber
  stressedBuffer: MaybeNumber
  stillWithinSafeCeiling: boolean | null
  status: StressStatus
  explanation: Explanation
}

export interface BorrowDecision {
  recommendation: BorrowRecommendation
  confidence: ConfidenceLevel
  explanation: Explanation
  /** Key positive factors surfaced to the borrower */
  positiveFactors: string[]
  /** Key risk factors surfaced to the borrower */
  riskFactors: string[]
  /** Constructive next steps (especially for DONT_BORROW) */
  nextSteps: string[]
}

/**
 * Talking points and anchors for negotiating with a lender.
 * Produced only after assessment; never invents numbers.
 */
export interface NegotiationCard {
  decision: BorrowRecommendation
  product: ProductType
  purpose: string | null
  requestedAmount: MaybeNumber
  recommendedAmount: MaybeNumber
  safeAmountRange: NumericRange
  estimatedLenderAmountRange: NumericRange
  fairRateRange: NumericRange
  expectedRate: MaybeNumber
  apr: MaybeNumber
  processingFeePercent: MaybeNumber
  processingFeeAmount: MaybeNumber
  emiCeiling: MaybeNumber
  suggestedTenureMonths: MaybeNumber
  /** Negotiate at or below this rate; null when DONT_BORROW */
  negotiationTargetRate: MaybeNumber
  reasons: string[]
  questionsToAskLender: string[]
  confidence: ConfidenceLevel
  confidenceReason: string
  rateIndicativeOnly: boolean
  /** Fair rate band the borrower can cite (compat) */
  fairRateBand: RateRange
  maxAcceptableEmi: MaybeNumber
  maxAcceptablePrincipal: MaybeNumber
  talkingPoints: string[]
  watchouts: string[]
  nextSteps: string[]
  explanation: Explanation
}

/** Full deterministic assessment output. */
export interface AssessmentResult {
  profile: BorrowerProfile
  product: ProductRoutingResult
  affordability: AffordabilityResult
  fairRate: FairRateResult
  apr: AprResult
  lenderAmount: LenderAmountResult
  safeAmount: SafeAmountResult
  stress: StressTestResult
  borrowDecision: BorrowDecision
  capacity: CapacityAssessment
  rateGuidance: RateRange
  emiGuidance: EmiGuidance
  scenarios: LoanScenario[]
  negotiation: NegotiationCard
  overallConfidence: ConfidenceLevel
  confidenceReason: string
  unknownFields: (keyof BorrowerProfile)[]
  missingInputsForPrecision: string[]
  whatWeDontKnow: string[]
  reasons: string[]
  oneLiners: {
    decision: string
    safeEmi: string
    safeAmount: string
    rate: string
    apr: string
    lenderVsSafe: string
  }
  disclaimer: string
  assessedAt: string
}

/** App navigation / flow stages. */
export type AppScreen = 'landing' | 'assessment' | 'results'
