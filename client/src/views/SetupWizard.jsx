import { useState } from 'react'
import { motion } from 'framer-motion'
import { FolderOpen, FolderInput, Check, Clock, RefreshCw } from 'lucide-react'
import { cn } from '../lib/utils'
import { SPRING_SMOOTH, API_BASE } from '../lib/constants'
import { apiFetch } from '../lib/api'
import { DirectoryBrowser } from '../components/DirectoryBrowser'

export function SetupWizard({ onComplete, defaultPath }) {
  const [reposRoot, setReposRoot] = useState(defaultPath || '')
  const [createStructure, setCreateStructure] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [validation, setValidation] = useState(null)
  const [showBrowser, setShowBrowser] = useState(false)

  const handleValidate = async (pathToValidate) => {
    if (!pathToValidate) return
    try {
      const res = await apiFetch(`/validate-path?path=${encodeURIComponent(pathToValidate)}`)
      const data = await res.json()
      setValidation(data)
    } catch (_e) {
      setValidation(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reposRoot, createStructure }),
      })
      const data = await res.json()
      if (data.success) {
        onComplete(data)
      } else {
        setError(data.error || 'Setup failed.')
      }
    } catch (_e) {
      setError('Failed to connect to server.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center app-shell">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SMOOTH}
        className="glass-panel rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-white mb-2">Welcome to CORTEX</h1>
          <p className="text-slate-400 text-sm">
            Let's configure your repository root directory.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Repository Root
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={reposRoot}
                onChange={(e) => {
                  setReposRoot(e.target.value)
                  setValidation(null)
                }}
                onBlur={() => handleValidate(reposRoot)}
                placeholder="e.g., C:\\repos or /home/user/repos"
                className="flex-1 bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 focus-visible:border-cyan-500/50 rounded-2xl px-4 py-3 text-sm focus-visible:outline-none transition-ui placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowBrowser(true)}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 transition-ui"
                aria-label="Browse directories"
              >
                <FolderOpen size={18} aria-hidden="true" />
              </button>
            </div>
            {validation && (
              <div
                className={cn(
                  'mt-2 text-xs flex items-center gap-1.5',
                  validation.exists ? 'text-emerald-400' : 'text-amber-400'
                )}
              >
                {validation.exists ? (
                  <>
                    <Check size={12} aria-hidden="true" /> Directory exists
                  </>
                ) : (
                  <>
                    <Clock size={12} aria-hidden="true" /> Directory will be created
                  </>
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={createStructure}
              onChange={(e) => setCreateStructure(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-5 h-5 rounded-md border border-slate-600 bg-slate-900 peer-checked:bg-cyan-500/20 peer-checked:border-cyan-500/50 flex items-center justify-center transition-ui">
              {createStructure && <Check size={14} className="text-cyan-400" aria-hidden="true" />}
            </div>
            <div>
              <span className="text-sm text-slate-200">Create folder structure</span>
              <p className="text-[11px] text-slate-500">
                Creates agents/, skills/, knowledge/, tools/, benchmarks/ subdirectories
              </p>
            </div>
          </label>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!reposRoot || loading}
            className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-white text-slate-900 font-bold text-sm transition-ui disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                Configuring…
              </>
            ) : (
              'Initialize CORTEX'
            )}
          </button>
        </form>

        <DirectoryBrowser
          isOpen={showBrowser}
          onClose={() => setShowBrowser(false)}
          onSelect={(path) => {
            setReposRoot(path)
            handleValidate(path)
          }}
          initialPath={reposRoot}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="fixed bottom-6 text-center w-full pointer-events-none"
      >
        <div className="flex items-center justify-center gap-3 text-slate-600 text-[10px] tracking-[0.25em] uppercase">
          <FolderInput size={14} aria-hidden="true" />
          Local-First AI Orchestration
        </div>
      </motion.div>
    </div>
  )
}
