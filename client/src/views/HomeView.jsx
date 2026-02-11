import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn, formatDuration } from '../lib/utils'
import { SPRING_SMOOTH } from '../lib/constants'
import { EmptyState } from '../components/EmptyState'

export function HomeView({
  repos,
  runs,
  datasets,
  evaluations,
  savedPrompts,
  sessions,
  onNavigate,
  onOpenChecklist,
  appConfig,
  observabilitySummary,
  jobs,
}) {
  const recentRuns = runs.slice(0, 5)
  const latestRun = runs[0] || null
  const configuredModel = appConfig?.config?.llm?.model || '—'

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={SPRING_SMOOTH}
      className="space-y-8"
    >
      {/* Welcome Banner */}
      <div className="glass-panel rounded-3xl px-8 py-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-white mb-1">
            Command Center
          </h2>
          <p className="text-sm text-slate-400">
            Operational overview of runs, evaluations, and knowledge coverage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenChecklist}
            className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-ui"
          >
            <Check size={14} aria-hidden="true" />
            Pre-Commit Checklist
          </button>
          <button
            type="button"
            onClick={() => onNavigate('agents')}
            className="px-6 py-2 rounded-2xl bg-slate-100 hover:bg-white text-slate-900 font-bold text-sm transition-ui shadow-lg shadow-white/5"
          >
            New Spawn
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Runs', value: runs.length, accent: 'text-cyan-400' },
          { label: 'Datasets', value: datasets.length, accent: 'text-emerald-400' },
          { label: 'Evaluations', value: evaluations.length, accent: 'text-purple-400' },
          { label: 'Repos', value: repos.length, accent: 'text-yellow-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-panel rounded-2xl px-5 py-4"
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold mb-2">
              {stat.label}
            </div>
            <div className={cn('text-3xl font-semibold tabular-nums', stat.accent)}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Info Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold mb-2">
            Model
          </div>
          <div className="text-sm text-slate-200 font-semibold truncate">{configuredModel}</div>
        </div>
        <div className="glass-panel rounded-2xl px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold mb-2">
            Saved Prompts
          </div>
          <div className="text-sm text-slate-200 font-semibold">{savedPrompts.length}</div>
        </div>
        <div className="glass-panel rounded-2xl px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold mb-2">
            Sessions
          </div>
          <div className="text-sm text-slate-200 font-semibold">{sessions.length}</div>
        </div>
        <div className="glass-panel rounded-2xl px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold mb-2">
            Queued Jobs
          </div>
          <div className="text-sm text-slate-200 font-semibold">
            {jobs.filter((j) => j.status === 'pending' || j.status === 'running').length}
          </div>
        </div>
      </div>

      {/* Observability */}
      {observabilitySummary && (
        <div className="glass-panel rounded-2xl px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold mb-3">
            Observability
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Total Tokens:</span>{' '}
              <span className="text-slate-200 font-semibold tabular-nums">
                {observabilitySummary.totalTokens?.toLocaleString() ?? '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Avg Latency:</span>{' '}
              <span className="text-slate-200 font-semibold tabular-nums">
                {observabilitySummary.avgLatencyMs != null
                  ? `${Math.round(observabilitySummary.avgLatencyMs)}ms`
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Est. Cost:</span>{' '}
              <span className="text-slate-200 font-semibold tabular-nums">
                {observabilitySummary.estimatedCost != null
                  ? `$${observabilitySummary.estimatedCost.toFixed(4)}`
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Errors:</span>{' '}
              <span className="text-slate-200 font-semibold tabular-nums">
                {observabilitySummary.errorCount ?? 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Runs */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">Recent Runs</h3>
          {runs.length > 5 && (
            <button
              type="button"
              onClick={() => onNavigate('runs')}
              className="text-xs text-slate-400 hover:text-slate-200 transition-ui"
            >
              View all →
            </button>
          )}
        </div>
        {recentRuns.length === 0 ? (
          <EmptyState message="No runs recorded yet. Spawn your first agent to begin." />
        ) : (
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-200 truncate max-w-md">{run.goal}</div>
                  <div className="text-[10px] text-slate-500">
                    {run.timestamp ? new Date(run.timestamp).toLocaleString() : ''}
                    {run.durationMs != null && ` · ${formatDuration(run.durationMs)}`}
                  </div>
                </div>
                <span className="tag-inline tag-inline-muted text-[10px] ml-3">
                  {run.format || 'universal'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
