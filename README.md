# Borrower Copilot

A calm, deterministic self-assessment for Indian borrowers — before they sign.

## Problem

Borrowers in India often face an information asymmetry: lenders know underwriting, pricing, and fees; the borrower usually sees a headline rate and a sanctioned amount. That can push people toward **taking whatever is offered**, not toward **what they can safely repay**.

## What it does

Borrower Copilot answers four questions on-device, with no backend:

1. **Borrow / Borrow less / Don't borrow right now**
2. **Estimated lender range vs safe borrower range** (kept deliberately separate)
3. **Fair rate band + all-in APR** (illustrative fee assumption)
4. **EMI ceiling + stress test**

Plus a printable **Negotiation Card** for the lender conversation.

## Product principles

- Borrower-first, not lender-first
- Ranges instead of false precision
- Unknown ≠ zero
- Adaptive / optional questions where data is missing
- Every major number has a reason (“Why this number?”)
- Lender capacity ≠ safe capacity

## Architecture

```
Questionnaire / demo presets
        ↓
answersToProfile (or DEMO_* profiles)
        ↓
assessBorrower  ← single public engine entry point
        ↓
determineProduct
calculateAffordability
calculateRate
calculateLenderAmount
calculateLoanAmount
calculateApr
calculateStress
evaluateBorrower
        ↓
AssessmentResult
        ↓
Results UI + Negotiation Card
```

Business rules live in `src/engine/` (especially `rules.ts`). React components only render `AssessmentResult` — they do not calculate FOIR, EMI, APR, or decisions.

## Tech stack

- React + TypeScript
- Vite
- Tailwind CSS v4
- Vitest

No backend, database, authentication, or external APIs.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically `http://127.0.0.1:5173`).

```bash
npm test
npm run build
```

## Try the three examples

On the landing screen:

| Demo | What it demonstrates |
|---|---|
| **Priya** | Strong salaried profile → **Borrow**; lender range can still exceed what she should carry |
| **Ravi** | Thin-file self-employed + collateral → **Borrow less** / **SECURED_BUSINESS**; collateral lifts lender estimate, not safe amount |
| **Anita** | High-cost debt + bounce + variable income → **Don't borrow right now**; exact EMI unknown and never invented |

See [RUNTHROUGHS.md](./RUNTHROUGHS.md) for full recorded outputs.

## Design decisions

See [RULES.md](./RULES.md) — especially **Key Product Judgements** and the assumption tables.

Highlights:

1. Safe borrower amount is repayment-capacity driven; estimated lender range is separate.
2. Unknown credit score widens ranges; it is never treated as a 300 / “bad” score.
3. Spouse income counts only when marked as co-applicant.
4. APR is a cash-flow effective rate with an **illustrative** processing fee — not headline + fee%.

## Limitations

This is a **self-assessment**, not underwriting, not financial advice, and not a prediction of approval.

Full list: [RULES.md → Known Limitations](./RULES.md#known-limitations).

## Walkthrough script

[WALKTHROUGH.md](./WALKTHROUGH.md) — ~5-minute recording script.
