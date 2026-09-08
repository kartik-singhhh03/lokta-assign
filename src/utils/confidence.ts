import type { ConfidenceLevel, MaybeNumber } from '../types'

/**
 * Confidence helpers. Missing information must widen ranges —
 * never invent precision the inputs do not support.
 */

const CONFIDENCE_ORDER: ConfidenceLevel[] = ['low', 'medium', 'high']

export function downgradeConfidence(
  current: ConfidenceLevel,
  steps = 1,
): ConfidenceLevel {
  const idx = CONFIDENCE_ORDER.indexOf(current)
  return CONFIDENCE_ORDER[Math.max(0, idx - steps)]!
}

export function mergeConfidence(
  levels: ConfidenceLevel[],
): ConfidenceLevel {
  if (levels.length === 0) return 'low'
  const minIdx = Math.min(...levels.map((l) => CONFIDENCE_ORDER.indexOf(l)))
  return CONFIDENCE_ORDER[minIdx]!
}

/**
 * Widen a numeric band when confidence is weaker.
 * Returns null endpoints unchanged — unknown stays unknown.
 */
export function widenRange(
  low: MaybeNumber,
  high: MaybeNumber,
  confidence: ConfidenceLevel,
): { low: MaybeNumber; high: MaybeNumber } {
  if (low === null || high === null) {
    return { low, high }
  }

  const mid = (low + high) / 2
  const half = (high - low) / 2
  const factor = confidence === 'high' ? 1 : confidence === 'medium' ? 1.25 : 1.5

  return {
    low: Math.max(0, mid - half * factor),
    high: mid + half * factor,
  }
}

/** Count of provided vs expected fields — used to set overall confidence. */
export function confidenceFromCompleteness(
  knownCount: number,
  totalCount: number,
): ConfidenceLevel {
  if (totalCount <= 0) return 'low'
  const ratio = knownCount / totalCount
  if (ratio >= 0.8) return 'high'
  if (ratio >= 0.5) return 'medium'
  return 'low'
}
