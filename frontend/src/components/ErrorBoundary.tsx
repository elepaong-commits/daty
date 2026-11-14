import { Component, type ReactNode } from 'react'
import { useT } from '../lib/i18n'
import { reportError } from '../lib/reportError'

function CrashScreen() {
  const t = useT()
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
      <p className="text-[14px] text-muted">{t.common.crashed}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="h-[44px] rounded-full bg-brand-strong px-6 text-[14px] font-bold text-white hover:bg-brand-deep"
      >
        {t.common.reload}
      </button>
    </div>
  )
}

/** A render error anywhere shows a reload screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
    reportError(error)
  }

  render() {
    return this.state.crashed ? <CrashScreen /> : this.props.children
  }
}
