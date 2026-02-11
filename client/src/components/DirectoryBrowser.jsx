import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FolderInput, X, ChevronUp, RefreshCw, HardDrive, Folder } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { API_BASE } from '../lib/constants'

export function DirectoryBrowser({ isOpen, onClose, onSelect, initialPath }) {
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [parentPath, setParentPath] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchDirectory = async (pathToFetch = '', fallbackToRoot = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = pathToFetch
        ? `${API_BASE}/browse?path=${encodeURIComponent(pathToFetch)}`
        : `${API_BASE}/browse`
      const res = await apiFetch(url)
      const data = await res.json()
      if (data.error) {
        if (fallbackToRoot === false && pathToFetch) {
          return fetchDirectory('', true)
        }
        setError(data.error)
      } else {
        setCurrentPath(data.path)
        setItems(data.items || [])
        setParentPath(data.parent)
      }
    } catch (_e) {
      setError('Failed to browse directory. Check permissions or try a different path.')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) {
      fetchDirectory(initialPath || '')
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-browser-title"
        className="glass-panel rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl overscroll-contain"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3
            id="directory-browser-title"
            className="font-bold text-white flex items-center gap-2"
          >
            <FolderInput size={20} className="text-cyan-400" aria-hidden="true" />
            Select Directory
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Current Path */}
        <div className="px-4 py-2 bg-slate-900/30 border-b border-white/5">
          <p className="text-xs text-slate-400 font-mono truncate">
            {currentPath || 'Select a drive'}
          </p>
        </div>

        {/* Navigation */}
        {parentPath !== null && (
          <button
            type="button"
            onClick={() => fetchDirectory(parentPath)}
            className="flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-slate-300 border-b border-white/5"
            aria-label="Go to parent directory"
          >
            <ChevronUp size={16} aria-hidden="true" />
            <span>Parent</span>
          </button>
        )}

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="flex items-center justify-center py-8"
              role="status"
              aria-live="polite"
            >
              <RefreshCw size={24} className="animate-spin text-cyan-400" aria-hidden="true" />
              <span className="sr-only">Loading directories…</span>
            </div>
          ) : error ? (
            <div className="p-4 text-red-400 text-sm" role="alert">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-slate-500 text-sm text-center">No subdirectories</div>
          ) : (
            items.map((item) => (
              <button
                key={item.path}
                onClick={() => fetchDirectory(item.path)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-slate-300 w-full text-left border-b border-white/5 min-w-0"
              >
                {item.name.includes(':') ? (
                  <HardDrive size={18} className="text-cyan-400" aria-hidden="true" />
                ) : (
                  <Folder size={18} className="text-yellow-400" aria-hidden="true" />
                )}
                <span className="font-mono text-sm truncate">{item.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-ui"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSelect(currentPath)
              onClose()
            }}
            disabled={!currentPath}
            className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold transition-ui"
          >
            Select This Folder
          </button>
        </div>
      </motion.div>
    </div>
  )
}
