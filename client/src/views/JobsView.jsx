import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, formatDuration } from '../lib/utils'
import { SPRING_SMOOTH } from '../lib/constants'
import { EmptyState } from '../components/EmptyState'

export function JobsView({ jobs, onCancelJob }) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = jobs.find((j) => j.id === selectedId) || null

  return (
    <motion.div
      key="jobs"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={SPRING_SMOOTH}
    >
      {jobs.length === 0 ? (
        <EmptyState message="No background jobs have been queued." />
      ) : (
        <div className="flex gap-6">
          <div className="w-80 shrink-0 space-y-2 max-h-[78vh] overflow-y-auto pr-1">
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedId(job.id)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-2xl transition-ui border',
                  selectedId === job.id
                    ? 'bg-white/5 border-white/10'
                    : 'bg-transparent border-transparent hover:bg-white/[0.03]'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-300 font-semibold truncate max-w-[180px]">
                    {job.type}
                  </span>
                  <span
                    className={cn(
                      'tag-inline text-[10px]',
                      job.status === 'completed'
                        ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10'
                        : job.status === 'failed'
                          ? 'text-red-300 border-red-500/20 bg-red-500/10'
                          : job.status === 'running'
                            ? 'text-cyan-300 border-cyan-500/20 bg-cyan-500/10'
                            : 'tag-inline-muted'
                    )}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 glass-panel rounded-3xl p-6 min-h-[300px]">
            {selected ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-100">{selected.type}</h3>
                    {(selected.status === 'pending' || selected.status === 'running') && (
                      <button
                        type="button"
                        onClick={() => onCancelJob(selected.id)}
                        className="px-4 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/20 transition-ui"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500">Status:</span>{' '}
                      <span className="text-slate-200">{selected.status}</span>
                    </div>
                    {selected.createdAt && (
                      <div>
                        <span className="text-slate-500">Created:</span>{' '}
                        <span className="text-slate-200">
                          {new Date(selected.createdAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selected.durationMs != null && (
                      <div>
                        <span className="text-slate-500">Duration:</span>{' '}
                        <span className="text-slate-200">{formatDuration(selected.durationMs)}</span>
                      </div>
                    )}
                    {selected.error && (
                      <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                        {selected.error}
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                Select a job to view details
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
