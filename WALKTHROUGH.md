# Five-minute walkthrough script

Target length: ~5 minutes. Speak calmly, show the UI, don’t read every number.

---

### 0:00–0:30 — Problem and thesis

“Borrowers in India often see a sanctioned amount and a headline rate. Lenders know underwriting and fees. That asymmetry pushes people to take whatever is offered.

Borrower Copilot is a small, on-device self-assessment. It answers four questions: should I borrow, how much is safe versus what a lender might offer, what rate band and APR look fair, and what EMI I should agree to — plus a negotiation card.”

### 0:30–1:30 — Questionnaire and adaptive branching

Open the app. Click **Start assessment**.

“Questions are mobile-first. Must-ask items cover income type, stability, bounce history, purpose, amount, tenure. Optional questions — expenses, exact EMI, ITR, spouse co-applicant, collateral, bureau — can be skipped. Skipped means unknown. We never coerce unknown to zero.”

Show Skip on an optional field.

“Spouse income only counts if you say they’ll be a co-applicant. That matters for Ravi.”

Return to landing.

### 1:30–2:30 — Priya

Click **Priya · salaried**.

“Priya is a strong salaried profile: ₹1.1L net, ₹14k EMI, ₹28k rent, 780 score, ₹8L wedding loan.

Decision: **Borrow**. Product: personal. Confidence: high.

Look at the split: **safe borrower range** versus **estimated lender range**. Her ₹8L request fits our comfortable safe range, but the lender estimate can still sit higher. The product line is: a lender may offer more than you should borrow.

Fair rate sits near the lower end of our illustrative band. APR is higher than headline because we include an illustrative 2% fee via cash-flow math — not headline plus two.

EMI ceiling is ₹30,000: 40% of income minus existing EMI. Stress test: rate up 2 points, buffer stays comfortable.”

Open **Why this number?** once, then the Negotiation Card briefly.

### 2:30–3:30 — Ravi

Back → **Ravi · business**.

“Ravi is self-employed with a ₹40–80k cash band, but ITR is ₹4.2L — we use documented ₹35k per month for capacity, not the top of the cash band. Wife earns ₹18k but is **not** a co-applicant, so we don’t add her income.

He has a ₹45L unencumbered shop. We route to **secured business** as a suggestion, not an approval.

Decision: **Borrow less**. Safe EMI is only about ₹5.4k; comfortable safe amount is roughly ₹1.8–3.2L, recommended ~₹2.3L — far below the ₹15L request.

Collateral lifts the **estimated lender range** toward much larger numbers. That is the point of the product: collateral can change what a lender might offer; it does **not** magically make ₹15L safe to repay.

Confidence is medium. Rate band is wider and labelled indicative because there’s no bureau history — we widen uncertainty instead of inventing a bad score.”

### 3:30–4:15 — Anita

Back → **Anita · stressed**.

“Anita is the sharp Don’t Borrow case. Variable ₹26–30k income, two kids, spouse unemployed, ₹35k high-cost app debt, recent bounce. Exact EMI is **unknown** — we did not invent ₹8,500 or any other figure.

Decision: **Don’t borrow right now**. Safe EMI and safe amount are zero. APR isn’t priced because we’re not recommending a principal.

We still say a scooter might raise future earnings — but future upside does not override today’s debt stress. Next steps: stabilize income, restructure high-cost debt, then reassess.”

### 4:15–4:45 — Negotiation Card

Scroll to the card / Print.

“For Priya and Ravi, the card is something you could literally show: safe EMI, fair rate, recommended size, questions to ask — APR not headline, fees, fixed vs floating, total repayment, foreclosure.

For Anita, the card refuses a fake rate target. It says don’t borrow right now and points to restructuring first.”

### 4:45–5:00 — What I’d build next / what I cut

“Next: lender-specific rate and fee data with timestamps, better document verification, a real KFS/APR comparison workflow, multi-lender offer compare, and stronger collateral valuation.

Intentionally cut: auth, backend, database, bureau pulls, lender APIs, ML scoring, chatbot, marketplace, and a huge questionnaire. This challenge is a borrower self-assessment in a 12–16 hour box — rules are centralized in `rules.ts` so a follow-up can change one assumption live.”

Stop.
