import { useState } from 'react'
import {
  AssessmentContainer,
  Landing,
  ResultContainer,
} from './components'
import type { Answer, AppScreen } from './types'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('landing')
  const [answers, setAnswers] = useState<Answer[]>([])

  function handleStart() {
    setAnswers([])
    setScreen('assessment')
  }

  function handleAssessmentComplete(next: Answer[]) {
    setAnswers(next)
    setScreen('results')
  }

  function handleRestart() {
    setAnswers([])
    setScreen('landing')
  }

  function handleEditAnswers() {
    setScreen('assessment')
  }

  return (
    <main className="min-h-[100svh]">
      {screen === 'landing' ? <Landing onStart={handleStart} /> : null}
      {screen === 'assessment' ? (
        <AssessmentContainer
          initialAnswers={answers}
          onComplete={handleAssessmentComplete}
          onBack={handleRestart}
        />
      ) : null}
      {screen === 'results' ? (
        <ResultContainer
          answers={answers}
          onRestart={handleRestart}
          onEditAnswers={handleEditAnswers}
        />
      ) : null}
    </main>
  )
}
