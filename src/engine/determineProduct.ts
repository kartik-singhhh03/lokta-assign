import type {
  BorrowerProfile,
  ProductRoutingResult,
  ProductType,
} from '../types'
import { formatInr } from '../utils/currency'
import { COLLATERAL_RULES, PURPOSE_PRODUCT_MAP } from './rules'

function purposeToProduct(purpose: string | null): ProductType {
  if (!purpose) return 'OTHER'
  const key = purpose.toLowerCase().trim()
  return PURPOSE_PRODUCT_MAP[key] ?? 'OTHER'
}

function hasMeaningfulCollateral(profile: BorrowerProfile): boolean {
  if (profile.hasCollateral === false) return false
  if (
    profile.collateralValue !== null &&
    profile.collateralValue >= COLLATERAL_RULES.meaningfulCollateralInr
  ) {
    return true
  }
  return profile.hasCollateral === true && profile.collateralValue === null
    ? false // claimed but unvalued — do not auto-route to secured
    : false
}

export function determineProduct(profile: BorrowerProfile): ProductRoutingResult {
  const base = purposeToProduct(profile.loanPurpose)
  const alternates: ProductType[] = []
  let product: ProductType = base
  const factors: string[] = []

  const purposeLabel = profile.loanPurpose ?? 'unspecified purpose'
  factors.push(`Stated purpose: ${purposeLabel}`)

  const meaningfulCollateral = hasMeaningfulCollateral(profile)

  if (
    (base === 'BUSINESS' ||
      profile.loanPurpose === 'business' ||
      profile.loanPurpose === 'business_expansion' ||
      profile.loanPurpose === 'inventory' ||
      profile.loanPurpose === 'productive_asset') &&
    meaningfulCollateral
  ) {
    product = 'SECURED_BUSINESS'
    alternates.push('BUSINESS')
    factors.push(
      `Unencumbered collateral about ${formatInr(profile.collateralValue)} suggests considering a secured business / LAP route`,
    )
  } else if (base === 'VEHICLE' || profile.loanPurpose === 'scooter') {
    product = 'VEHICLE'
    factors.push('Vehicle / scooter purpose maps to a vehicle loan product')
  } else if (base === 'HOME' || profile.loanPurpose === 'home_improvement') {
    product = base === 'HOME' ? 'HOME' : 'HOME'
    if (profile.loanPurpose === 'home_improvement') {
      // Home improvement is often personal or top-up; keep HOME only for pure home.
      product = 'PERSONAL'
      alternates.push('HOME')
      factors.push(
        'Home improvement often prices like a personal / top-up loan unless structured as housing finance',
      )
    }
  } else if (
    profile.loanPurpose === 'wedding' ||
    profile.loanPurpose === 'consumption'
  ) {
    product = 'PERSONAL'
    factors.push('Wedding / consumption purpose maps to an unsecured personal loan')
  }

  if (product === 'SECURED_BUSINESS') {
    return {
      product,
      alternateProducts: alternates,
      confidence: profile.collateralValue !== null ? 'medium' : 'low',
      explanation: {
        summary: `Recommended product route: secured business financing (not an approval).`,
        text: `Your ${formatInr(profile.requestedAmount)} requirement is for business purposes and you have substantial unencumbered collateral${profile.collateralDescription ? ` (${profile.collateralDescription})` : ''}, so a secured business route may be more appropriate than an unsecured personal loan. This is a product-routing suggestion — not a claim of lender approval.`,
        factors,
      },
    }
  }

  return {
    product,
    alternateProducts: alternates,
    confidence: profile.loanPurpose ? 'high' : 'low',
    explanation: {
      summary: `Recommended product route: ${product.replaceAll('_', ' ').toLowerCase()}.`,
      text: `Based on purpose “${purposeLabel}”, our self-assessment routes this toward a ${product.replaceAll('_', ' ')} style product. This is illustrative routing, not eligibility or approval.`,
      factors,
      missingInputs: profile.loanPurpose ? undefined : ['loan purpose'],
    },
  }
}
