import { useMemo, useState } from 'react'
import { ASSESSMENT_QUESTIONS } from '../data'
import type { Answer, Question } from '../types'
import { ProgressIndicator } from './ProgressIndicator'

interface AssessmentContainerProps {
  initialAnswers?: Answer[]
  onComplete: (answers: Answer[]) => void
  onBack: () => void
}

function isAnswered(value: Answer['value']): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  return true
}

export function AssessmentContainer({
  initialAnswers = [],
  onComplete,
  onBack,
}: AssessmentContainerProps) {
  const questions = ASSESSMENT_QUESTIONS
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>(initialAnswers)
  const [draft, setDraft] = useState<Answer['value']>(
    () =>
      initialAnswers.find((a) => a.questionId === questions[0]?.id)?.value ??
      null,
  )

  const current: Question = questions[index]!
  const answeredCount = answers.filter((a) => isAnswered(a.value)).length

  const canContinue = useMemo(() => {
    if (current.optional) return true
    return isAnswered(draft)
  }, [current.optional, draft])

  function persistCurrent(value: Answer['value']): Answer[] {
    const nextAnswer: Answer = {
      questionId: current.id,
      value,
      answeredAt: new Date().toISOString(),
    }
    const without = answers.filter((a) => a.questionId !== current.id)
    return [...without, nextAnswer]
  }

  function goNext(value: Answer['value']) {
    const nextAnswers = persistCurrent(value)
    setAnswers(nextAnswers)

    if (index >= questions.length - 1) {
      onComplete(nextAnswers)
      return
    }

    const nextIndex = index + 1
    const existing = nextAnswers.find(
      (a) => a.questionId === questions[nextIndex]!.id,
    )
    setIndex(nextIndex)
    setDraft(existing?.value ?? null)
  }

  function handleContinue() {
    if (!canContinue && !current.optional) return
    goNext(isAnswered(draft) ? draft : null)
  }

  function handleSkip() {
    if (!current.optional) return
    goNext(null)
  }

  function handleBack() {
    if (index === 0) {
      onBack()
      return
    }
    const prevIndex = index - 1
    const existing = answers.find(
      (a) => a.questionId === questions[prevIndex]!.id,
    )
    setIndex(prevIndex)
    setDraft(existing?.value ?? null)
  }

  return (
    <section className="mx-auto flex min-h-[100svh] w-full max-w-lg flex-col px-5 pb-10 pt-6 sm:px-8">
      <header className="mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
        >
          Back
        </button>
        <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          Borrower Copilot
        </p>
        <span className="w-10" aria-hidden="true" />
      </header>

      <ProgressIndicator
        current={index + 1}
        total={questions.length}
        sectionLabel={current.section}
      />

      <div className="mt-10 flex flex-1 flex-col">
        <p className="animate-rise text-xs tracking-[0.12em] text-[var(--muted)] uppercase">
          Question {index + 1}
        </p>
        <h1 className="animate-rise-delay-1 mt-3 font-[family-name:var(--font-display)] text-2xl leading-snug tracking-tight text-[var(--ink)] sm:text-3xl">
          {current.prompt}
        </h1>
        {current.helpText ? (
          <p className="animate-rise-delay-2 mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {current.helpText}
          </p>
        ) : null}

        <div className="animate-rise-delay-3 mt-8">
          <QuestionInput
            question={current}
            value={draft}
            onChange={setDraft}
          />
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-12">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="inline-flex items-center justify-center rounded-md bg-[var(--teal)] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-[var(--teal-deep)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
          >
            {index >= questions.length - 1 ? 'See results' : 'Continue'}
          </button>
          {current.optional ? (
            <button
              type="button"
              onClick={handleSkip}
              className="py-2 text-sm text-[var(--muted)] transition hover:text-[var(--ink-soft)]"
            >
              Skip — leave unknown
            </button>
          ) : null}
          <p className="text-center text-xs text-[var(--muted)]">
            {answeredCount} answered · unknowns stay unknown, never zero
          </p>
        </div>
      </div>
    </section>
  )
}

interface QuestionInputProps {
  question: Question
  value: Answer['value']
  onChange: (value: Answer['value']) => void
}

function QuestionInput({ question, value, onChange }: QuestionInputProps) {
  if (question.inputType === 'single_choice' && question.options) {
    return (
      <fieldset className="space-y-2">
        <legend className="sr-only">{question.prompt}</legend>
        {question.options.map((option) => {
          const selected = value === option.value
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition ${
                selected
                  ? 'border-[var(--teal)] bg-[var(--teal-soft)]'
                  : 'border-[var(--line)] bg-white/70 hover:border-[var(--teal)]/40'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="mt-1 accent-[var(--teal)]"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--ink)]">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          )
        })}
      </fieldset>
    )
  }

  if (question.inputType === 'boolean') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Yes', val: true },
          { label: 'No', val: false },
        ].map((opt) => {
          const selected = value === opt.val
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.val)}
              className={`rounded-md border px-4 py-3 text-sm font-medium transition ${
                selected
                  ? 'border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-white/70 text-[var(--ink-soft)] hover:border-[var(--teal)]/40'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  const isCurrency = question.inputType === 'currency'
  const inputMode = question.inputType === 'text' ? 'text' : 'decimal'

  return (
    <div>
      <label className="sr-only" htmlFor={question.id}>
        {question.prompt}
      </label>
      <div className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-white/80 px-4 py-3 shadow-[var(--shadow-soft)] focus-within:border-[var(--teal)]">
        {isCurrency ? (
          <span className="text-sm text-[var(--muted)]" aria-hidden="true">
            ₹
          </span>
        ) : null}
        <input
          id={question.id}
          type={question.inputType === 'text' ? 'text' : 'number'}
          inputMode={inputMode}
          min={question.min}
          max={question.max}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') {
              onChange(null)
              return
            }
            if (question.inputType === 'text') {
              onChange(raw)
              return
            }
            const num = Number(raw)
            onChange(Number.isFinite(num) ? num : null)
          }}
          placeholder={isCurrency ? '0' : 'Enter value'}
          className="w-full border-0 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--mist-deep)]"
        />
        {question.unit ? (
          <span className="shrink-0 text-xs text-[var(--muted)]">
            {question.unit.replace(/^₹\s*/, '')}
          </span>
        ) : null}
      </div>
    </div>
  )
}
