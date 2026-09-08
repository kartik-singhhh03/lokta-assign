import type {
  Answer,
  AssessmentResult,
  BorrowerProfile,
  Question,
} from '../types'

/**
 * Assessment engine entry points.
 * Rules live here — UI must not embed calculation logic.
 *
 * Implementations are intentionally stubs until the rule engine is built.
 * Callers should treat null / empty results as "not yet computed".
 */

export class EngineNotImplementedError extends Error {
  constructor(method: string) {
    super(
      `Assessment engine method "${method}" is not implemented yet. Rules are separated from UI and will be added next.`,
    )
    this.name = 'EngineNotImplementedError'
  }
}

/** Build a partial BorrowerProfile from answered questions. Unknown stays null. */
export function answersToProfile(
  _questions: Question[],
  _answers: Answer[],
): BorrowerProfile {
  throw new EngineNotImplementedError('answersToProfile')
}

/**
 * Run the full deterministic assessment.
 * Must never invent zeros for missing inputs.
 */
export function runAssessment(_profile: BorrowerProfile): AssessmentResult {
  throw new EngineNotImplementedError('runAssessment')
}

export function isEngineReady(): boolean {
  return false
}
