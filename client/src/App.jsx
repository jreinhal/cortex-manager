import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import {
  Terminal, Database, Cpu, Wrench,
  BarChart3, RefreshCw, CheckCircle2,
  ChevronRight, GitBranch, Folder,
  Settings, FolderOpen, Check, X, Clock,
  History, HardDrive,
  ChevronUp, FolderInput, Star, Trash2
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import brainIcon from './assets/brain.png'

const API_BASE = 'http://localhost:3001/api';

// --- Utils ---
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  const precision = i >= 2 ? 1 : 0;
  return `${value.toFixed(precision)} ${sizes[i]}`;
}

// --- Configuration ---
const CATEGORY_CONFIG = {
  agents: { icon: Cpu, color: 'text-purple-400', desc: "Autonomous systems that perceive, reason, and act." },
  skills: { icon: Terminal, color: 'text-yellow-400', desc: "Modular specific capabilities and functions." },
  knowledge: { icon: Database, color: 'text-blue-400', desc: "Information libraries, reasoning patterns, and data." },
  tools: { icon: Wrench, color: 'text-emerald-400', desc: "Utilities, servers, and infrastructure helpers." },
  benchmarks: { icon: BarChart3, color: 'text-red-400', desc: "Standardized tests and metrics for evaluation." }
};

const DEFAULT_CATEGORY = { icon: Folder, color: 'text-slate-400', desc: "General repository collection." };
const VIEW_KEYS = ['agents', 'repos', 'logs', 'settings'];

// ==========================================
// Setup Wizard Component
// ==========================================
// Directory Browser Component
function DirectoryBrowser({ isOpen, onClose, onSelect, initialPath }) {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [parentPath, setParentPath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDirectory = async (pathToFetch = '', fallbackToRoot = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = pathToFetch
        ? `${API_BASE}/browse?path=${encodeURIComponent(pathToFetch)}`
        : `${API_BASE}/browse`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        // If path doesn't exist and we haven't tried root yet, fall back to root
        if (fallbackToRoot === false && pathToFetch) {
          return fetchDirectory('', true);
        }
        setError(data.error);
      } else {
        setCurrentPath(data.path);
        setItems(data.items || []);
        setParentPath(data.parent);
      }
    } catch (e) {
      setError('Failed to browse directory. Check permissions or try a different path.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      // Start from initialPath if provided, will fallback to root if path doesn't exist
      fetchDirectory(initialPath || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-browser-title"
        className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl overscroll-contain"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 id="directory-browser-title" className="font-bold text-white flex items-center gap-2">
            <FolderInput size={20} className="text-cyan-400" aria-hidden="true" />
            Select Directory
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Current Path */}
        <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
          <p className="text-xs text-slate-400 font-mono truncate">
            {currentPath || 'Select a drive'}
          </p>
        </div>

        {/* Navigation */}
        {parentPath !== null && (
          <button
            type="button"
            onClick={() => fetchDirectory(parentPath)}
            className="flex items-center gap-2 px-4 py-3 hover:bg-slate-800 text-slate-300 border-b border-slate-800"
            aria-label="Go to parent directory"
          >
            <ChevronUp size={16} aria-hidden="true" />
            <span>Parent</span>
          </button>
        )}

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
              <RefreshCw size={24} className="animate-spin text-cyan-400" aria-hidden="true" />
              <span className="sr-only">Loading directories…</span>
            </div>
          ) : error ? (
            <div className="p-4 text-red-400 text-sm" role="alert">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-slate-500 text-sm text-center">No subdirectories</div>
          ) : (
            items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => fetchDirectory(item.path)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800 text-slate-300 w-full text-left border-b border-slate-800/50 min-w-0"
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
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-ui"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSelect(currentPath);
              onClose();
            }}
            disabled={!currentPath}
            className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold transition-ui"
          >
            Select This Folder
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SetupWizard({ onComplete, defaultPath }) {
  const [reposRoot, setReposRoot] = useState(defaultPath || '');
  const [createStructure, setCreateStructure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validation, setValidation] = useState(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const reposRootInputRef = useRef(null);

  const validatePath = async (path) => {
    if (!path) {
      setValidation(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/validate-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const data = await res.json();
      setValidation(data);
    } catch (e) {
      setValidation({ valid: false, errors: ['Failed to validate path. Check the directory and try again.'] });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => validatePath(reposRoot), 500);
    return () => clearTimeout(timer);
  }, [reposRoot]);

  const handleSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reposRoot, createStructure })
      });
      const data = await res.json();
      if (data.success) {
        onComplete(data);
      } else {
        setError(data.error || 'Setup failed. Check the path and try again.');
        reposRootInputRef.current?.focus();
      }
    } catch (e) {
      setError('Failed to connect to server. Start the CORTEX backend and try again.');
      reposRootInputRef.current?.focus();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0C15] p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full"
      >
        <div className="glass-panel p-1 rounded-[2.5rem] bg-slate-800/40 border border-slate-700/30 shadow-2xl backdrop-blur-3xl">
          <div className="bg-slate-950/80 rounded-[2.2rem] p-10">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 rounded-2xl p-4 border border-white/10 shadow-2xl">
                <img
                  src={brainIcon}
                  alt="Cortex"
                  width="48"
                  height="48"
                  fetchpriority="high"
                  className="w-12 h-12 object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Welcome to CORTEX</h1>
                <p className="text-slate-400">Set up your workspace</p>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8 p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
              <p className="text-slate-300 text-sm leading-relaxed">
                CORTEX needs a directory to store your reference repositories. This is where your Agents, Skills, Knowledge, and Tools will live.
              </p>
            </div>

            {/* Path Input */}
            <div className="mb-6">
              <label htmlFor="repos-root" className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">
                Repository Root Directory
              </label>
              <div className="flex gap-2 rounded-2xl focus-within:ring-2 focus-within:ring-cyan-500/20">
                <div className="relative flex-1">
                  <FolderOpen size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                  <input
                    id="repos-root"
                    name="reposRoot"
                    type="text"
                    value={reposRoot}
                    onChange={(e) => setReposRoot(e.target.value)}
                    placeholder="/path/to/reference-repos…"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    ref={reposRootInputRef}
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50 focus-visible:ring-4 focus-visible:ring-cyan-500/10 transition-ui font-mono text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowBrowser(true)}
                  className="px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-slate-300 transition-ui flex items-center gap-2"
                  title="Browse directories"
                  aria-label="Browse directories"
                >
                  <FolderInput size={20} aria-hidden="true" />
                </button>
              </div>

              {/* Validation Status */}
              {validation && (
                <div className={cn(
                  "mt-3 p-3 rounded-xl text-sm flex items-start gap-2",
                  validation.valid
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                )} role="status" aria-live="polite">
                  {validation.valid ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                  <div>
                    {validation.valid ? (
                      <>
                        Path is valid
                        {validation.exists && <span className="text-slate-400"> (directory exists)</span>}
                        {validation.hasStructure && <span className="text-emerald-300"> with CORTEX structure</span>}
                      </>
                    ) : (
                      validation.errors?.join(', ')
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Create Structure Checkbox */}
            <label className="flex items-center gap-3 mb-8 cursor-pointer group">
              <div className={cn(
                "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-ui",
                createStructure
                  ? "bg-cyan-500 border-cyan-500"
                  : "border-slate-600 group-hover:border-slate-500"
              )}>
                {createStructure && <Check size={14} className="text-white" aria-hidden="true" />}
              </div>
              <input
                id="create-structure"
                name="createStructure"
                type="checkbox"
                checked={createStructure}
                onChange={(e) => setCreateStructure(e.target.checked)}
                className="sr-only"
              />
              <span className="text-slate-300 text-sm">
                Create directory structure if it doesn't exist
              </span>
            </label>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm" role="alert">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSetup}
              disabled={loading || !reposRoot || (validation && !validation.valid)}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 px-6 rounded-2xl transition-ui flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:shadow-none"
            >
                {loading ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" aria-hidden="true" />
                    Setting up…
                  </>
                ) : (
                  <>
                    <Check size={20} aria-hidden="true" />
                    Complete Setup
                  </>
              )}
            </button>

            {/* Help Text */}
            <p className="text-center text-slate-500 text-xs mt-6">
              You can change this later in Settings
            </p>
          </div>
        </div>
      </motion.div>

      {/* Directory Browser Modal */}
      <DirectoryBrowser
        isOpen={showBrowser}
        onClose={() => setShowBrowser(false)}
        onSelect={(path) => setReposRoot(path)}
        initialPath={reposRoot}
      />
    </div>
  );
}

// ==========================================
// Settings Panel Component
// ==========================================
function SettingsPanel({ config, onSave, onClose }) {
  // config is the full API response: { config: { reposRoot, ... }, system, isFirstRun }
  const [reposRoot, setReposRoot] = useState(config?.config?.reposRoot || '');
  const [loading, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const reposRootInputRef = useRef(null);

  const handleSave = async () => {
    // Guard against empty submissions
    if (!reposRoot || !reposRoot.trim()) {
      setError('Repository root path cannot be empty');
      reposRootInputRef.current?.focus();
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reposRoot: reposRoot.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          onSave(data.config);
        }, 1000);
      } else {
        setError(data.error || 'Failed to save settings. Check the path and try again.');
        reposRootInputRef.current?.focus();
      }
    } catch (e) {
      console.error('Save failed:', e);
      setError('Failed to save settings. Check the connection and try again.');
      reposRootInputRef.current?.focus();
    }
    setSaving(false);
  };

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="max-w-3xl mx-auto"
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Settings</h2>
          <p className="text-slate-400">Configure CORTEX preferences</p>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-8 space-y-8">
        {/* Repos Root */}
        <div>
          <label htmlFor="settings-repos-root" className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            Repository Root Directory
          </label>
          <div className="flex gap-3 rounded-2xl focus-within:ring-2 focus-within:ring-cyan-500/20">
            <input
              id="settings-repos-root"
              name="settingsReposRoot"
              type="text"
              value={reposRoot}
              onChange={(e) => setReposRoot(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              ref={reposRootInputRef}
              data-testid="settings-repos-root"
              className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50 font-mono text-sm"
            />
            <button
              onClick={handleSave}
              disabled={loading || saved}
              data-testid="settings-save"
              className={cn(
                "px-6 py-4 rounded-2xl font-bold transition-ui flex items-center gap-2",
                saved
                  ? "bg-emerald-500 text-white"
                  : "bg-cyan-500 hover:bg-cyan-400 text-white"
              )}
            >
              {saved ? <Check size={20} aria-hidden="true" /> : loading ? <RefreshCw size={20} className="animate-spin" aria-hidden="true" /> : null}
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-2">
            This is where CORTEX looks for Agents, Skills, Knowledge, and Tools
          </p>
        {error && (
          <p className="text-red-400 text-sm mt-2" role="alert" data-testid="settings-error">{error}</p>
        )}
      </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// Spawn Status Timeline Component
// ==========================================
function SpawnTimeline({ steps }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {steps.map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-3"
        >
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-xs",
            step.done
              ? "bg-emerald-500/20 text-emerald-400"
              : step.error
                ? "bg-red-500/20 text-red-400"
                : "bg-cyan-500/20 text-cyan-400"
          )}>
            {step.done ? <Check size={14} aria-hidden="true" /> : step.error ? <X size={14} aria-hidden="true" /> : <RefreshCw size={14} className="animate-spin" aria-hidden="true" />}
          </div>
          <span className={cn(
            "text-sm",
            step.done ? "text-slate-400" : step.error ? "text-red-400" : "text-slate-200"
          )}>
            {step.text}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

// ==========================================
// Main Components
// ==========================================

function StatCard({ title, count, sizeLabel, icon: Icon, color, delay, testId }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      data-testid={testId}
      className="glass-card p-6 rounded-3xl relative overflow-hidden h-full border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl shadow-xl"
    >
      <div className={cn("absolute -right-4 -top-4 w-32 h-32 rounded-full opacity-10 blur-3xl transition-opacity", color.replace('text-', 'bg-'))} />

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className={cn("p-3 rounded-2xl w-fit mb-3", color.replace('text-', 'bg-').replace('400', '500/10'))}>
          <Icon size={24} className={color} aria-hidden="true" />
        </div>

        <div>
          <div className="text-4xl font-bold text-slate-100 tracking-tight tabular-nums">{count}</div>
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mt-2">{title}</div>
          <div className="text-slate-500 text-[11px] font-medium mt-2" data-testid={testId ? `${testId}-size` : undefined}>
            Size {sizeLabel}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function OrchestratorView({ onSpawn, loading, result, sessions, onDirtyChange }) {
  const [goal, setGoal] = useState('');
  const [format, setFormat] = useState('universal');
  const [spawnSteps, setSpawnSteps] = useState([]);
  const [copied, setCopied] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  // Fetch saved prompts on mount
  useEffect(() => {
    fetchSavedPrompts();
  }, []);

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(Boolean(goal));
    }
  }, [goal, onDirtyChange]);

  const fetchSavedPrompts = async () => {
    try {
      const res = await fetch(`${API_BASE}/prompts`);
      const data = await res.json();
      setSavedPrompts(data);
    } catch (e) {
      console.error('Failed to fetch saved prompts:', e);
    }
  };

  const handleSavePrompt = async () => {
    if (!goal) return;
    try {
      const res = await fetch(`${API_BASE}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: promptTitle || 'Untitled', query: goal })
      });
      const data = await res.json();
      if (data.success) {
        setSavedPrompts(prev => [data.prompt, ...prev]);
        setShowSaveModal(false);
        setPromptTitle('');
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
    } catch (e) {
      console.error('Failed to save prompt:', e);
    }
  };

  const handleDeletePrompt = async (id) => {
    const target = savedPrompts.find((prompt) => prompt.id === id);
    const label = target?.title ? `“${target.title}”` : 'this prompt';
    if (!window.confirm(`Delete ${label}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/prompts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSavedPrompts(prev => prev.filter(p => p.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete prompt:', e);
    }
  };

  const handleUsePrompt = (query) => {
    setGoal(query);
  };

  const handleSpawn = async () => {
    if (!goal) return;

    // Initialize timeline
    setSpawnSteps([
      { text: 'Analyzing goal keywords…', done: false }
    ]);

    // Simulate progress (actual progress comes from backend)
    setTimeout(() => setSpawnSteps(s => [...s.slice(0, 1).map(x => ({ ...x, done: true })), { text: 'Selecting best agent…', done: false }]), 300);
    setTimeout(() => setSpawnSteps(s => [...s.slice(0, 2).map(x => ({ ...x, done: true })), { text: 'Searching knowledge base…', done: false }]), 600);
    setTimeout(() => setSpawnSteps(s => [...s.slice(0, 3).map(x => ({ ...x, done: true })), { text: 'Generating flight plan…', done: false }]), 900);

    await onSpawn(goal, format);

    // Mark all done
    setSpawnSteps(s => s.map(x => ({ ...x, done: true })));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReuseSession = (sessionGoal) => {
    setGoal(sessionGoal);
  };

  return (
    <motion.div
      key="agents"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="max-w-6xl mx-auto space-y-8"
    >
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Agent Factory</h1>
        <p className="text-slate-400 text-lg">Spawn specialized autonomous agents using natural language.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-panel p-1 rounded-[2.5rem] bg-slate-800/40 border border-slate-700/30 shadow-2xl backdrop-blur-3xl">
            <div className="bg-slate-950/60 rounded-[2.2rem] p-8 h-full relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-slate-800/20 rounded-full blur-3xl -z-10 transition-opacity group-hover:opacity-100 opacity-50 pointer-events-none" />

              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <label htmlFor="goal-input" className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Describe the outcome</label>
                <div className="flex items-center gap-2">
                  <label htmlFor="format-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Format</label>
                  <select
                    id="format-select"
                    name="format"
                    autoComplete="off"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    data-testid="format-select"
                    className="bg-slate-900/70 border border-slate-700/60 text-slate-200 text-xs rounded-xl px-3 py-2 focus-visible:outline-none focus-visible:border-cyan-500/40 focus-visible:ring-2 focus-visible:ring-cyan-500/20"
                  >
                    <option value="universal">Universal</option>
                    <option value="chatgpt">ChatGPT</option>
                    <option value="claude">Claude</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>
              </div>
              <div className="relative">
                <textarea
                  id="goal-input"
                  name="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  data-testid="goal-input"
                  placeholder="Example: Audit the dashboard UI for clarity, accessibility, and visual hierarchy…"
                  autoComplete="off"
                  className="w-full bg-slate-950/70 border border-slate-700/60 rounded-3xl p-6 text-xl text-slate-100 focus-visible:outline-none focus-visible:border-cyan-500/40 focus-visible:ring-4 focus-visible:ring-cyan-500/10 transition-ui min-h-[140px] resize-none leading-relaxed placeholder:text-slate-500 font-medium"
                />

                <div className="mt-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(true)}
                    disabled={!goal}
                    data-testid="save-prompt-btn"
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-ui border",
                      justSaved
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        : "bg-slate-900/60 text-slate-300 border-slate-700/60 hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-40"
                    )}
                    title="Save Prompt"
                  >
                    <Star size={16} fill={justSaved ? "currentColor" : "none"} aria-hidden="true" />
                    Save Prompt
                  </button>
                  <button
                    type="button"
                    onClick={handleSpawn}
                    disabled={loading || !goal}
                    data-testid="spawn-btn"
                    className="flex items-center gap-2 px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-2xl shadow-lg shadow-cyan-500/20 transition-ui text-sm font-bold disabled:opacity-50 disabled:shadow-none"
                    title="Generate Flight Plan"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin text-white" aria-hidden="true" /> : <ChevronRight size={18} className="text-slate-950" aria-hidden="true" />}
                    Generate Flight Plan
                  </button>
                </div>
              </div>

              {/* Status Timeline */}
              {loading && spawnSteps.length > 0 && (
                <div className="mt-6 p-4 bg-slate-900/50 rounded-2xl">
                  <SpawnTimeline steps={spawnSteps} />
                </div>
              )}
            </div>
          </div>

          {/* Result Panel */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-3xl border border-purple-500/30 overflow-hidden shadow-2xl shadow-purple-900/20"
            >
              <div className="bg-purple-900/20 px-6 py-4 flex justify-between items-center border-b border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-green-500/20 rounded-full text-green-400"><CheckCircle2 size={16} aria-hidden="true" /></div>
                  <span className="font-semibold text-purple-200">Flight Plan Ready</span>
                </div>
                <button
                  onClick={handleCopy}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg transition-ui font-medium border flex items-center gap-2",
                    copied
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                  )}
                >
                  {copied ? <><Check size={14} aria-hidden="true" /> Copied!</> : 'Copy to Clipboard'}
                </button>
              </div>
              <div className="p-0 overflow-x-auto bg-slate-950/90 max-h-[500px] overflow-y-auto">
                <pre className="p-6 text-sm font-mono text-slate-300 whitespace-pre-wrap leading-loose">{result}</pre>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {(savedPrompts.length > 0 || (sessions && sessions.length > 0)) && (
            <div className="glass-panel p-5 rounded-3xl space-y-6" data-testid="quick-access">
              <div className="flex items-center gap-2">
                <History size={16} className="text-cyan-400" aria-hidden="true" />
                <h3 className="font-bold text-slate-200">Quick Access</h3>
              </div>

              {savedPrompts.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-inner" data-testid="saved-prompts-section">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-amber-300 uppercase tracking-[0.3em]">Saved Prompts</div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900/70 px-2 py-0.5 rounded-full border border-slate-800">
                      {savedPrompts.length} total
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {savedPrompts.slice(0, 4).map((prompt) => (
                      <div
                        key={prompt.id}
                        className="group flex items-center gap-2 p-3 bg-slate-900/50 hover:bg-slate-800/60 rounded-xl transition-ui min-w-0"
                      >
                        <button
                          onClick={() => handleUsePrompt(prompt.query)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="text-sm font-medium text-slate-200 group-hover:text-white truncate">
                            {prompt.title}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {prompt.query.substring(0, 60)}{prompt.query.length > 60 ? '…' : ''}
                          </div>
                        </button>
                        <button
                          onClick={() => handleDeletePrompt(prompt.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-ui"
                          title="Delete"
                          aria-label="Delete saved prompt"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sessions && sessions.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-inner" data-testid="recent-sessions-section">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-[0.3em]">Recent Sessions</div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900/70 px-2 py-0.5 rounded-full border border-slate-800">
                      {sessions.length} total
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {sessions.slice(0, 4).map((session) => (
                      <button
                        key={session.id}
                        onClick={() => handleReuseSession(session.goal)}
                        className="w-full text-left bg-slate-900/50 hover:bg-slate-800/60 rounded-xl p-3 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-slate-200 text-sm truncate group-hover:text-cyan-400">
                              {session.goal}
                            </div>
                            <div className="text-slate-500 text-xs mt-1 flex items-center gap-2">
                              <Clock size={12} aria-hidden="true" />
                              {new Date(session.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-600 group-hover:text-cyan-400 mt-1" aria-hidden="true" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Prompt Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" data-testid="save-prompt-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-prompt-title"
              className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6 shadow-2xl overscroll-contain"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-xl">
                  <Star size={20} className="text-amber-400" aria-hidden="true" />
                </div>
                <h3 id="save-prompt-title" className="text-lg font-bold text-white">Save Prompt</h3>
              </div>

              <p className="text-slate-400 text-sm mb-4">
                Give this prompt a name so you can easily find it later.
              </p>

              <label htmlFor="prompt-title" className="sr-only">Prompt name</label>
              <input
                id="prompt-title"
                name="promptTitle"
                type="text"
                value={promptTitle}
                onChange={(e) => setPromptTitle(e.target.value)}
                data-testid="prompt-title-input"
                placeholder="e.g., UI Test, Security Audit…"
                autoComplete="off"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus-visible:outline-none focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/30 mb-3"
              />

              <div className="p-3 bg-slate-800/50 rounded-xl mb-6">
                <p className="text-xs text-slate-500 mb-1">Prompt:</p>
                <p className="text-sm text-slate-300 line-clamp-2">{goal}</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveModal(false);
                    setPromptTitle('');
                  }}
                  data-testid="cancel-save-prompt"
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-ui"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePrompt}
                  data-testid="confirm-save-prompt"
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-ui flex items-center justify-center gap-2"
                >
                  <Star size={16} aria-hidden="true" />
                  Save Prompt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RepoRow({ repo, delay }) {
  const getIcon = (purpose) => {
    const p = purpose?.toLowerCase() || '';
    if (p.includes("agent")) return Cpu;
    if (p.includes("skill")) return Terminal;
    if (p.includes("knowledge")) return Database;
    if (p.includes("tool")) return Wrench;
    if (p.includes("benchmark")) return BarChart3;
    return Folder;
  }

  const getPurposeColor = (purpose) => {
    const p = purpose?.toLowerCase() || '';
    if (p.includes("agent")) return { text: "text-purple-400", bg: "bg-purple-400/10", badge: "bg-purple-400/10 text-purple-300 border-purple-400/20" };
    if (p.includes("skill")) return { text: "text-yellow-400", bg: "bg-yellow-400/10", badge: "bg-yellow-400/10 text-yellow-300 border-yellow-400/20" };
    if (p.includes("knowledge")) return { text: "text-blue-400", bg: "bg-blue-400/10", badge: "bg-blue-400/10 text-blue-300 border-blue-400/20" };
    if (p.includes("tool")) return { text: "text-emerald-400", bg: "bg-emerald-400/10", badge: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20" };
    if (p.includes("benchmark")) return { text: "text-red-400", bg: "bg-red-400/10", badge: "bg-red-400/10 text-red-300 border-red-400/20" };
    return { text: "text-slate-400", bg: "bg-slate-400/10", badge: "bg-slate-400/10 text-slate-300 border-slate-400/20" };
  }

  const Icon = getIcon(repo.Purpose);
  const color = getPurposeColor(repo.Purpose);

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="border-b border-slate-800/50 hover:bg-slate-800/30 group"
    >
      <td className="p-4 pl-6">
        <div className="flex items-center gap-4">
          <div className={cn("p-2.5 rounded-xl transition-ui group-hover:scale-110 shadow-lg", color.bg)}>
            <Icon size={18} className={color.text} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-200 group-hover:text-cyan-400 text-sm">{repo.Name}</div>
            <div className="text-xs text-slate-500 font-mono truncate max-w-[200px] mt-0.5 opacity-60">{repo.Path}</div>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-mono bg-slate-900/50 w-fit px-2 py-1 rounded-md border border-slate-800">
          <GitBranch size={12} aria-hidden="true" />
          {repo.Branch}
        </div>
      </td>
      <td className="p-4">
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm", color.badge)}>
          {repo.Purpose}
        </span>
      </td>
    </motion.tr>
  )
}

function RepoTable({ repos }) {
  return (
    <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl shadow-black/20 border border-slate-800/50">
      <div className="px-8 py-5 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/30 backdrop-blur-md">
        <h3 className="font-bold text-slate-200 flex items-center gap-2">
          <Database size={16} className="text-slate-500" aria-hidden="true" />
          Tracked Resources
        </h3>
        <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-1 rounded-md border border-slate-700 tabular-nums">{repos.length} Items</span>
      </div>
      <div
        className="overflow-x-auto"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}
      >
        <table className="w-full text-left border-collapse tabular-nums">
          <thead className="bg-slate-950/40 text-slate-500 uppercase text-[10px] font-extrabold tracking-widest border-b border-slate-800/50">
            <tr>
              <th className="p-5 pl-6">Name / Path</th>
              <th className="p-5">Branch</th>
              <th className="p-5">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            <AnimatePresence>
              {repos.map((repo, i) => (
                <RepoRow key={repo.Name + i} repo={repo} delay={i * 0.05} />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NavItem({ icon: Icon, label, active, badge, href, onClick, testId }) {
  const handleClick = (event) => {
    if (!onClick) return;
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onClick();
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      data-testid={testId}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-ui text-sm font-semibold group relative overflow-hidden no-underline",
        active
          ? "bg-white text-slate-950 shadow-lg shadow-white/5"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
      )}
    >
      <Icon size={20} className={cn("", active ? "text-cyan-600" : "text-slate-500 group-hover:text-slate-300")} aria-hidden="true" />
      <span>{label}</span>

      {badge && (
        <span className={cn("ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums", active ? "bg-slate-200 text-slate-800 border-slate-300" : "bg-slate-800 text-slate-400 border-slate-700")}>
          {badge}
        </span>
      )}
      {!active && !badge && <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-50 -translate-x-2 group-hover:translate-x-0 transition-ui" aria-hidden="true" />}
    </a>
  )
}

// ==========================================
// Main App
// ==========================================

function App() {
  const [repos, setRepos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categorySizes, setCategorySizes] = useState({});
  const [status, setStatus] = useState('Online');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [view, setView] = useState('agents');
  const [spawnResult, setSpawnResult] = useState('');
  const [dirtyGoal, setDirtyGoal] = useState(false);

  // New state for config/setup
  const [appConfig, setAppConfig] = useState(null);
  const [isFirstRun, setIsFirstRun] = useState(null); // null = loading
  const [defaultPaths, setDefaultPaths] = useState({});
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlView = params.get('view');
    const normalizedView = urlView === 'dashboard' ? 'repos' : urlView;
    if (normalizedView && VIEW_KEYS.includes(normalizedView)) {
      setView(normalizedView);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') !== view) {
      params.set('view', view);
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, [view]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!dirtyGoal) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyGoal]);

  // Check configuration on mount
  useEffect(() => {
    checkConfig();
  }, []);

  const checkConfig = async () => {
    try {
      const [configRes, pathsRes] = await Promise.all([
        fetch(`${API_BASE}/config`),
        fetch(`${API_BASE}/default-paths`)
      ]);

      const configData = await configRes.json();
      const pathsData = await pathsRes.json();

      setAppConfig(configData);
      setDefaultPaths(pathsData);
      setIsFirstRun(configData.isFirstRun);

      if (!configData.isFirstRun) {
        // Normal startup - fetch data
        fetchData();
        fetchSessions();
      }
    } catch (e) {
      console.error('Failed to check config:', e);
      setIsFirstRun(false); // Assume not first run if can't connect
    }
  };

  const handleSetupComplete = (result) => {
    setIsFirstRun(false);
    setAppConfig(prev => ({ ...prev, config: { ...prev?.config, reposRoot: result.reposRoot } }));
    fetchData();
    fetchCategorySizes();
    addLog(`Setup complete! Repos root: ${result.reposRoot}`);
  };

  useEffect(() => {
    if (isFirstRun === false) {
      fetchData();
      fetchCategorySizes();
      const dataInterval = setInterval(fetchData, 10000);
      const sizeInterval = setInterval(fetchCategorySizes, 5000);
      return () => {
        clearInterval(dataInterval);
        clearInterval(sizeInterval);
      };
    }
  }, [isFirstRun]);

  const fetchData = () => {
    fetchRepos();
    fetchCategories();
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (e) {
      console.error("Failed to fetch categories", e);
    }
  };

  const fetchCategorySizes = async () => {
    try {
      const res = await fetch(`${API_BASE}/category-sizes`);
      if (res.ok) {
        const data = await res.json();
        const normalized = {};
        Object.entries(data || {}).forEach(([key, value]) => {
          normalized[key.toLowerCase()] = value;
        });
        setCategorySizes(normalized);
      }
    } catch (e) {
      console.error("Failed to fetch category sizes", e);
    }
  };

  const derivePurpose = (repoPath) => {
    if (!repoPath) return "Unknown";
    const normalize = repoPath.replace(/\\/g, '/');
    const sections = normalize.split('/');
    if (sections.length < 2) return "Unknown";
    const parent = sections[sections.length - 2];
    return parent.charAt(0).toUpperCase() + parent.slice(1);
  };

  const fetchRepos = async () => {
    try {
      const res = await fetch(`${API_BASE}/repos`);
      const data = await res.json();
      const enriched = data.map(repo => ({
        ...repo,
        Purpose: repo.Category || derivePurpose(repo.Path)
      }));
      setRepos(enriched);
      setStatus('Online');
    } catch (e) {
      console.error(e);
      setStatus('Offline');
    }
  };

  const handleScan = async () => {
    setLoading(true);
    try {
      addLog("Starting System Scan…");
      const res = await fetch(`${API_BASE}/scan`, { method: 'POST' });
      const data = await res.json();
      addLog(data.output || "Scan Complete");
      fetchData();
      fetchCategorySizes();
    } catch (e) {
      addLog("Scan failed. Check the server and try again.");
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!url) return;
    const trimmedUrl = url.trim().replace(/\/+$/, '');
    const repoName = trimmedUrl.split('/').pop()?.replace(/\.git$/i, '');
    if (repoName && repos.some(r => r.Name?.toLowerCase() === repoName.toLowerCase())) {
      addLog(`Repo already exists: ${repoName}`);
      return;
    }

    setLoading(true);
    addLog(`Cloning ${url}…`);
    let shouldClear = false;
    let shouldRefresh = false;
    try {
      const res = await fetch(`${API_BASE}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        if (data.code === 'REPO_EXISTS') {
          const location = data.repo?.Path || data.error || 'Repository already exists.';
          addLog(`Repo already exists: ${location}`);
        } else if (data.code === 'INVALID_URL') {
          addLog('Invalid repository URL. Check the URL and try again.');
        } else if (data.error) {
          addLog(`Add failed: ${data.error}`);
        } else {
          addLog('Add failed. Check the URL and try again.');
        }
      } else {
        addLog(data.output || "Clone Complete");
        shouldClear = true;
        shouldRefresh = true;
        fetchCategorySizes();
      }
    } catch (e) {
      addLog("Add failed. Check the URL and try again.");
    }
    setLoading(false);
    if (shouldClear) setUrl('');
    if (shouldRefresh) fetchData();
  };

  const handleSpawn = async (goal, format = 'universal') => {
    setLoading(true);
    setSpawnResult('');
    addLog(`Orchestrating agent for: “${goal}”…`);
    try {
      const res = await fetch(`${API_BASE}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, format })
      });
      const data = await res.json();
      if (data.success) {
        setSpawnResult(data.output);
        addLog("Agent Spawned Successfully");

        // Save session
        await fetch(`${API_BASE}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal, agent: 'std-agent', output: data.output, format })
        });
        fetchSessions();
      } else {
        addLog(`Spawn Error: ${data.error}`);
      }
    } catch (e) {
      addLog("Spawn request failed. Check the server and try again.");
    }
    setLoading(false);
  };

  const addLog = (msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  // Show loading state while checking config
  if (isFirstRun === null) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen flex items-center justify-center bg-[#0B0C15]">
          <div className="flex items-center gap-4 text-cyan-400" role="status" aria-live="polite">
            <RefreshCw size={24} className="animate-spin" aria-hidden="true" />
            <span className="text-xl">Loading CORTEX…</span>
          </div>
        </div>
      </MotionConfig>
    );
  }

  // Show setup wizard if first run
  if (isFirstRun) {
    return (
      <MotionConfig reducedMotion="user">
        <SetupWizard onComplete={handleSetupComplete} defaultPath={defaultPaths.reposRoot} />
      </MotionConfig>
    );
  }

  // Group repos by category (dynamic)
  const categorized = {};
  categories.forEach(cat => {
    categorized[cat] = repos.filter(r => r.Purpose?.toLowerCase().includes(cat.toLowerCase()));
  });

  const viewMeta = {
    agents: {
      title: 'Agent Factory',
      subtitle: 'Spawn specialized autonomous agents using natural language.'
    },
    repos: {
      title: 'Repositories',
      subtitle: 'Scan, add, and manage reference repos.'
    },
    logs: {
      title: 'System Logs',
      subtitle: 'Operational events from the local CORTEX daemon.'
    },
    settings: {
      title: 'Settings',
      subtitle: 'Configure repository paths and preferences.'
    }
  };

  const headerMeta = viewMeta[view] || viewMeta.repos;
  const showHeader = view !== 'agents';
  const handleViewChange = (nextView) => {
    if (nextView === view) return;
    if (dirtyGoal && view === 'agents') {
      const confirmLeave = window.confirm('You have an unsent goal. Leave this page?');
      if (!confirmLeave) return;
      setDirtyGoal(false);
    }
    setView(nextView);
  };

  return (
    <MotionConfig reducedMotion="user">
      <a href="#main-content" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:bg-slate-900 focus-visible:text-white focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-lg">
        Skip to main content
      </a>
      <div className="min-h-screen flex text-slate-100 selection:bg-cyan-500/30 bg-[#0B0C15]">

      {/* Sidebar */}
      <nav className="w-72 glass-panel border-r border-slate-800/50 flex flex-col fixed h-full z-50 backdrop-blur-xl bg-slate-950/80">
        <div className="p-8">
          <div className="flex items-center gap-4 text-cyan-400 mb-10 pl-2">
            <div className="bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 rounded-2xl p-3 border border-white/10 shadow-2xl">
              <img
                src={brainIcon}
                alt="Cortex Brain"
                width="32"
                height="32"
                fetchpriority="high"
                className="w-8 h-8 object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]"
              />
            </div>
            <span className="font-bold text-3xl tracking-tighter text-white">CORTEX</span>
          </div>

          <div className="space-y-3">
            <NavItem
              icon={Cpu}
              label="Agent Factory"
              active={view === 'agents'}
              href="?view=agents"
              testId="nav-agents"
              onClick={() => handleViewChange('agents')}
            />
            <NavItem
              icon={GitBranch}
              label="Repositories"
              badge={repos.length}
              active={view === 'repos'}
              href="?view=repos"
              testId="nav-repos"
              onClick={() => handleViewChange('repos')}
            />
            <NavItem
              icon={Terminal}
              label="System Logs"
              active={view === 'logs'}
              href="?view=logs"
              testId="nav-logs"
              onClick={() => handleViewChange('logs')}
            />
            <NavItem
              icon={Settings}
              label="Settings"
              active={view === 'settings'}
              href="?view=settings"
              testId="nav-settings"
              onClick={() => handleViewChange('settings')}
            />
          </div>
        </div>

        <div className="mt-auto p-8 border-t border-slate-800/50 bg-slate-900/30">
          <div className="flex items-center gap-3" role="status" aria-live="polite">
            <div className="relative" aria-hidden="true">
              <div className={`w-2.5 h-2.5 rounded-full ${status === 'Online' ? 'bg-emerald-500' : 'bg-red-500'} z-10 relative`}></div>
              <div className={`absolute inset-0 rounded-full ${status === 'Online' ? 'bg-emerald-500' : 'bg-red-500'} animate-ping opacity-75`}></div>
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider ${status === 'Online' ? 'text-emerald-400' : 'text-red-400'}`}>System {status}</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono mt-2">v2.1.0 • Cross-Platform</div>
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" className="flex-1 ml-72 p-10 max-w-[1600px] mx-auto">

        {/* Top Bar */}
        {showHeader && (
          <header className="flex justify-between items-end mb-12">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white mb-2">{headerMeta.title}</h1>
              <p className="text-slate-400 font-medium">{headerMeta.subtitle}</p>
            </div>
          </header>
        )}

        {/* Content Views */}
        <AnimatePresence mode="wait">
          {view === 'agents' && (
            <OrchestratorView
              onSpawn={handleSpawn}
              loading={loading}
              result={spawnResult}
              sessions={sessions}
              onDirtyChange={setDirtyGoal}
            />
          )}

          {view === 'repos' && (
            <motion.div
              key="repos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Repository Overview */}
              <div className="grid grid-cols-5 gap-6 mb-10">
                {categories.map((cat, i) => {
                  const config = CATEGORY_CONFIG[cat.toLowerCase()] || DEFAULT_CATEGORY;
                  const sizeBytes = categorySizes[cat.toLowerCase()];
                  return (
                    <StatCard
                      key={cat}
                      title={cat.charAt(0).toUpperCase() + cat.slice(1)}
                      count={categorized[cat] ? categorized[cat].length : 0}
                      sizeLabel={formatBytes(sizeBytes)}
                      testId={`stat-${cat.toLowerCase()}`}
                      icon={config.icon}
                      color={config.color}
                      delay={i * 0.05}
                      description={config.desc}
                    />
                  );
                })}
              {categories.length === 0 && (
                  <div className="col-span-5 text-center text-slate-500 py-12 border border-dashed border-slate-800 rounded-3xl">
                    Initializing Knowledge Base…
                  </div>
                )}
              </div>

              <div className="glass-panel rounded-3xl p-6 mb-8 border border-slate-800/60 bg-slate-950/40">
                <div className="flex flex-wrap items-center gap-3 rounded-3xl focus-within:ring-2 focus-within:ring-cyan-500/20">
                  <div className="flex-1 min-w-[260px]">
                    <label htmlFor="repo-url" className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                      Add Repository
                    </label>
                    <input
                      id="repo-url"
                      name="repoUrl"
                      type="url"
                      inputMode="url"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      data-testid="repo-url-input"
                      placeholder="e.g., https://github.com/org/repo…"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                      className="w-full bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 focus-visible:border-cyan-500/50 rounded-2xl px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/20 transition-ui placeholder:text-slate-600 shadow-inner"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={loading || !url}
                    data-testid="repo-clone-btn"
                    className="px-6 py-3 bg-slate-100 hover:bg-white text-slate-900 rounded-2xl font-bold transition-ui disabled:opacity-50 text-sm shadow-lg shadow-white/5 active:scale-95"
                  >
                    Clone
                  </button>
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={loading}
                    data-testid="repo-scan-btn"
                    className="group flex items-center gap-2 px-5 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-2xl border border-slate-700/50 transition-ui text-sm font-bold disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={cn("transition-transform group-hover:rotate-180 duration-500", loading ? "animate-spin" : "")} aria-hidden="true" />
                    {loading ? "Syncing…" : "Scan"}
                  </button>
                </div>
              </div>
              <RepoTable repos={repos} />
            </motion.div>
          )}

          {view === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-[calc(100vh-180px)] glass-panel rounded-3xl p-8 flex flex-col bg-slate-950/50 border border-slate-800"
              data-testid="system-logs"
            >
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex justify-between border-b border-slate-800 pb-6">
                <span>System Logs</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 font-mono text-sm" role="log" aria-live="polite" aria-relevant="additions">
                {logs.length === 0 && <div className="text-slate-600 italic">No activity recorded.</div>}
                {logs.map((log, i) => (
                  <div key={i} data-testid="system-log-entry" className="text-slate-300 border-l-2 border-slate-700 pl-4 py-1.5 hover:bg-slate-800/30 rounded-r-lg break-words">
                    {log}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'settings' && (
            <SettingsPanel
              config={appConfig}
              onSave={(newConfig) => setAppConfig(prev => ({ ...prev, config: newConfig }))}
            />
          )}
        </AnimatePresence>

      </main>
      </div>
    </MotionConfig>
  )
}

export default App


