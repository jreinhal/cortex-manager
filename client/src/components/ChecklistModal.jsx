import { motion } from 'framer-motion'
import { X, RefreshCw } from 'lucide-react'

export function ChecklistModal({ isOpen, onClose, content, loading, error, onRefresh, onCopy }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-title"
        className="glass-panel rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl"
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 id="checklist-title" className="font-bold text-white flex items-center gap-2">
            Quickstart Checklist
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 hover:text-white transition-ui"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onCopy}
              disabled={!content || loading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 hover:text-white transition-ui disabled:opacity-40"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
              aria-label="Close"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div
              className="flex items-center gap-3 text-cyan-400 text-sm"
              role="status"
              aria-live="polite"
            >
              <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
              Loading checklist…
            </div>
          )}
          {!loading && error && (
            <div
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"
              role="alert"
            >
              {error}
            </div>
          )}
          {!loading && !error && (
            <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
              {content || 'Checklist is empty.'}
            </pre>
          )}
        </div>
      </motion.div>
    </div>
  )
}
