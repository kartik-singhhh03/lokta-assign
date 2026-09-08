interface LandingProps {
  onStart: () => void
}

export function Landing({ onStart }: LandingProps) {
  return (
    <section className="relative flex min-h-[100svh] flex-col px-5 pb-10 pt-8 sm:px-8">
      <header className="animate-fade mx-auto flex w-full max-w-lg items-center justify-between">
        <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)] sm:text-2xl">
          Lokta
        </p>
        <p className="text-xs tracking-[0.14em] text-[var(--muted)] uppercase">
          India
        </p>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-16">
        <p className="animate-rise font-[family-name:var(--font-display)] text-4xl leading-[1.1] tracking-tight text-[var(--ink)] sm:text-5xl">
          Borrower Copilot
        </p>

        <p className="animate-rise-delay-1 mt-5 max-w-md text-base leading-relaxed text-[var(--ink-soft)] sm:text-lg">
          A calm self-assessment that tells you whether to borrow, how much is
          safe, what rate is fair, and which EMI to accept — before you sign.
        </p>

        <div className="animate-rise-delay-2 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center justify-center rounded-md bg-[var(--teal)] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-[var(--teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
          >
            Start assessment
          </button>
          <p className="text-sm text-[var(--muted)]">
            Private · runs entirely on your device
          </p>
        </div>
      </div>

      <footer className="animate-rise-delay-3 mx-auto w-full max-w-lg border-t border-[var(--line)] pt-6">
        <ul className="grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2">
          <li>Should I borrow at all?</li>
          <li>Sanction vs safe carry</li>
          <li>Fair rate & all-in APR</li>
          <li>EMI you should agree to</li>
        </ul>
      </footer>
    </section>
  )
}
