import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'

export function SpawnTimeline({ steps }) {
  const [expanded, setExpanded] = useState(true)
  const totalSteps = steps.length
  const doneCount = steps.filter((step) => step.done).length
  const hasError = steps.some((step) => step.error)
  const isComplete = totalSteps > 0 && doneCount === totalSteps && !hasError
  const currentStep = steps.find((step) => !step.done && !step.error)
  const rawProgress = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0
  const displayProgress = isComplete ? 100 : Math.max(8, rawProgress)
  const totalDuration = steps.reduce((sum, step) => sum + (step.durationMs || 0), 0)
  const hasTiming = steps.some(
    (step) => step.durationMs !== null && step.durationMs !== undefined
  )

  useEffect(() => {
    if (steps.some((step) => !step.done)) {
      setExpanded(true)
    }
  }, [steps])

  return (
    <div className="glassbox-accordion" role="status" aria-live="polite" data-testid="spawn-steps">
      <button
        type="button"
        className={cn('glassbox-toggle', expanded && 'expanded')}
        onClick={() => setExpanded((open) => !open)}
      >
        <ChevronDown size={14} aria-hidden="true" />
        <span className="font-semibold">View Generation Chain ({totalSteps} steps)</span>
        <span className="glassbox-toggle-meta">
          {doneCount}/{totalSteps} · {displayProgress}%
        </span>
        {hasTiming && <span className="glassbox-total-duration">{totalDuration}ms</span>}
      </button>
      <div className={cn('glassbox-content', expanded && 'visible')}>
        <div className="space-y-2">
          <div
            className="relative h-2 w-full rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/50"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayProgress}
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                isComplete
                  ? 'bg-emerald-400'
                  : hasError
                    ? 'bg-red-400'
                    : 'bg-cyan-400 animate-pulse'
              )}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          {!isComplete && !hasError && (
            <div className="text-[11px] text-slate-500">
              {currentStep ? `Now: ${currentStep.label || currentStep.text}` : 'Working…'} This can
              take a few minutes for large prompts.
            </div>
          )}
          {hasError && (
            <div className="text-[11px] text-red-400">An error occurred. Check System Logs.</div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {steps.map((step, i) => (
            <div key={step.key || i} className="glassbox-step">
              <div className={cn('glassbox-step-icon', step.type || '')}>{i + 1}</div>
              <div className="glassbox-step-content">
                <div className="glassbox-step-label">
                  {step.label || step.text}
                  {step.durationMs !== null && step.durationMs !== undefined && (
                    <span className="glassbox-step-duration">
                      {Math.max(0, Math.round(step.durationMs))}ms
                    </span>
                  )}
                </div>
                {step.detail && <div className="glassbox-step-detail">{step.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
