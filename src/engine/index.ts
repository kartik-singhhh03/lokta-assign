import type { AssessmentResult, BorrowerProfile } from '../types'
import { assessBorrower } from './assessBorrower'

export { assessBorrower, isEngineReady } from './assessBorrower'
export { answersToProfile, emptyProfile } from './answersToProfile'
export { calculateEmi, calculateSupportedPrincipal } from './calculateEmi'
export { calculateApr } from './calculateApr'
export { calculateAffordability } from './calculateAffordability'
export { determineProduct } from './determineProduct'
export { calculateLenderAmount } from './calculateLenderAmount'
export { calculateLoanAmount } from './calculateLoanAmount'
export { calculateRate } from './calculateRate'
export { calculateStress } from './calculateStress'
export { evaluateBorrower } from './evaluateBorrower'
export { RULES_META } from './rules'

/** Alias kept for earlier shell wiring. */
export function runAssessment(profile: BorrowerProfile): AssessmentResult {
  return assessBorrower(profile)
}
