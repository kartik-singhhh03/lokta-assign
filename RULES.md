# RULES.md — Borrower Copilot

Central configuration lives in `src/engine/rules.ts`.  
This document is the human-readable contract for evaluators and live follow-up interviews.

**Important:** FOIR percentages here are **Lokta product judgements for borrower self-assessment**. They are **not** RBI-mandated FOIR limits and **not** lender underwriting policy.

Source labels used below:

| Label | Meaning |
|---|---|
| **My judgement** | Product rule chosen for this challenge |
| **Illustrative assumption** | Placeholder used for education / scenario analysis, not a market quote |
| **Product rule** | Explicit Borrower Copilot behaviour (e.g. unknown ≠ zero) |
| **Source-backed** | Anchored to a published regulatory concept (cited) |

---

## 1. Affordability

| What | Value | Why | Source |
|---|---|---|---|
| Safe FOIR — stable salaried | 40% | Conservative total EMI ceiling for stable pay | My judgement |
| Safe FOIR — self-employed / business | 35% | Allows for income variability | My judgement |
| Safe FOIR — informal / variable / gig | 30% | Higher income uncertainty | My judgement |
| Safe FOIR — financially stressed | 25% | Bounce, severe burden, fragile cash flow | My judgement |
| Residual cash-flow share | 50% of (disposable − buffer) | FOIR alone can overstate capacity | My judgement |
| Residual buffer | ₹5,000 / month | Basic household safety buffer | My judgement |
| Unknown expense assumption | 55% of income | Prevent unknown expenses becoming ₹0 | My judgement |
| Stressed existing EMI / income | ≥ 45% | Marks repayment burden as stressed | My judgement |
| Near-zero EMI threshold | ₹500 | Treat exhausted headroom as effectively zero | My judgement |
| High-cost debt / income stress | outstanding ≥ 1× monthly income + bounce/high-cost flag | Decide without inventing EMI | My judgement |

### Binding formula

```
safeTotalEmi = incomeUsed × applicableFOIR
foirBasedNewEmi = max(0, safeTotalEmi − existingEMI)   // existingEMI never invented as 0 when unknown
disposableCash = incomeUsed − expensesUsed − existingEMI
cashFlowBasedSafeEmi = max(0, (disposableCash − ₹5,000) × 50%)
safeNewEmi = min(foirBasedNewEmi, cashFlowBasedSafeEmi)
```

If **existing EMI is unknown** and there is **no** high-cost + bounce stress path, `safeNewEmi` stays **unknown** (not ₹0).

If **high-cost outstanding debt + recent bounce** and EMI is unknown → `safeNewEmi = ₹0` with an explicit explanation (Anita path).

---

## 2. Income normalization

| What | Value | Why | Source |
|---|---|---|---|
| Prefer documented income when cash band exists | ITR ÷ 12 | Documented income is more defensible for capacity | My judgement |
| Cash band fallback | Low end of band | Never use the high end for primary affordability | My judgement |
| Spouse income | Counted only if `spouseIsCoApplicant === true` | Co-earner ≠ automatic co-applicant | Product rule |
| Point income | Used when provided | Stated take-home for salaried profiles | Product rule |

---

## 3. Credit / risk

| What | Value | Why | Source |
|---|---|---|---|
| Unknown credit score | Unknown | Never assume a low score / 300 | Product rule |
| Thin file / no formal history | Widen rate band; lower confidence | Uncertainty ≠ bad credit | Product rule |
| Recent bounced EMI | Stress FOIR + worsen rate band | Clear repayment-stress signal | My judgement |
| High-cost app debt (30%+) | Risk flag; with bounce can force DONT_BORROW | Matches borrower harm pattern | My judgement |
| Strong bureau (750+) | Mildly better indicative pricing | Lower expected credit risk | My judgement |

---

## 4. Rate bands (illustrative)

Annual % points. **Not guaranteed lender offers.**

| Product / profile | Band | Source |
|---|---|---|
| Personal — excellent/strong salaried | 10.5–13% | Illustrative assumption |
| Personal — good salaried | 11.5–14% | Illustrative assumption |
| Personal — self-employed documented | 12–16% | Illustrative assumption |
| Personal — thin / no bureau | 14–20% | Illustrative assumption |
| Personal — distressed | 18–28% | Illustrative assumption |
| Secured business — strong | 9.5–12.5% | Illustrative assumption |
| Secured business — standard | 10.5–14% | Illustrative assumption |
| Secured business — thin file | 11.5–16% | Illustrative assumption |
| Vehicle — strong / standard / thin / distressed | 9–24% (tiered) | Illustrative assumption |
| Absolute floor / ceiling | 7.5% / 36% | My judgement |
| Max band width (H/M/L confidence) | 4 / 6 / 8 pp | My judgement (keep negotiation actionable) |
| Thin-file widen (unsecured) | −0.75 / +2.0 pp | My judgement |
| Thin-file widen (secured) | −0.5 / +1.5 pp | My judgement |

Adjustments for income type, tenure history, bounce, and confidence are listed in `RATE_ADJUSTMENTS` inside `rules.ts`.

---

## 5. Product routing

| Purpose / signal | Product | Source |
|---|---|---|
| Wedding / consumption / medical / education / debt consolidation | PERSONAL | My judgement |
| Business / expansion / inventory | BUSINESS | My judgement |
| Business purpose + meaningful unencumbered collateral (≥ ₹10L) | SECURED_BUSINESS (suggestion, not approval) | My judgement |
| Scooter / vehicle | VEHICLE | My judgement |
| Home improvement | PERSONAL (HOME as alternate) | My judgement |

---

## 6. Lender estimate

| What | Value | Why | Source |
|---|---|---|---|
| Separate from safe amount | Always | Lender capacity ≠ borrower comfort | Product rule |
| Lender FOIR premium | Borrower FOIR + 5 pp (capped 55%) | Lenders may underwrite looser than our safe rule | My judgement |
| Unsecured income-months proxy | 18 / 14 / 10 / 6 / 3 by profile bucket | Crude illustrative sanction heuristic | Illustrative assumption |
| Secured collateral LTV | 50% of stated collateral value | Only for estimated lender range | My judgement |
| Secured blend | 55% income capacity + 45% collateral capacity | Blend, not collateral-only | My judgement |
| Range width by confidence | 12% / 20% / 32% | Missing bureau widens estimate | My judgement |

**The estimated lender range is a product heuristic, not a prediction of approval.**

---

## 7. Safe borrowing

| What | Value | Why | Source |
|---|---|---|---|
| Comfortable range tenure window | ±1 product tenure step around selected tenure | Avoid meaningless ultra-wide ranges | My judgement |
| Rate spread inside comfortable range | 50% of (fairHigh − fairLow) / 2 | Reflect rate uncertainty without full extremes | My judgement |
| Comfortable low / high pads | ×0.92 / ×1.05 | Soft envelope | My judgement |
| Mathematical maximum | Inverse EMI at longest product tenure @ fair-low rate | Shown separately; not the UI “safe range” | My judgement |
| Collateral effect on safe amount | **None** | Collateral does not repay EMIs by itself | Product rule |
| Recommended amount | Requested if inside supported principal; else capacity-based | Prefer borrower intent when safe | My judgement |
| Borrow-less tolerance | Requested > safeHigh × 1.05 | Small cushion before BORROW_LESS | My judgement |

---

## 8. APR / fees

| What | Value | Why | Source |
|---|---|---|---|
| Illustrative processing fee | 2% of principal | Educate all-in cost; **not** a quoted lender fee | Illustrative assumption |
| APR method | Monthly IRR on cash flows (+net disbursal, −EMI × n), annualised as `(1+r)^12−1` | Not “headline + fee%” | My judgement / standard cash-flow APR |
| Net disbursal | Principal − fee | Borrower receives less than face principal | Product rule |

### Regulatory context (source-backed)

Indian retail loan disclosures emphasise **all-in cost / APR** and **Key Fact Statement (KFS)** style transparency so borrowers can compare offers beyond headline interest.

Relevant RBI materials (read current circulars on rbi.org.in for the binding text):

- RBI guidance on **Key Fact Statement / most important terms** for retail and MSME loans
- RBI emphasis on disclosing **annual percentage rate / effective cost** inclusive of fees where applicable

This app **illustrates** the concept locally. It does **not** produce a regulated KFS and does not claim compliance certification.

---

## 9. Stress testing

| What | Value | Why | Source |
|---|---|---|---|
| Income stress | −15% | Simple, understandable shock | My judgement |
| Rate stress | +2 percentage points | Floating-rate sensitivity | My judgement |
| Status labels | Comfortable / Tight / Stressed / Unknown | Plain language | Product rule |
| Who gets income vs rate stress | Variable/self-employed → income; stable salaried → rate | Match dominant risk | My judgement |

---

## 10. Confidence

| What | Value | Why | Source |
|---|---|---|---|
| Levels | high / medium / low | Information quality, not cosmetics | Product rule |
| Missing must-know fields | Lowers confidence | Incomplete profile | Product rule |
| Unknown / thin bureau | Medium or low; widens rate & lender ranges | Uncertainty | Product rule |
| Variable income + no formal credit | Low | Dual uncertainty | My judgement |
| Confidence must change ranges | Widen rate band / lender width | Badge-only confidence is forbidden | Product rule |

---

## 11. Decision rules

| Decision | When | Source |
|---|---|---|
| **Don't borrow right now** | Safe EMI ≈ 0; or high-cost debt + bounce + fragile income; or severe distress | My judgement |
| **Borrow less** | Some capacity exists but requested amount > comfortable safe high | My judgement |
| **Borrow** | Requested within comfortable safe range; capacity healthy; no major distress flags | My judgement |
| Lender range never overrides safe amount | Always | Product rule |

Borrower-facing labels:

- Borrow — “You appear able to carry the requested borrowing within our affordability rules.”
- Borrow less — “You may be able to borrow, but the amount you requested is above the amount we consider comfortable.”
- Don't borrow right now — “Your current repayment position does not leave enough safe headroom for a new loan.”

---

## Key Product Judgements

1. **Lender amount and safe borrower amount are separate.** One answers “what might be offered”; the other answers “what you should carry.”
2. **A lender can theoretically offer more than the borrower should accept.** Sanction is not the same as affordability.
3. **Unknown credit score widens uncertainty** instead of becoming a low score. Thin file ≠ 300.
4. **Ravi routes toward secured business financing** because the purpose is business expansion and he has substantial unencumbered collateral — as a **suggestion**, not an approval.
5. **Ravi’s collateral does not automatically increase safe borrowing capacity.** Property may support a larger estimated lender range; repayment still depends on income.
6. **Anita gets Don't borrow right now** despite a potentially productive scooter: current high-cost debt + bounce + variable income dominate. Future earning upside is noted as a later path, not a green light today.
7. **Household expenses constrain affordability in addition to FOIR** so FOIR cannot “approve” an EMI the residual cash flow cannot support.
8. **APR is shown separately from headline interest** because fees change the cash the borrower actually receives.
9. **Ranges widen when information is missing** so the UI does not fake precision.

---

## Known Limitations

- No bureau / credit-pull data
- No lender-specific underwriting engines
- No verified income documents (ITR used only when the user provides it)
- No live lender quotes
- Illustrative rate bands
- Illustrative fee assumptions
- No real property valuation
- No real collateral LTV policy from a lender
- Not legal or financial advice
- Actual loan terms vary by lender and verified application

**The estimated lender range is a product heuristic, not a prediction of approval.**

---

## Disclaimer

Borrower Copilot is a self-assessment tool, not a lender approval or financial advice. Rates, fees and lender ranges are illustrative estimates. Actual terms depend on the lender and your verified application.
