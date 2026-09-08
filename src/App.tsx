import { useMemo, useState } from 'react'
import {
  AssessmentContainer,
  Landing,
  ResultContainer,
} from './components'
import { DEMO_BORROWERS } from './data'
import { answersToProfile, assessBorrower } from './engine'
import type { Answer, AppScreen, AssessmentResult } from './types'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('landing')
  const [answers, setAnswers] = useState<Answer[]>([])
  const [demoResult, setDemoResult] = useState<AssessmentResult | null>(null)

  const result = useMemo(() => {
    if (demoResult) return demoResult
    if (answers.length === 0) return null
    const profile = answersToProfile(undefined, answers)
    return assessBorrower(profile)
  }, [answers, demoResult])

  function handleStart() {
    setAnswers([])
    setDemoResult(null)
    setScreen('assessment')
  }

  function handleAssessmentComplete(next: Answer[]) {
    setDemoResult(null)
    setAnswers(next)
    setScreen('results')
  }

  function handleRestart() {
    setAnswers([])
    setDemoResult(null)
    setScreen('landing')
  }

  function handleEditAnswers() {
    setDemoResult(null)
    setScreen('assessment')
  }

  function handleLoadDemo(key: keyof typeof DEMO_BORROWERS) {
    setAnswers([])
    setDemoResult(assessBorrower(DEMO_BORROWERS[key]))
    setScreen('results')
  }

  return (
    <main className="min-h-[100svh]">
      {screen === 'landing' ? (
        <Landing onStart={handleStart} onLoadDemo={handleLoadDemo} />
      ) : null}
      {screen === 'assessment' ? (
        <AssessmentContainer
          initialAnswers={answers}
          onComplete={handleAssessmentComplete}
          onBack={handleRestart}
        />
      ) : null}
      {screen === 'results' && result ? (
        <ResultContainer
          result={result}
          onRestart={handleRestart}
          onEditAnswers={handleEditAnswers}
        />
      ) : null}
    </main>
  )
}
