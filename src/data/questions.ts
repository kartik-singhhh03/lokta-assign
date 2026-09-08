import type { Question } from '../types'

/**
 * Assessment question bank.
 * Kept in data/ so the UI can render forms without owning domain rules.
 *
 * Placeholder set — enough to drive the shell and progress indicator.
 * Final wording and branching will be refined with the engine.
 */
export const ASSESSMENT_QUESTIONS: Question[] = [
  {
    id: 'monthly_income',
    section: 'Income',
    prompt: 'What is your monthly take-home income?',
    helpText: 'Salary credited after tax and statutory deductions, in ₹.',
    inputType: 'currency',
    profileKey: 'monthlyIncome',
    optional: false,
    min: 0,
    unit: '₹ / month',
  },
  {
    id: 'existing_emi',
    section: 'Obligations',
    prompt: 'How much do you already pay in EMIs each month?',
    helpText: 'Include home, auto, personal, and credit-card EMIs. Skip if none.',
    inputType: 'currency',
    profileKey: 'existingEmi',
    optional: true,
    min: 0,
    unit: '₹ / month',
  },
  {
    id: 'monthly_expenses',
    section: 'Obligations',
    prompt: 'What are your essential monthly living expenses?',
    helpText: 'Rent, groceries, utilities, school fees — excluding EMIs.',
    inputType: 'currency',
    profileKey: 'monthlyExpenses',
    optional: true,
    min: 0,
    unit: '₹ / month',
  },
  {
    id: 'requested_amount',
    section: 'Loan',
    prompt: 'How much are you looking to borrow?',
    inputType: 'currency',
    profileKey: 'requestedAmount',
    optional: false,
    min: 0,
    unit: '₹',
  },
  {
    id: 'desired_tenure',
    section: 'Loan',
    prompt: 'Over how many months would you prefer to repay?',
    inputType: 'number',
    profileKey: 'desiredTenureMonths',
    optional: false,
    min: 6,
    max: 84,
    unit: 'months',
  },
  {
    id: 'loan_purpose',
    section: 'Loan',
    prompt: 'What is the main purpose of this loan?',
    inputType: 'single_choice',
    profileKey: 'loanPurpose',
    optional: false,
    options: [
      { value: 'medical', label: 'Medical / emergency' },
      { value: 'education', label: 'Education' },
      { value: 'home_improvement', label: 'Home improvement' },
      { value: 'debt_consolidation', label: 'Debt consolidation' },
      { value: 'business', label: 'Business / working capital' },
      { value: 'consumption', label: 'Personal / consumption' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    id: 'employment_type',
    section: 'Profile',
    prompt: 'How do you earn your income?',
    inputType: 'single_choice',
    profileKey: 'employmentType',
    optional: true,
    options: [
      { value: 'salaried', label: 'Salaried' },
      { value: 'self_employed', label: 'Self-employed' },
      { value: 'business', label: 'Business owner' },
      { value: 'gig', label: 'Gig / freelance' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    id: 'credit_score_band',
    section: 'Profile',
    prompt: 'Do you know your credit score band?',
    helpText: 'Leave unknown if you are unsure — we will widen confidence, not guess.',
    inputType: 'single_choice',
    profileKey: 'creditScoreBand',
    optional: true,
    options: [
      { value: 'below_650', label: 'Below 650' },
      { value: '650_699', label: '650 – 699' },
      { value: '700_749', label: '700 – 749' },
      { value: '750_799', label: '750 – 799' },
      { value: '800_plus', label: '800+' },
      { value: 'unknown', label: 'I don’t know' },
    ],
  },
]

export const QUESTION_SECTIONS = [
  ...new Set(ASSESSMENT_QUESTIONS.map((q) => q.section)),
]
