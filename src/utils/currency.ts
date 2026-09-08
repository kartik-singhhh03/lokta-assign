/**
 * Indian rupee formatting helpers.
 * Never coerce null/undefined to ₹0 — unknown stays unknown.
 */

import type { MaybeNumber } from '../types'

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inrFormatterPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('en-IN', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

/** Format an INR amount. Returns an em dash when value is unknown. */
export function formatInr(
  value: MaybeNumber,
  options?: { precise?: boolean; unknownLabel?: string },
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return options?.unknownLabel ?? '—'
  }
  const formatter = options?.precise ? inrFormatterPrecise : inrFormatter
  return formatter.format(value)
}

/** Format a percent where input is already in percent points (12.5 → 12.5%). */
export function formatPercentPoints(
  value: MaybeNumber,
  options?: { unknownLabel?: string },
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return options?.unknownLabel ?? '—'
  }
  return `${value.toLocaleString('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}%`
}

/** Format a 0–1 ratio as a percent. */
export function formatRatio(
  value: MaybeNumber,
  options?: { unknownLabel?: string },
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return options?.unknownLabel ?? '—'
  }
  return percentFormatter.format(value)
}

/** Compact INR for charts / tight UI (e.g. ₹1.2L, ₹3.5Cr). */
export function formatInrCompact(
  value: MaybeNumber,
  options?: { unknownLabel?: string },
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return options?.unknownLabel ?? '—'
  }

  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    })}Cr`
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    })}L`
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toLocaleString('en-IN', {
      maximumFractionDigits: 1,
    })}K`
  }
  return formatInr(value)
}

/** Format a low–high INR range; preserves unknowns. */
export function formatInrRange(
  low: MaybeNumber,
  high: MaybeNumber,
  options?: { unknownLabel?: string },
): string {
  const unknown = options?.unknownLabel ?? '—'
  if (low === null && high === null) return unknown
  if (low === null) return `up to ${formatInr(high)}`
  if (high === null) return `from ${formatInr(low)}`
  if (low === high) return formatInr(low)
  return `${formatInr(low)} – ${formatInr(high)}`
}
