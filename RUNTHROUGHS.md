# Run-throughs — Priya, Ravi, Anita

Numbers below are **recorded from the live deterministic engine** (`assessBorrower` on the demo profiles in `src/data/demos.ts`) after Phase 3 calibration.  
They were **not** hand-edited to match expectations.

Demo entry point in the UI: landing → **Try a demo profile**.

Questionnaire bank: `src/data/questions.ts` (must + optional / adaptive fields).

---

## Shared questionnaire (app flow)

### Must-answer (cannot skip)

| Question | Profile field |
|---|---|
| How do you earn your income? | `employmentType` |
| How stable is your income month to month? | `incomeStability` |
| Have you missed or bounced an EMI in the last 6 months? | `recentBouncedEmi` |
| How much are you looking to borrow? | `requestedAmount` |
| Over how many months would you prefer to repay? | `desiredTenureMonths` |
| What is the main purpose of this loan? | `loanPurpose` |

### Optional / adaptive (skip = unknown; never coerced to zero)

| Question | Why it exists |
|---|---|
| Monthly take-home income | Point income when known |
| Documented annual income (ITR) | Self-employed capacity |
| Spouse income + **co-applicant?** | Spouse income counts only if co-applicant = Yes |
| Employment / business years | Rate / confidence |
| Existing EMI | Skip if unknown — **not invented** |
| Outstanding unsecured / app-loan debt | Anita-style stress without inventing EMI |
| High-cost debt (30%+)? | Risk flag |
| Household expenses | Skip → disclosed 55% income assumption |
| Dependents | Risk context |
| Collateral yes/value | Product routing + lender estimate only |
| Credit score band / formal bureau history | Confidence + rate width |

---

## 1. Priya

### Inputs (brief → demo profile)

| Field | Value |
|---|---|
| Name | Priya |
| Age | 29 |
| City | Bengaluru |
| Income type | Salaried |
| Occupation | Software engineer, large MNC |
| Employment tenure | 5 years |
| Net monthly income | ₹1,10,000 |
| Existing EMI | ₹14,000 |
| Rent / essential expenses | ₹28,000 |
| Credit score | 780 (band 750–799) |
| Purpose | Wedding → PERSONAL |
| Requested | ₹8,00,000 |
| Desired tenure | 36 months |

### Actual engine output

| Field | Value |
|---|---|
| **Decision** | **Borrow** |
| Decision copy | You appear able to carry the requested borrowing within our affordability rules. Requested ₹8,00,000 sits within your comfortable safe borrower range of ₹5,95,729 – ₹12,62,205. A lender may offer more than you should borrow. |
| **Product** | **PERSONAL** |
| **Confidence** | **high** — income, obligations and credit profile sufficiently known |
| Safe EMI | **₹30,000 / month** |
| Safe EMI why | ₹1,10,000 × 40% = ₹44,000 total ceiling − ₹14,000 existing EMI = ₹30,000 |
| Disposable cash flow | ₹68,000 |
| Comfortable safe range | **₹5,95,729 – ₹12,62,205** |
| Mathematical maximum | ₹14,40,145 (longest tenure; shown separately) |
| Recommended amount | **₹8,00,000** |
| Estimated lender range | **₹9,71,343 – ₹12,36,255** |
| Fair rate | **9.15% – 11.65%** |
| Expected rate | **9.78%** |
| Processing fee (illustrative) | **2.0% (₹16,000)** |
| Net disbursal | ₹7,84,000 |
| Total repayment | ₹9,26,256 |
| APR | **11.76%** |
| Stress | Rate +2 pp → buffer ₹42,271 → ₹41,514 (**Comfortable**) |

### Why (recorded)

- Borrow
- Stable salaried income
- Strong credit score (780)
- Recommended product route: personal

### What we don’t know

- Exact lender offer / underwriting decision
- Actual processing fee the lender will charge
- Exact product-specific underwriting criteria

### Negotiation Card (anchors)

- Requested / recommended: ₹8,00,000
- Safe EMI: ₹30,000 / month
- Fair rate: 9.15% – 11.65%
- Negotiation target: ≤ 9.78%
- Ask APR, fees, fixed vs floating, total repayment, foreclosure, better rate

### Qualitative check

Matches expectation: **BORROW**, **PERSONAL**, **high** confidence. Lender range can still sit above what she should treat as a target.

---

## 2. Ravi

### Inputs (brief → demo profile)

| Field | Value |
|---|---|
| Name | Ravi |
| Age | 42 |
| City | Mysuru |
| Income type | Self-employed (kirana, 14 years) |
| Cash income | ₹40,000 – ₹80,000 / month (band) |
| ITR | ₹4,20,000 / year → **₹35,000 / month documented** used for capacity |
| Spouse income | ₹18,000 / month |
| Spouse co-applicant | **No** (`spouseIsCoApplicant = false`) |
| Collateral | Unencumbered shop ≈ ₹45,00,000 |
| Credit / bureau | No formal history |
| Existing EMI | ₹0 (stated none) |
| Household expenses | **Unknown** in brief → engine uses disclosed **55% of income** assumption (₹19,250) |
| Purpose | Business expansion → **SECURED_BUSINESS** |
| Requested | ₹15,00,000 |
| Desired tenure | 60 months |

### Actual engine output

| Field | Value |
|---|---|
| **Decision** | **Borrow less** |
| Decision copy | You may be able to borrow, but the amount you requested is above the amount we consider comfortable. Safe range ≈ ₹1,77,519 – ₹3,19,226. Property may make a larger secured facility possible, but documented income does not make ₹15L comfortable. Consider ~₹2,33,334. A lender may offer more than you should borrow. |
| **Product** | **SECURED_BUSINESS** |
| **Confidence** | **medium** — income/EMI known; credit score unavailable |
| Income used | ₹35,000 (ITR ÷ 12); spouse **not** included |
| Safe EMI | **₹5,375 / month** |
| Comfortable safe range | **₹1,77,519 – ₹3,19,226** |
| Mathematical maximum | ₹3,87,805 |
| Recommended amount | **₹2,33,334** |
| Estimated lender range | **₹7,00,318 – ₹19,93,212** |
| Fair rate | **11.15% – 17.15%** (**indicative**) |
| Expected rate | **13.55%** |
| Processing fee (illustrative) | 2.0% (₹4,667 on recommended principal) |
| APR | **15.45%** |
| Stress | Income −15% → buffer ₹10,375 → ₹5,125 (**Tight**) |

### Domain emphasis (as designed)

1. **Collateral affects estimated lender capacity** (range rises into ~₹7L–₹20L).
2. **Collateral does NOT make ₹15L safe to repay** — safe high stays ~₹3.19L.
3. **Primary affordability is income-driven** (documented ₹35k/month).
4. **Spouse ₹18k is not counted** because co-applicant = false.

### What we don’t know (excerpt)

- Bureau / credit score history; formal credit history (thin file)
- Exact household expenses; exact business profit vs cash band
- Lender valuation / LTV of the shop
- Whether spouse will be a co-applicant

### Qualitative check

Matches expectation: **BORROW_LESS**, **SECURED_BUSINESS**, **medium** confidence.

---

## 3. Anita

### Inputs (brief → demo profile)

| Field | Value |
|---|---|
| Name | Anita |
| Age | 35 |
| City | Hubballi |
| Income | Informal / variable ₹26,000 – ₹30,000 (engine uses **low end ₹26,000**) |
| Work | Delivery rider + tailoring |
| Dependents | 2 children |
| Spouse | Unemployed (`spouseUnemployed = true`; income 0; not co-applicant) |
| App loans | 3; outstanding **₹35,000**; high-cost **30%+** |
| Recent bounce | Yes (last month) |
| **Existing EMI** | **Unknown — not invented** |
| Household expenses | Unknown → disclosed assumption |
| Credit score | Unknown |
| Purpose | Electric scooter → **VEHICLE** |
| Requested | ₹1,50,000 |

### Actual engine output

| Field | Value |
|---|---|
| **Decision** | **Don't borrow right now** |
| Decision copy | Current repayment position lacks safe headroom. ₹35,000 high-cost debt + recent bounce. Scooter may raise future earnings but does **not** make ₹1,50,000 safe today. Exact EMI was not provided — we did not invent one. |
| **Product** | **VEHICLE** |
| **Confidence** | **low** |
| Safe EMI | **₹0** |
| Safe amount / recommended | **₹0** |
| Mathematical maximum | ₹0 |
| Estimated lender range | ₹40,560 – ₹1,15,440 (heuristic only; **not** a reason to borrow) |
| Fair rate | 20.88% – 28.88% (**indicative**; not a negotiation target) |
| Expected | 24.08% |
| Processing fee / APR | Fee assumption 2%; **APR unavailable** because no recommended principal is priced |
| Stress | Income −15% shown; buffer **unknown** (EMI unknown) |

### Next steps (recorded)

- Build 2–3 months of more stable income before taking new debt
- Clear/restructure high-cost app debt where possible, then reassess
- Scooter upside is a **later** path — it does not override today’s stress

### Negotiation Card

- Headline: **Don't borrow right now**
- No rate negotiation target
- Questions focus on restructuring existing high-cost debt / future readiness

### Qualitative check

Matches expectation: **DONT_BORROW**, **VEHICLE**, **low** confidence, safe EMI/amount **₹0**, APR **null**.

---

## How to reproduce

```bash
npm install
npm run dev
```

Use landing demos **Priya / Ravi / Anita**, or call:

```ts
import { assessBorrower } from './src/engine'
import { DEMO_PRIYA, DEMO_RAVI, DEMO_ANITA } from './src/data'
```
