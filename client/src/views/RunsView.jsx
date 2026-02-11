import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn, formatDuration } from '../lib/utils'
import { SPRING_SMOOTH } from '../lib/constants'
import { EmptyState } from '../components/EmptyState'

export function RunsView({ runs, apiFetch }) {
  const [selectedId, setSelectedId] = useState(runs[0]?.id || null)
  const [query, setQuery] = useState('')
  const [compareId, setCompareId] = useState('')
  const [exporting, setExporting] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    if (!selectedId && runs.length > 0) {
      setSelectedId(runs[0].id)
    }
  }, [runs, selectedId])

  const filtered = runs.filter((run) => {
    const search = query.trim().toLowerCase()
    if (!search) return true
    return (
      (run.goal || '').toLowerCase().includes(search) ||
      (run.agent?.name || '').toLowerCase().includes(search)
    )
  })

  const selected = filtered.find((run) => run.id === selectedId) || filtered[0]
  const compareRun = runs.find((run) => run.id === compareId)

  const delta =
    compareRun && selected
      ? {
          quality:
            (selected.metrics?.qualityScore ?? 0) - (compareRun.metrics?.qualityScore ?? 0),
          duration: (selected.durationMs ?? 0) - (compareRun.durationMs ?? 0),
          uncertainty:
            (selected.metrics?.uncertainty ?? 0) - (compareRun.metrics?.uncertainty ?? 0),
          resources: (selected.resources?.total ?? 0) - (compareRun.resources?.total ?? 0),
          cost:
            (selected.metrics?.costEstimated ?? selected.usage?.costEstimated ?? 0) -
            (compareRun.metrics?.costEstimated ?? compareRun.usage?.costEstimated ?? 0),
        }
      : null

  const matrix = selected?.decisionMatrix || {}
  const retrievalGate = matrix.retrievalGate?.enabled ? 'enabled' : 'disabled'
  const ragFusion = matrix.resourceSelection?.ragFusionUsed
    ? `used (${matrix.resourceSelection?.ragFusionVariants || 0} variants)`
    : 'not used'
  const hyde = matrix.resourceSelection?.hydeUsed ? 'used' : 'not used'
  const hybrid = matrix.resourceSelection?.hybridUsed ? 'enabled' : 'disabled'
  const vectorIndexLabel = matrix.resourceSelection?.vectorIndexUsed ? 'used' : 'not used'
  const lateInteraction = matrix.resourceSelection?.lateInteractionUsed ? 'used' : 'not used'
  const llmAgentMode = matrix.agentSelection?.rerankPolicy || 'n/a'
  const llmResourceMode = matrix.resourceSelection?.rerankPolicy || 'n/a'
  const agentRerankLabel = matrix.agentSelection?.rerankUsed
    ? matrix.agentSelection?.rerankAccepted
      ? 'used (accepted)'
      : 'used (ignored)'
    : `not used${matrix.agentSelection?.rerankReason ? ` (${matrix.agentSelection.rerankReason})` : ''}`
  const resourceRerankLabel = matrix.resourceSelection?.rerankUsed ? 'used' : 'not used'
  const perfTotal = selected?.performance?.totalMs ?? selected?.durationMs ?? 0
  const perfSpans = Array.isArray(selected?.performance?.spans) ? selected.performance.spans : []

  const planFileName = selected?.outputPath
    ? selected.outputPath.split(/[\\/]/).pop()
    : `cortex-run-${selected?.id || 'plan'}.md`

  const handleExport = async (type) => {
    if (!selected || !apiFetch) return
    setExporting(type)
    setExportError('')
    try {
      const endpoint =
        type === 'plan'
          ? `/runs/${selected.id}/plan`
          : `/runs/${selected.id}/export?includeOutput=true`
      const res = await apiFetch(endpoint)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Export failed')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = type === 'plan' ? planFileName : `cortex-run-${selected.id}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setExportError(e.message || 'Export failed')
    }
    setExporting('')
  }

  return (
    <motion.div
      key="runs"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={SPRING_SMOOTH}
      className="grid lg:grid-cols-3 gap-6"
    >
      <div className="glass-panel rounded-3xl p-6 h-[calc(100vh-220px)] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">
            Run History
          </div>
          <span className="text-[10px] text-slate-500">{runs.length} total</span>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search runs…"
          className="mb-4 w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50"
        />
        <div className="space-y-3 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <EmptyState title="No runs match" subtitle="Adjust your search or spawn a new run." />
          )}
          {filtered.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedId(run.id)}
              className={cn(
                'w-full text-left p-3 rounded-2xl border transition-ui',
                run.id === selected?.id
                  ? 'bg-slate-800/60 border-cyan-500/40'
                  : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700'
              )}
            >
              <div className="text-sm text-slate-200 truncate">{run.goal}</div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                <span>Quality {run.metrics?.qualityScore ?? '—'}</span>
                <span>{formatDuration(run.durationMs)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        {!selected && (
          <EmptyState
            title="Select a run"
            subtitle="Choose a run from the list to inspect its trace."
          />
        )}

        {selected && (
          <>
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">
                  Run Detail
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">{selected.id}</span>
                  {selected.metrics?.issues?.length > 0 && (
                    <span
                      className="px-2 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-semibold uppercase tracking-[0.2em]"
                      title={selected.metrics.issues.join(' • ')}
                    >
                      {selected.metrics.issues.length > 1
                        ? `${selected.metrics.issues.length} issues`
                        : selected.metrics.issues[0]}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleExport('json')}
                    disabled={exporting === 'json'}
                    className="px-3 py-1.5 rounded-2xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 text-xs border border-slate-700/60 disabled:opacity-50"
                  >
                    {exporting === 'json' ? 'Exporting...' : 'Export JSON'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('plan')}
                    disabled={!selected.outputPath || exporting === 'plan'}
                    className="px-3 py-1.5 rounded-2xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 text-xs border border-slate-700/60 disabled:opacity-50"
                  >
                    {exporting === 'plan' ? 'Exporting...' : 'Download plan'}
                  </button>
                </div>
              </div>
              <div className="text-lg font-semibold text-white leading-snug mb-4">
                {selected.goal}
              </div>
              <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-300">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Agent</div>
                  <div>{selected.agent?.name || selected.agent?.id || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Format</div>
                  <div>{selected.format || 'universal'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Duration</div>
                  <div>{formatDuration(selected.durationMs)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">
                    Tokens (est)
                  </div>
                  <div>{selected.metrics?.tokensEstimated ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">
                    Cost (est)
                  </div>
                  <div>
                    {selected.metrics?.costEstimated ??
                      selected.usage?.costEstimated ??
                      '—'}{' '}
                    {selected.metrics?.currency || selected.usage?.currency || ''}
                  </div>
                </div>
              </div>
              {exportError && (
                <div className="mt-4 text-xs text-red-300 border border-red-500/30 bg-red-500/10 rounded-xl px-3 py-2">
                  {exportError}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">
                Performance Timeline
              </div>
              {!perfSpans.length && (
                <EmptyState
                  title="No performance trace"
                  subtitle="Run spans will appear after new spawns."
                />
              )}
              {perfSpans.length > 0 && (
                <div className="space-y-3">
                  {perfSpans.map((span, index) => {
                    const duration = span.durationMs || 0
                    const percent =
                      perfTotal > 0
                        ? Math.min(100, Math.max(4, (duration / perfTotal) * 100))
                        : 0
                    return (
                      <div
                        key={`${span.name}-${index}`}
                        className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/60"
                      >
                        <div className="flex items-center justify-between text-sm text-slate-200">
                          <span className="capitalize">{span.name.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-slate-500">
                            {formatDuration(duration)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-slate-950/70">
                          <div
                            className="h-2 rounded-full bg-cyan-500/70"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">
                  Run Comparison
                </div>
                <select
                  value={compareId}
                  onChange={(e) => setCompareId(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-200"
                >
                  <option value="">Select baseline</option>
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {(run.goal || 'Untitled run').substring(0, 50)}
                    </option>
                  ))}
                </select>
              </div>
              {!delta && (
                <EmptyState
                  title="Pick a baseline run"
                  subtitle="Compare quality, duration, and uncertainty."
                />
              )}
              {delta && (
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div
                    className={cn(
                      'p-3 rounded-2xl border',
                      delta.quality >= 0
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-red-500/30 bg-red-500/10 text-red-200'
                    )}
                  >
                    Quality Δ {delta.quality >= 0 ? '+' : ''}
                    {delta.quality}
                  </div>
                  <div
                    className={cn(
                      'p-3 rounded-2xl border',
                      delta.duration <= 0
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    )}
                  >
                    Duration Δ {delta.duration >= 0 ? '+' : ''}
                    {formatDuration(delta.duration)}
                  </div>
                  <div
                    className={cn(
                      'p-3 rounded-2xl border',
                      delta.uncertainty <= 0
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    )}
                  >
                    Uncertainty Δ {delta.uncertainty >= 0 ? '+' : ''}
                    {Math.round(delta.uncertainty * 100)}%
                  </div>
                  <div
                    className={cn(
                      'p-3 rounded-2xl border',
                      delta.resources >= 0
                        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                        : 'border-slate-700 bg-slate-800/60 text-slate-300'
                    )}
                  >
                    Resources Δ {delta.resources >= 0 ? '+' : ''}
                    {delta.resources}
                  </div>
                  <div
                    className={cn(
                      'p-3 rounded-2xl border',
                      delta.cost <= 0
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    )}
                  >
                    Cost Δ {delta.cost >= 0 ? '+' : ''}
                    {delta.cost.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {selected.git && (
              <div className="glass-panel rounded-3xl p-6">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">
                  Code Context
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-300">
                  <div>
                    Branch: <span className="text-slate-100">{selected.git.branch || '—'}</span>
                  </div>
                  <div>
                    Commit:{' '}
                    <span className="text-slate-100">
                      {selected.git.commit?.slice(0, 8) || '—'}
                    </span>
                  </div>
                  <div>
                    Status:{' '}
                    <span className="text-slate-100">
                      {selected.git.dirty ? 'Dirty' : 'Clean'}
                    </span>
                  </div>
                  <div>
                    Message:{' '}
                    <span className="text-slate-100">{selected.git.message || '—'}</span>
                  </div>
                </div>
                {selected.git.changedFiles?.length > 0 && (
                  <div className="mt-4 text-xs text-slate-500">
                    Changed files: {selected.git.changedFiles.slice(0, 6).join(' • ')}
                  </div>
                )}
                {selected.git.diffStat && (
                  <pre className="mt-4 text-xs text-slate-400 whitespace-pre-wrap bg-slate-900/60 border border-slate-800/60 rounded-2xl p-3">
                    {selected.git.diffStat}
                  </pre>
                )}
              </div>
            )}

            <div className="glass-panel rounded-3xl p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">
                Decision Matrix
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-300">
                <div>
                  Retrieval gate: <span className="text-slate-100">{retrievalGate}</span>
                </div>
                <div>
                  RAG-Fusion: <span className="text-slate-100">{ragFusion}</span>
                </div>
                <div>
                  HyDE fallback: <span className="text-slate-100">{hyde}</span>
                </div>
                <div>
                  Hybrid retrieval: <span className="text-slate-100">{hybrid}</span>
                </div>
                <div>
                  Semantic index: <span className="text-slate-100">{vectorIndexLabel}</span>
                </div>
                <div>
                  Late-interaction rerank:{' '}
                  <span className="text-slate-100">{lateInteraction}</span>
                </div>
                <div>
                  LLM agent mode: <span className="text-slate-100">{llmAgentMode}</span>
                </div>
                <div>
                  LLM agent router: <span className="text-slate-100">{agentRerankLabel}</span>
                </div>
                <div>
                  LLM resource mode: <span className="text-slate-100">{llmResourceMode}</span>
                </div>
                <div>
                  Resource rerank: <span className="text-slate-100">{resourceRerankLabel}</span>
                </div>
                <div>
                  Uncertainty:{' '}
                  <span className="text-slate-100">
                    {Math.round((matrix.uncertainty?.score || 0) * 100)}%
                  </span>
                </div>
                <div>
                  Requires review:{' '}
                  <span className="text-slate-100">
                    {selected.metrics?.requiresReview ? 'yes' : 'no'}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">
                Trace
              </div>
              {selected.trace?.steps?.length ? (
                <div className="space-y-3">
                  {selected.trace.steps.map((step, index) => (
                    <div
                      key={`${step.name}-${index}`}
                      className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/60"
                    >
                      <div className="text-sm text-slate-200">{step.name}</div>
                      {step.data && (
                        <div className="text-xs text-slate-500 mt-2">
                          {Object.entries(step.data).map(([key, value]) => (
                            <span key={key} className="mr-3">
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No trace steps"
                  subtitle="Spawn a new run to populate trace data."
                />
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
