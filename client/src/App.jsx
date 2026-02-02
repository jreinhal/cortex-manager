import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import {
  Terminal, Database, Cpu, Wrench,
  BarChart3, RefreshCw, CheckCircle2,
  ChevronRight, ChevronDown, GitBranch, Folder,
  Settings, FolderOpen, Check, X, Clock,
  History, HardDrive,
  ChevronUp, FolderInput, Star, Trash2,
  LayoutDashboard, Activity, FlaskConical, Library, BookOpen
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import brainIcon from './assets/brain.png'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

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

function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes}m ${rem}s`;
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
const VIEW_KEYS = ['home', 'agents', 'runs', 'evaluations', 'library', 'knowledge', 'logs', 'settings'];

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
      setValidation({ valid: false, errors: ['Unable to validate path. Will attempt to continue anyway.'] });
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
              <div className="bg-black rounded-2xl p-4 relative overflow-visible">
                <div className="brain-glow absolute -inset-2 rounded-[20px] bg-[radial-gradient(circle_at_28%_35%,rgba(34,211,238,0.65),transparent_63%),radial-gradient(circle_at_72%_55%,rgba(168,85,247,0.6),transparent_66%)] blur-xl opacity-80 pointer-events-none"></div>
                <img
                  src={brainIcon}
                  alt="Cortex"
                  width="56"
                  height="56"
                  fetchpriority="high"
                  className="relative z-10 w-14 h-14 object-contain"
                  style={{ filter: 'drop-shadow(0 0 11px rgba(34,211,238,0.7)) drop-shadow(0 0 16px rgba(168,85,247,0.65))' }}
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
                    : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                )} role="status" aria-live="polite">
                  {validation.valid ? <Check size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
                  <div>
                    {validation.valid ? (
                      <>
                        Path looks good
                        {validation.exists && <span className="text-slate-400"> (directory exists)</span>}
                        {validation.hasStructure && <span className="text-emerald-300"> with CORTEX structure</span>}
                      </>
                    ) : (
                      <>
                        Path warnings: {(validation.errors || []).concat(validation.warnings || []).join(', ') || 'Validation not available.'}
                      </>
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
              disabled={loading || !reposRoot}
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
  const [llmEndpoint, setLlmEndpoint] = useState(config?.config?.llm?.endpoint || '');
  const [llmFallbackEndpoint, setLlmFallbackEndpoint] = useState(config?.config?.llm?.fallbackEndpoint || '');
  const [llmAllowRemote, setLlmAllowRemote] = useState(config?.config?.llm?.allowRemote ?? true);
  const [llmTest, setLlmTest] = useState({ status: 'idle', results: [] });
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
      const baseConfig = config?.config?.llm || {};
      const llm = {
        ...baseConfig,
        endpoint: llmEndpoint.trim(),
        fallbackEndpoint: llmFallbackEndpoint.trim() || null,
        allowRemote: llmAllowRemote
      };
      const res = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reposRoot: reposRoot.trim(), llm })
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

  const handleTestLlm = async () => {
    const endpoints = [llmEndpoint.trim(), llmFallbackEndpoint.trim()].filter(Boolean);
    if (endpoints.length === 0) {
      setLlmTest({ status: 'error', results: [{ endpoint: '', reachable: false, error: 'Add an endpoint to test.' }] });
      return;
    }

    setLlmTest({ status: 'testing', results: [] });
    const results = [];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${API_BASE}/llm/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint })
        });
        const data = await res.json();
        results.push({
          endpoint,
          reachable: data.reachable === true,
          status: data.status,
          error: data.error
        });
      } catch (e) {
        results.push({ endpoint, reachable: false, error: e.message });
      }
    }
    setLlmTest({ status: 'done', results });
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
              data-testid="settings-repos-root"
              value={reposRoot}
              onChange={(e) => setReposRoot(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              ref={reposRootInputRef}
              className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50 font-mono text-sm"
            />
            <button
              data-testid="settings-save"
              onClick={handleSave}
              disabled={loading || saved}
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

        {/* LLM Endpoints */}
        <div>
          <label htmlFor="settings-llm-endpoint" className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            LLM Endpoint
          </label>
          <div className="flex flex-col gap-3">
            <input
              id="settings-llm-endpoint"
              name="settingsLlmEndpoint"
              type="text"
              value={llmEndpoint}
              onChange={(e) => setLlmEndpoint(e.target.value)}
              placeholder="http://localhost:8080/v1/chat/completions"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50 font-mono text-sm"
            />

            <input
              id="settings-llm-fallback"
              name="settingsLlmFallback"
              type="text"
              value={llmFallbackEndpoint}
              onChange={(e) => setLlmFallbackEndpoint(e.target.value)}
              placeholder="Fallback endpoint (optional)"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50 font-mono text-sm"
            />

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={llmAllowRemote}
                onChange={(e) => setLlmAllowRemote(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
              />
              Allow remote LLM endpoints
            </label>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={handleTestLlm}
              disabled={llmTest.status === 'testing'}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold transition-ui",
                llmTest.status === 'testing'
                  ? "bg-slate-700 text-slate-300"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200"
              )}
            >
              {llmTest.status === 'testing' ? 'Testing…' : 'Test Connection'}
            </button>
            <span className="text-xs text-slate-500">Pings the configured endpoint(s).</span>
          </div>

          {llmTest.results.length > 0 && (
            <div className="mt-3 space-y-2 text-xs">
              {llmTest.results.map((result) => (
                <div key={result.endpoint} className={cn(
                  "rounded-lg border px-3 py-2",
                  result.reachable ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300"
                )}>
                  <div className="font-mono">{result.endpoint || 'Unknown endpoint'}</div>
                  <div>
                    {result.reachable
                      ? `Reachable (HTTP ${result.status ?? 'n/a'})`
                      : `Unreachable${result.error ? `: ${result.error}` : ''}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500 mt-2">
            Set a primary endpoint and optional fallback for automatic failover.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// Spawn Status Timeline Component
// ==========================================
function SpawnTimeline({ steps }) {
  const totalSteps = steps.length;
  const doneCount = steps.filter(step => step.done).length;
  const hasError = steps.some(step => step.error);
  const isComplete = totalSteps > 0 && doneCount === totalSteps && !hasError;
  const currentStep = steps.find(step => !step.done && !step.error);
  const rawProgress = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;
  const displayProgress = isComplete ? 100 : Math.max(8, rawProgress);

  return (
    <div className="space-y-3" role="status" aria-live="polite" data-testid="spawn-steps">
      {totalSteps > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{isComplete ? 'Complete' : hasError ? 'Error' : 'Working…'}</span>
            <span>{doneCount}/{totalSteps} · {displayProgress}%</span>
          </div>
          <div
            className="relative h-2 w-full rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/50"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayProgress}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                isComplete
                  ? "bg-emerald-400"
                  : hasError
                    ? "bg-red-400"
                    : "bg-cyan-400 animate-pulse"
              )}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          {!isComplete && !hasError && (
            <div className="text-[11px] text-slate-500">
              {currentStep ? `Now: ${currentStep.text}` : 'Working…'} This can take a few minutes for large prompts.
            </div>
          )}
          {hasError && (
            <div className="text-[11px] text-red-400">An error occurred. Check System Logs.</div>
          )}
        </div>
      )}
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

function StatCard({ title, count, sizeLabel, icon: Icon, color, delay, testId, sizeTestId }) {
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
          <div className="text-slate-500 text-[11px] font-medium mt-2" data-testid={sizeTestId}>Size {sizeLabel}</div>
        </div>
      </div>
    </motion.div>
  )
}

function OrchestratorView({
  onSpawn,
  loading,
  result,
  sessions,
  savedPrompts,
  onSavePrompt,
  onDeletePrompt,
  onUsePrompt,
  onDirtyChange,
  prefillGoal,
  onPrefillConsumed
}) {
  const [goal, setGoal] = useState('');
  const [format, setFormat] = useState('universal');
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [spawnSteps, setSpawnSteps] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const formatMenuRef = useRef(null);
  const formatButtonRef = useRef(null);

  const formatOptions = [
    { value: 'universal', label: 'Universal', accent: 'bg-cyan-400/80' },
    { value: 'chatgpt', label: 'ChatGPT', accent: 'bg-sky-400/80' },
    { value: 'claude', label: 'Claude', accent: 'bg-amber-400/80' },
    { value: 'gemini', label: 'Gemini', accent: 'bg-violet-400/80' }
  ];
  const currentFormat = formatOptions.find((option) => option.value === format) || formatOptions[0];

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(Boolean(goal));
    }
  }, [goal, onDirtyChange]);

  useEffect(() => {
    if (!prefillGoal) return;
    setGoal(prefillGoal);
    if (onPrefillConsumed) {
      onPrefillConsumed();
    }
  }, [prefillGoal, onPrefillConsumed]);

  useEffect(() => {
    if (!formatMenuOpen) return;

    const handleClick = (event) => {
      if (!formatMenuRef.current) return;
      if (!formatMenuRef.current.contains(event.target)) {
        setFormatMenuOpen(false);
      }
    };

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setFormatMenuOpen(false);
        formatButtonRef.current?.focus();
      }
    };

    window.addEventListener('mousedown', handleClick);
    window.addEventListener('touchstart', handleClick);
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('touchstart', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [formatMenuOpen]);

  const handleSavePrompt = async () => {
    if (!goal) return;
    const saved = await onSavePrompt?.(promptTitle || 'Untitled', goal);
    if (saved) {
      setShowSaveModal(false);
      setPromptTitle('');
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  const handleDeletePrompt = async (id) => {
    const target = savedPrompts.find((prompt) => prompt.id === id);
    const label = target?.title ? `“${target.title}”` : 'this prompt';
    if (!window.confirm(`Delete ${label}?`)) {
      return;
    }

    await onDeletePrompt?.(id);
  };

  const handleUsePrompt = (query) => {
    setGoal(query);
    if (onUsePrompt) {
      onUsePrompt(query);
    }
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
                <div className="flex items-center gap-2" ref={formatMenuRef}>
                  <label htmlFor="format-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Format</label>
                  <div className="relative">
                    <button
                      id="format-select"
                      name="format"
                      data-testid="format-select"
                      type="button"
                      ref={formatButtonRef}
                      aria-haspopup="listbox"
                      aria-expanded={formatMenuOpen}
                      onClick={() => setFormatMenuOpen((open) => !open)}
                      className={cn(
                        "group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-ui",
                        "bg-slate-900/70 text-slate-200 border-slate-700/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                        "hover:border-cyan-500/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/30",
                        formatMenuOpen ? "border-cyan-500/50 ring-2 ring-cyan-500/15" : ""
                      )}
                    >
                      <span className="relative flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80 shadow-[0_0_8px_rgba(34,211,238,0.7)]"></span>
                        {currentFormat.label}
                      </span>
                      <ChevronDown
                        size={14}
                        className={cn(
                          "transition-transform duration-200 text-slate-400 group-hover:text-cyan-200",
                          formatMenuOpen ? "rotate-180 text-cyan-200" : ""
                        )}
                        aria-hidden="true"
                      />
                    </button>

                    <AnimatePresence>
                      {formatMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="absolute right-0 mt-2 w-44 rounded-2xl border border-slate-700/70 bg-slate-950/95 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl p-1.5 z-30"
                          role="listbox"
                          aria-label="Format"
                        >
                          <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"></div>
                          {formatOptions.map((option, index) => (
                            <motion.button
                              key={option.value}
                              type="button"
                              role="option"
                              data-testid={`format-option-${option.value}`}
                              aria-selected={format === option.value}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.03, duration: 0.15 }}
                              onClick={() => {
                                setFormat(option.value);
                                setFormatMenuOpen(false);
                                formatButtonRef.current?.focus();
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-ui flex items-center gap-2",
                                format === option.value
                                  ? "bg-cyan-500/15 text-cyan-200"
                                  : "text-slate-200 hover:bg-slate-800/70 hover:text-white"
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.35)]", option.accent)}></span>
                              <span>{option.label}</span>
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <div className="relative">
                <textarea
                  id="goal-input"
                  name="goal"
                  data-testid="goal-input"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
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
                    data-testid="generate-flight-plan"
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
                  data-testid="copy-flight-plan"
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
                <pre className="p-6 text-sm font-mono text-slate-300 whitespace-pre-wrap leading-loose" data-testid="flight-plan-output">{result}</pre>
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
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-prompt-title"
              data-testid="save-prompt-modal"
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
                data-testid="prompt-title-input"
                value={promptTitle}
                onChange={(e) => setPromptTitle(e.target.value)}
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

function MetricCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <div className="glass-card p-5 rounded-3xl border border-slate-800/60 bg-slate-900/40 shadow-xl">
      <div className="flex items-center justify-between">
        <div className={cn("p-3 rounded-2xl", accent.replace('text-', 'bg-').replace('400', '500/10'))}>
          <Icon size={22} className={accent} aria-hidden="true" />
        </div>
        {subtitle && <span className="text-[11px] text-slate-500 uppercase tracking-widest">{subtitle}</span>}
      </div>
      <div className="mt-4 text-3xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-widest text-slate-500 mt-2">{title}</div>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="text-center text-slate-500 py-10 border border-dashed border-slate-800 rounded-3xl">
      <div className="text-sm font-semibold text-slate-400">{title}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function HomeView({
  repos,
  runs,
  datasets,
  evaluations,
  savedPrompts,
  sessions,
  onNavigate,
  appConfig
}) {
  const totalRepos = repos.length;
  const runCount = runs.length;
  const datasetCount = datasets.length;
  const evalCount = evaluations.length;
  const promptCount = savedPrompts.length;
  const recentRuns = runs.slice(0, 4);
  const recentSessions = (sessions || []).slice(0, 4);

  const steps = [
    { label: 'Confirm repository root', done: Boolean(appConfig?.config?.reposRoot) },
    { label: 'Add reference repositories', done: totalRepos > 0 },
    { label: 'Spawn your first agent', done: runCount > 0 },
    { label: 'Save a prompt to the library', done: promptCount > 0 },
    { label: 'Create an evaluation dataset', done: datasetCount > 0 }
  ];

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="glass-panel rounded-3xl p-8 border border-slate-800/60 bg-slate-950/50">
          <div className="flex items-center gap-3 text-cyan-400 mb-4">
            <LayoutDashboard size={22} aria-hidden="true" />
            <span className="text-xs uppercase tracking-[0.3em] text-cyan-300">Command Center</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-3">
            Command Center
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            Operational snapshot of runs, evaluations, and knowledge coverage. Use the quickstart
            checklist to keep the system production-ready.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('agents')}
              className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm shadow-lg shadow-cyan-500/20 transition-ui"
            >
              Start a new run
            </button>
            <button
              type="button"
              onClick={() => onNavigate('knowledge')}
              className="px-5 py-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-700/60 transition-ui"
            >
              Manage knowledge base
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            title="Runs"
            value={runCount}
            subtitle="Total"
            icon={Activity}
            accent="text-emerald-400"
          />
          <MetricCard
            title="Evaluations"
            value={evalCount}
            subtitle="Completed"
            icon={FlaskConical}
            accent="text-amber-400"
          />
          <MetricCard
            title="Prompts"
            value={promptCount}
            subtitle="Library"
            icon={Library}
            accent="text-cyan-400"
          />
          <MetricCard
            title="Repos"
            value={totalRepos}
            subtitle="Tracked"
            icon={BookOpen}
            accent="text-indigo-400"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Quickstart</div>
            <span className="text-[10px] text-slate-500">Keep momentum</span>
          </div>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                  step.done ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500"
                )}>
                  {step.done ? <Check size={14} aria-hidden="true" /> : <span>{index + 1}</span>}
                </div>
                <span className={cn("text-sm", step.done ? "text-slate-400" : "text-slate-200")}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Recent Runs</div>
            <button
              type="button"
              onClick={() => onNavigate('runs')}
              className="text-[10px] text-cyan-400 uppercase tracking-[0.3em]"
            >
              View all
            </button>
          </div>
          {recentRuns.length === 0 ? (
            <EmptyState title="No runs yet" subtitle="Spawn an agent to populate run history." />
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <div key={run.id} className="p-3 bg-slate-900/50 rounded-2xl border border-slate-800/60">
                  <div className="text-sm text-slate-200 truncate">{run.goal}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                    <span>Quality {run.metrics?.qualityScore ?? '—'}</span>
                    <span>Duration {formatDuration(run.durationMs)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Recent Sessions</div>
            <button
              type="button"
              onClick={() => onNavigate('agents')}
              className="text-[10px] text-cyan-400 uppercase tracking-[0.3em]"
            >
              Agent Factory
            </button>
          </div>
          {recentSessions.length === 0 ? (
            <EmptyState title="No sessions yet" subtitle="Sessions appear after each spawn." />
          ) : (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <div key={session.id} className="p-3 bg-slate-900/50 rounded-2xl border border-slate-800/60">
                  <div className="text-sm text-slate-200 truncate">{session.goal}</div>
                  <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                    <Clock size={12} aria-hidden="true" />
                    {new Date(session.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function RunsView({ runs }) {
  const [selectedId, setSelectedId] = useState(runs[0]?.id || null);
  const [query, setQuery] = useState('');
  const [compareId, setCompareId] = useState('');

  useEffect(() => {
    if (!selectedId && runs.length > 0) {
      setSelectedId(runs[0].id);
    }
  }, [runs, selectedId]);

  const filtered = runs.filter((run) => {
    const search = query.trim().toLowerCase();
    if (!search) return true;
    return (run.goal || '').toLowerCase().includes(search) || (run.agent?.name || '').toLowerCase().includes(search);
  });

  const selected = filtered.find((run) => run.id === selectedId) || filtered[0];
  const compareRun = runs.find((run) => run.id === compareId);

  const delta = compareRun && selected
    ? {
        quality: (selected.metrics?.qualityScore ?? 0) - (compareRun.metrics?.qualityScore ?? 0),
        duration: (selected.durationMs ?? 0) - (compareRun.durationMs ?? 0),
        uncertainty: (selected.metrics?.uncertainty ?? 0) - (compareRun.metrics?.uncertainty ?? 0),
        resources: (selected.resources?.total ?? 0) - (compareRun.resources?.total ?? 0)
      }
    : null;

  const matrix = selected?.decisionMatrix || {};
  const retrievalGate = matrix.retrievalGate?.enabled ? 'enabled' : 'disabled';
  const ragFusion = matrix.resourceSelection?.ragFusionUsed ? `used (${matrix.resourceSelection?.ragFusionVariants || 0} variants)` : 'not used';
  const hyde = matrix.resourceSelection?.hydeUsed ? 'used' : 'not used';
  const hybrid = matrix.resourceSelection?.hybridUsed ? 'enabled' : 'disabled';
  const lateInteraction = matrix.resourceSelection?.lateInteractionUsed ? 'used' : 'not used';
  const llmPolicy = matrix.agentSelection?.rerankPolicy || 'n/a';

  return (
    <motion.div
      key="runs"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="grid lg:grid-cols-3 gap-6"
    >
      <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50 h-[calc(100vh-220px)] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Run History</div>
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
          {filtered.length === 0 && <EmptyState title="No runs match" subtitle="Adjust your search or spawn a new run." />}
          {filtered.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedId(run.id)}
              className={cn(
                "w-full text-left p-3 rounded-2xl border transition-ui",
                run.id === selected?.id
                  ? "bg-slate-800/60 border-cyan-500/40"
                  : "bg-slate-900/40 border-slate-800/60 hover:border-slate-700"
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
          <EmptyState title="Select a run" subtitle="Choose a run from the list to inspect its trace." />
        )}

        {selected && (
          <>
            <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Run Detail</div>
                <span className="text-[10px] text-slate-500 font-mono">{selected.id}</span>
              </div>
              <div className="text-lg font-semibold text-white leading-snug mb-4">{selected.goal}</div>
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
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Tokens (est)</div>
                  <div>{selected.metrics?.tokensEstimated ?? '—'}</div>
                </div>
              </div>
              {selected.metrics?.issues?.length > 0 && (
                <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                  {selected.metrics.issues.join(' • ')}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Run Comparison</div>
                <select
                  value={compareId}
                  onChange={(e) => setCompareId(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-200"
                >
                  <option value="">Select baseline</option>
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>{(run.goal || 'Untitled run').substring(0, 50)}</option>
                  ))}
                </select>
              </div>
              {!delta && (
                <EmptyState title="Pick a baseline run" subtitle="Compare quality, duration, and uncertainty." />
              )}
              {delta && (
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className={cn("p-3 rounded-2xl border", delta.quality >= 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200")}>
                    Quality Δ {delta.quality >= 0 ? '+' : ''}{delta.quality}
                  </div>
                  <div className={cn("p-3 rounded-2xl border", delta.duration <= 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200")}>
                    Duration Δ {delta.duration >= 0 ? '+' : ''}{formatDuration(delta.duration)}
                  </div>
                  <div className={cn("p-3 rounded-2xl border", delta.uncertainty <= 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200")}>
                    Uncertainty Δ {delta.uncertainty >= 0 ? '+' : ''}{Math.round(delta.uncertainty * 100)}%
                  </div>
                  <div className={cn("p-3 rounded-2xl border", delta.resources >= 0 ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" : "border-slate-700 bg-slate-800/60 text-slate-300")}>
                    Resources Δ {delta.resources >= 0 ? '+' : ''}{delta.resources}
                  </div>
                </div>
              )}
            </div>

            {selected.git && (
              <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Code Context</div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-300">
                  <div>Branch: <span className="text-slate-100">{selected.git.branch || '—'}</span></div>
                  <div>Commit: <span className="text-slate-100">{selected.git.commit?.slice(0, 8) || '—'}</span></div>
                  <div>Status: <span className="text-slate-100">{selected.git.dirty ? 'Dirty' : 'Clean'}</span></div>
                  <div>Message: <span className="text-slate-100">{selected.git.message || '—'}</span></div>
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

            <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Decision Matrix</div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-300">
                <div>Retrieval gate: <span className="text-slate-100">{retrievalGate}</span></div>
                <div>RAG-Fusion: <span className="text-slate-100">{ragFusion}</span></div>
                <div>HyDE fallback: <span className="text-slate-100">{hyde}</span></div>
                <div>Hybrid retrieval: <span className="text-slate-100">{hybrid}</span></div>
                <div>Late-interaction rerank: <span className="text-slate-100">{lateInteraction}</span></div>
                <div>LLM rerank policy: <span className="text-slate-100">{llmPolicy}</span></div>
                <div>Uncertainty: <span className="text-slate-100">{Math.round((matrix.uncertainty?.score || 0) * 100)}%</span></div>
                <div>Requires review: <span className="text-slate-100">{selected.metrics?.requiresReview ? 'yes' : 'no'}</span></div>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Trace</div>
              {selected.trace?.steps?.length ? (
                <div className="space-y-3">
                  {selected.trace.steps.map((step, index) => (
                    <div key={`${step.name}-${index}`} className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/60">
                      <div className="text-sm text-slate-200">{step.name}</div>
                      {step.data && (
                        <div className="text-xs text-slate-500 mt-2">
                          {Object.entries(step.data).map(([key, value]) => (
                            <span key={key} className="mr-3">{key}: {String(value)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No trace steps" subtitle="Spawn a new run to populate trace data." />
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function EvaluationsView({
  datasets,
  runs,
  evaluations,
  templates = [],
  onCreateDataset,
  onDeleteDataset,
  onAddDatasetItem,
  onCreateEvaluation,
  onImportDataset
}) {
  const [selectedDatasetId, setSelectedDatasetId] = useState(datasets[0]?.id || '');
  const [datasetName, setDatasetName] = useState('');
  const [datasetDescription, setDatasetDescription] = useState('');
  const [itemInput, setItemInput] = useState('');
  const [itemExpected, setItemExpected] = useState('');
  const [itemWeight, setItemWeight] = useState('1');
  const [itemRubric, setItemRubric] = useState('');
  const [itemExpectedType, setItemExpectedType] = useState('contains');
  const [evalDatasetId, setEvalDatasetId] = useState('');
  const [evalRunId, setEvalRunId] = useState('');
  const [selectedEvaluationId, setSelectedEvaluationId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const importInputRef = useRef(null);

  useEffect(() => {
    if (!selectedDatasetId && datasets.length > 0) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  useEffect(() => {
    if (!evalDatasetId && selectedDatasetId) {
      setEvalDatasetId(selectedDatasetId);
    }
  }, [selectedDatasetId, evalDatasetId]);

  useEffect(() => {
    if (!compareLeftId && evaluations.length > 0) {
      setCompareLeftId(evaluations[0].id);
    }
    if (!compareRightId && evaluations.length > 1) {
      setCompareRightId(evaluations[1].id);
    }
  }, [evaluations, compareLeftId, compareRightId]);

  useEffect(() => {
    if (compareResult) {
      setCompareResult(null);
    }
  }, [compareLeftId, compareRightId]);

  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);

  const handleCreateDataset = async () => {
    if (!datasetName.trim()) return;
    const created = await onCreateDataset?.(datasetName.trim(), datasetDescription.trim());
    if (created) {
      setSelectedDatasetId(created.id);
      setDatasetName('');
      setDatasetDescription('');
    }
  };

  const handleAddItem = async () => {
    if (!selectedDataset || !itemInput.trim()) return;
    const added = await onAddDatasetItem?.(selectedDataset.id, {
      input: itemInput.trim(),
      expected: itemExpected.trim(),
      weight: Number(itemWeight) || 1,
      expectedType: itemExpectedType,
      rubric: itemRubric.trim()
    });
    if (added) {
      setItemInput('');
      setItemExpected('');
      setItemWeight('1');
      setItemRubric('');
      setItemExpectedType('contains');
    }
  };

  const handleTemplateApply = () => {
    if (!selectedTemplate) return;
    if (selectedTemplate.rubric) {
      setItemRubric(selectedTemplate.rubric);
    }
    if (selectedTemplate.expectedType) {
      setItemExpectedType(selectedTemplate.expectedType);
    }
  };

  const handleExportDataset = async () => {
    if (!selectedDataset) return;
    try {
      const res = await fetch(`${API_BASE}/datasets/${selectedDataset.id}/export`);
      const data = await res.json();
      const payload = data.dataset || data;
      if (!payload) return;
      const safeName = (payload.name || 'dataset').replace(/[^a-z0-9-_]+/gi, '_');
      const blob = new Blob([JSON.stringify({ dataset: payload }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export dataset:', e);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed.dataset || parsed;
      const created = await onImportDataset?.(payload);
      if (created) {
        setSelectedDatasetId(created.id);
      }
    } catch (e) {
      console.error('Failed to import dataset:', e);
    } finally {
      event.target.value = '';
    }
  };

  const handleCreateEvaluation = async () => {
    if (!evalDatasetId || !evalRunId) return;
    const created = await onCreateEvaluation?.(evalDatasetId, evalRunId);
    if (created) {
      setSelectedEvaluationId(created.id);
    }
  };

  const handleCompareEvaluations = async () => {
    if (!compareLeftId || !compareRightId) return;
    setCompareLoading(true);
    try {
      const res = await fetch(`${API_BASE}/evaluations/compare?left=${encodeURIComponent(compareLeftId)}&right=${encodeURIComponent(compareRightId)}`);
      const data = await res.json();
      if (res.ok) {
        setCompareResult(data);
      } else {
        console.error(data?.error || 'Failed to compare evaluations');
      }
    } catch (e) {
      console.error('Failed to compare evaluations:', e);
    }
    setCompareLoading(false);
  };

  const selectedEvaluation = evaluations.find((evaluation) => evaluation.id === selectedEvaluationId);
  const deltaScore = compareResult?.delta?.score ?? 0;
  const deltaPassRate = compareResult?.delta?.passRate ?? 0;
  const deltaItemCount = compareResult?.delta?.itemCount ?? 0;

  const handleDeleteSelected = async () => {
    if (!selectedDataset) return;
    const label = selectedDataset.name ? `“${selectedDataset.name}”` : 'this dataset';
    if (!window.confirm(`Delete ${label}?`)) return;
    await onDeleteDataset?.(selectedDataset.id);
  };

  return (
    <motion.div
      key="evaluations"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="grid lg:grid-cols-3 gap-6"
    >
      <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50 space-y-5">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Datasets</div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {datasets.length === 0 && <EmptyState title="No datasets yet" subtitle="Create one to start evaluations." />}
            {datasets.map((dataset) => (
              <button
                key={dataset.id}
                onClick={() => setSelectedDatasetId(dataset.id)}
                className={cn(
                  "w-full text-left p-3 rounded-2xl border transition-ui",
                  dataset.id === selectedDatasetId
                    ? "bg-slate-800/60 border-cyan-500/40"
                    : "bg-slate-900/40 border-slate-800/60 hover:border-slate-700"
                )}
              >
                <div className="text-sm text-slate-200 truncate">{dataset.name}</div>
                <div className="text-xs text-slate-500 mt-1">{dataset.items?.length || 0} items</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Create Dataset</div>
          <input
            type="text"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="Dataset name"
            className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
          />
          <textarea
            value={datasetDescription}
            onChange={(e) => setDatasetDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
          />
          <button
            type="button"
            onClick={handleCreateDataset}
            className="w-full py-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm"
          >
            Create dataset
          </button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Dataset Detail</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportDataset}
                disabled={!selectedDataset}
                className="text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-50"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
              >
                Import
              </button>
              {selectedDataset && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          {!selectedDataset ? (
            <EmptyState title="Select a dataset" subtitle="Choose one from the list to add items." />
          ) : (
            <>
              <div className="mb-4">
                <div className="text-lg font-semibold text-white">{selectedDataset.name}</div>
                <div className="text-sm text-slate-400 mt-1">{selectedDataset.description || 'No description provided.'}</div>
              </div>
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <input
                  type="text"
                  value={itemInput}
                  onChange={(e) => setItemInput(e.target.value)}
                  placeholder="Prompt / input"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                />
                <input
                  type="text"
                  value={itemExpected}
                  onChange={(e) => setItemExpected(e.target.value)}
                  placeholder="Expected text or regex:..."
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                />
                <select
                  value={itemExpectedType}
                  onChange={(e) => setItemExpectedType(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                >
                  <option value="contains">Contains</option>
                  <option value="regex">Regex</option>
                  <option value="llm">LLM Rubric</option>
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={itemWeight}
                  onChange={(e) => setItemWeight(e.target.value)}
                  placeholder="Weight"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200 min-w-[220px]"
                >
                  <option value="">Rubric template (optional)</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleTemplateApply}
                  disabled={!selectedTemplate}
                  className="px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm border border-slate-700/60 disabled:opacity-50"
                >
                  Use template
                </button>
                {selectedTemplate && (
                  <span className="text-xs text-slate-500">{selectedTemplate.description}</span>
                )}
              </div>
              <textarea
                value={itemRubric}
                onChange={(e) => setItemRubric(e.target.value)}
                placeholder="Optional rubric (used by LLM grader)"
                rows={3}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200 mb-4"
              />
              <button
                type="button"
                onClick={handleAddItem}
                className="mb-4 px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm border border-slate-700/60"
              >
                Add item
              </button>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {(selectedDataset.items || []).length === 0 && (
                  <EmptyState title="No items yet" subtitle="Add prompts to make this dataset usable." />
                )}
                {(selectedDataset.items || []).map((item) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/60">
                    <div className="text-sm text-slate-200 truncate">{item.input}</div>
                    {item.expected && <div className="text-xs text-slate-500 mt-1 truncate">Expected: {item.expected}</div>}
                    {item.expectedType && (
                      <div className="text-[10px] text-slate-600 mt-1">Type: {item.expectedType}</div>
                    )}
                    {item.rubric && (
                      <div className="text-[10px] text-slate-600 mt-1 truncate">Rubric: {item.rubric}</div>
                    )}
                    {item.weight && <div className="text-[10px] text-slate-600 mt-1">Weight: {item.weight}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Run Evaluation</div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <select
              value={evalDatasetId}
              onChange={(e) => setEvalDatasetId(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
            >
              <option value="">Select dataset</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
              ))}
            </select>
            <select
              value={evalRunId}
              onChange={(e) => setEvalRunId(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
            >
              <option value="">Select run</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>{(run.goal || 'Untitled run').substring(0, 60)}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreateEvaluation}
            disabled={!evalDatasetId || !evalRunId}
            className="px-4 py-2 rounded-2xl bg-emerald-500/90 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-sm font-semibold transition-ui"
          >
            Create evaluation
          </button>
          <div className="mt-6 space-y-3">
            {evaluations.length === 0 && <EmptyState title="No evaluations yet" subtitle="Create one to capture scores." />}
            {evaluations.map((evaluation) => (
              <button
                key={evaluation.id}
                type="button"
                onClick={() => setSelectedEvaluationId(evaluation.id)}
                className={cn(
                  "w-full text-left p-3 rounded-2xl border transition-ui",
                  evaluation.id === selectedEvaluationId
                    ? "border-cyan-500/40 bg-slate-800/60"
                    : "border-slate-800/60 bg-slate-900/50 hover:border-slate-700"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-slate-200">{evaluation.name}</div>
                  <span className={cn(
                    "text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border",
                    evaluation.status === 'pass'
                      ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                      : evaluation.status === 'warn'
                        ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                        : evaluation.status === 'fail'
                          ? "border-red-500/40 text-red-300 bg-red-500/10"
                          : "border-slate-700 text-slate-400 bg-slate-800/60"
                  )}>
                    {evaluation.status || 'needs-review'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Score {evaluation.metrics?.score ?? '—'} · Pass {Math.round((evaluation.metrics?.passRate || 0) * 100)}% · Items {evaluation.metrics?.itemCount ?? 0}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-6">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-3">Compare Evaluations</div>
            <div className="grid md:grid-cols-2 gap-4 mb-3">
              <select
                value={compareLeftId}
                onChange={(e) => setCompareLeftId(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              >
                <option value="">Left evaluation</option>
                {evaluations.map((evaluation) => (
                  <option key={evaluation.id} value={evaluation.id}>{evaluation.name}</option>
                ))}
              </select>
              <select
                value={compareRightId}
                onChange={(e) => setCompareRightId(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              >
                <option value="">Right evaluation</option>
                {evaluations.map((evaluation) => (
                  <option key={evaluation.id} value={evaluation.id}>{evaluation.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleCompareEvaluations}
              disabled={!compareLeftId || !compareRightId || compareLeftId === compareRightId || compareLoading}
              className="px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm border border-slate-700/60 disabled:opacity-50"
            >
              {compareLoading ? 'Comparing…' : 'Compare'}
            </button>
            <div className="text-[10px] text-slate-500 mt-2">Delta = right − left</div>
            {evaluations.length < 2 && (
              <div className="text-xs text-slate-500 mt-3">Add at least two evaluations to compare results.</div>
            )}
            {compareResult && (
              <div className="mt-4 grid md:grid-cols-3 gap-3 text-xs">
                <div className={cn(
                  "p-3 rounded-xl border",
                  deltaScore >= 0
                    ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                    : "border-red-500/30 text-red-300 bg-red-500/10"
                )}>
                  Score Δ {deltaScore >= 0 ? '+' : ''}{deltaScore.toFixed(2)}
                </div>
                <div className={cn(
                  "p-3 rounded-xl border",
                  deltaPassRate >= 0
                    ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                    : "border-red-500/30 text-red-300 bg-red-500/10"
                )}>
                  Pass Rate Δ {deltaPassRate >= 0 ? '+' : ''}{Math.round(deltaPassRate * 100)}%
                </div>
                <div className="p-3 rounded-xl border border-slate-700 text-slate-300 bg-slate-800/60">
                  Items Δ {deltaItemCount >= 0 ? '+' : ''}{deltaItemCount}
                </div>
              </div>
            )}
          </div>
          {selectedEvaluation && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-3">Per-item grading</div>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {(selectedEvaluation.items || []).length === 0 && (
                  <EmptyState title="No item results" subtitle="Evaluation details not available." />
                )}
                {(selectedEvaluation.items || []).map((item) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span className="truncate">{item.input}</span>
                      <span className={cn(
                        "text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border",
                        item.status === 'pass'
                          ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                          : item.status === 'fail'
                            ? "border-red-500/40 text-red-300 bg-red-500/10"
                            : "border-amber-500/40 text-amber-300 bg-amber-500/10"
                      )}>
                        {item.status}
                      </span>
                    </div>
                    {item.expected && (
                      <div className="text-xs text-slate-500 mt-1 truncate">Expected: {item.expected}</div>
                    )}
                    <div className="text-[10px] text-slate-500 mt-2">
                      Score {Math.round((item.score || 0) * 100)} · Weight {item.weight || 1} · {item.method}
                    </div>
                    {item.notes && (
                      <div className="text-[10px] text-slate-500 mt-2">Notes: {item.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LibraryView({
  savedPrompts,
  agents,
  tools,
  onDeletePrompt,
  onUsePrompt
}) {
  const handleDeletePrompt = (prompt) => {
    const label = prompt?.title ? `“${prompt.title}”` : 'this prompt';
    if (!window.confirm(`Delete ${label}?`)) return;
    onDeletePrompt?.(prompt.id);
  };

  return (
    <motion.div
      key="library"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
          <div className="text-xs uppercase tracking-[0.3em] text-amber-300 font-bold mb-4">Saved Prompts</div>
          {savedPrompts.length === 0 && (
            <EmptyState title="No prompts saved" subtitle="Save prompts from Agent Factory." />
          )}
          <div className="space-y-3">
            {savedPrompts.map((prompt) => (
              <div key={prompt.id} className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/60">
                <div className="text-sm text-slate-200 truncate">{prompt.title}</div>
                <div className="text-xs text-slate-500 mt-1 truncate">{prompt.query}</div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => onUsePrompt?.(prompt.query)}
                    className="text-xs px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePrompt(prompt)}
                    className="text-xs px-3 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-bold mb-4">Agent Templates</div>
          {agents.length === 0 && (
            <EmptyState title="No agent templates" subtitle="Add templates in your reference repos." />
          )}
          <div className="space-y-3">
            {agents.map((agent) => (
              <div key={agent.id} className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/60">
                <div className="text-sm text-slate-200">{agent.name}</div>
                <div className="text-xs text-slate-500 mt-1">{agent.description}</div>
                {agent.keywords?.length > 0 && (
                  <div className="text-[10px] text-slate-500 mt-2">
                    {agent.keywords.slice(0, 4).join(' • ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-slate-800/60 bg-slate-950/50">
          <div className="text-xs uppercase tracking-[0.3em] text-emerald-300 font-bold mb-4">Tools & Utilities</div>
          {tools.length === 0 && (
            <EmptyState title="No tools detected" subtitle="Add tools in the reference repos tools folder." />
          )}
          <div className="space-y-3">
            {tools.map((tool) => (
              <div key={tool.id || tool.name} className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/60">
                <div className="text-sm text-slate-200">{tool.name}</div>
                <div className="text-xs text-slate-500 mt-1">{tool.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
    <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl shadow-black/20 border border-slate-800/50" data-testid="repos-table">
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
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoAction, setRepoAction] = useState(null);
  const [repoNotice, setRepoNotice] = useState(null);
  const repoNoticeTimeoutRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [view, setView] = useState('home');
  const [spawnResult, setSpawnResult] = useState('');
  const [dirtyGoal, setDirtyGoal] = useState(false);
  const [runs, setRuns] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [agents, setAgents] = useState([]);
  const [tools, setTools] = useState([]);
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [prefillGoal, setPrefillGoal] = useState('');
  const [evaluationTemplates, setEvaluationTemplates] = useState([]);

  // New state for config/setup
  const [appConfig, setAppConfig] = useState(null);
  const [isFirstRun, setIsFirstRun] = useState(null); // null = loading
  const [defaultPaths, setDefaultPaths] = useState({});
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlView = params.get('view');
    const normalizedView = urlView === 'dashboard'
      ? 'home'
      : urlView === 'repos' || urlView === 'repositories'
        ? 'knowledge'
        : urlView;
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

  const pushRepoNotice = (message, type = 'info', timeoutMs = 4000) => {
    if (repoNoticeTimeoutRef.current) {
      clearTimeout(repoNoticeTimeoutRef.current);
      repoNoticeTimeoutRef.current = null;
    }
    setRepoNotice({ message, type });
    if (timeoutMs > 0) {
      repoNoticeTimeoutRef.current = setTimeout(() => {
        setRepoNotice(null);
        repoNoticeTimeoutRef.current = null;
      }, timeoutMs);
    }
  };

  useEffect(() => {
    return () => {
      if (repoNoticeTimeoutRef.current) {
        clearTimeout(repoNoticeTimeoutRef.current);
      }
    };
  }, []);

  const fetchData = () => {
    fetchRepos();
    fetchCategories();
    fetchRuns();
    fetchDatasets();
    fetchEvaluations();
    fetchAgents();
    fetchTools();
    fetchSavedPrompts();
    fetchEvaluationTemplates();
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

  const fetchRuns = async () => {
    try {
      const res = await fetch(`${API_BASE}/runs`);
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch runs:', e);
    }
  };

  const fetchDatasets = async () => {
    try {
      const res = await fetch(`${API_BASE}/datasets`);
      const data = await res.json();
      setDatasets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch datasets:', e);
    }
  };

  const fetchEvaluations = async () => {
    try {
      const res = await fetch(`${API_BASE}/evaluations`);
      const data = await res.json();
      setEvaluations(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch evaluations:', e);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/agents`);
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    }
  };

  const fetchTools = async () => {
    try {
      const res = await fetch(`${API_BASE}/tools`);
      const data = await res.json();
      setTools(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch tools:', e);
    }
  };

  const fetchSavedPrompts = async () => {
    try {
      const res = await fetch(`${API_BASE}/prompts`);
      const data = await res.json();
      setSavedPrompts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch saved prompts:', e);
    }
  };

  const fetchEvaluationTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/evaluation-templates`);
      const data = await res.json();
      setEvaluationTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch evaluation templates:', e);
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

  const savePrompt = async (title, query) => {
    if (!query) return null;
    try {
      const res = await fetch(`${API_BASE}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, query })
      });
      const data = await res.json();
      if (data.success) {
        setSavedPrompts(prev => [data.prompt, ...prev]);
        return data.prompt;
      }
    } catch (e) {
      console.error('Failed to save prompt:', e);
    }
    return null;
  };

  const deletePrompt = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/prompts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSavedPrompts(prev => prev.filter(prompt => prompt.id !== id));
        return true;
      }
    } catch (e) {
      console.error('Failed to delete prompt:', e);
    }
    return false;
  };

  const createDataset = async (name, description) => {
    try {
      const res = await fetch(`${API_BASE}/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });
      const data = await res.json();
      if (data.success) {
        setDatasets(prev => [data.dataset, ...prev]);
        return data.dataset;
      }
    } catch (e) {
      console.error('Failed to create dataset:', e);
    }
    return null;
  };

  const deleteDataset = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/datasets/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDatasets(prev => prev.filter(dataset => dataset.id !== id));
        return true;
      }
    } catch (e) {
      console.error('Failed to delete dataset:', e);
    }
    return false;
  };

  const addDatasetItem = async (datasetId, item) => {
    try {
      const res = await fetch(`${API_BASE}/datasets/${datasetId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      const data = await res.json();
      if (data.success) {
        await fetchDatasets();
        return data.item;
      }
    } catch (e) {
      console.error('Failed to add dataset item:', e);
    }
    return null;
  };

  const createEvaluation = async (datasetId, runId) => {
    try {
      const res = await fetch(`${API_BASE}/evaluations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId, runId })
      });
      const data = await res.json();
      if (data.success) {
        setEvaluations(prev => [data.evaluation, ...prev]);
        return data.evaluation;
      }
    } catch (e) {
      console.error('Failed to create evaluation:', e);
    }
    return null;
  };

  const importDataset = async (datasetPayload) => {
    try {
      const res = await fetch(`${API_BASE}/datasets/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: datasetPayload })
      });
      const data = await res.json();
      if (data.success) {
        setDatasets(prev => [data.dataset, ...prev]);
        return data.dataset;
      }
    } catch (e) {
      console.error('Failed to import dataset:', e);
    }
    return null;
  };

  const handleScan = async () => {
    setRepoLoading(true);
    setRepoAction('scan');
    pushRepoNotice('Scanning repositories…', 'info', 0);
    try {
      addLog("Starting System Scan…");
      const res = await fetch(`${API_BASE}/scan`, { method: 'POST' });
      const data = await res.json();
      addLog(data.output || "Scan Complete");
      pushRepoNotice(data.output || 'Scan complete.', 'success');
      fetchData();
      fetchCategorySizes();
    } catch (e) {
      addLog("Scan failed. Check the server and try again.");
      pushRepoNotice('Scan failed. Check the server and try again.', 'error');
    }
    setRepoLoading(false);
    setRepoAction(null);
  };

  const handleAdd = async () => {
    if (!url) return;
    const trimmedUrl = url.trim().replace(/\/+$/, '');
    const repoName = trimmedUrl.split('/').pop()?.replace(/\.git$/i, '');
    if (repoName && repos.some(r => r.Name?.toLowerCase() === repoName.toLowerCase())) {
      addLog(`Repo already exists: ${repoName}`);
      pushRepoNotice(`Repository already exists: ${repoName}`, 'error');
      return;
    }

    setRepoLoading(true);
    setRepoAction('clone');
    addLog(`Cloning ${url}…`);
    pushRepoNotice(`Cloning ${repoName || 'repository'}…`, 'info', 0);
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
          pushRepoNotice(`Repository already exists: ${location}`, 'error');
        } else if (data.code === 'INVALID_URL') {
          addLog('Invalid repository URL. Check the URL and try again.');
          pushRepoNotice('Invalid repository URL. Check the URL and try again.', 'error');
        } else if (data.error) {
          addLog(`Add failed: ${data.error}`);
          pushRepoNotice(`Add failed: ${data.error}`, 'error');
        } else {
          addLog('Add failed. Check the URL and try again.');
          pushRepoNotice('Add failed. Check the URL and try again.', 'error');
        }
      } else {
        addLog(data.output || "Clone Complete");
        pushRepoNotice(data.output || 'Clone complete.', 'success');
        shouldClear = true;
        shouldRefresh = true;
        fetchCategorySizes();
      }
    } catch (e) {
      addLog("Add failed. Check the URL and try again.");
      pushRepoNotice('Add failed. Check the URL and try again.', 'error');
    }
    setRepoLoading(false);
    setRepoAction(null);
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
        fetchRuns();
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
    home: {
      title: 'Command Center',
      subtitle: 'Operational overview of runs, evaluations, and knowledge coverage.'
    },
    agents: {
      title: 'Agent Factory',
      subtitle: 'Spawn specialized autonomous agents using natural language.'
    },
    runs: {
      title: 'Run Explorer',
      subtitle: 'Inspect decision matrices, traces, and performance signals.'
    },
    evaluations: {
      title: 'Evaluations',
      subtitle: 'Create datasets and score runs against them.'
    },
    library: {
      title: 'Library',
      subtitle: 'Prompts, agent templates, and reusable assets.'
    },
    knowledge: {
      title: 'Knowledge Base',
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

  const headerMeta = viewMeta[view] || viewMeta.home;
  const showHeader = !['agents', 'home'].includes(view);
  const handleViewChange = (nextView) => {
    if (nextView === view) return;
    if (dirtyGoal && view === 'agents') {
      const confirmLeave = window.confirm('You have an unsent goal. Leave this page?');
      if (!confirmLeave) return;
      setDirtyGoal(false);
    }
    setView(nextView);
  };

  const handleLibraryUsePrompt = (query) => {
    setPrefillGoal(query);
    handleViewChange('agents');
  };

  const handlePrefillConsumed = () => {
    setPrefillGoal('');
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
            <div className="bg-black rounded-2xl p-3 relative overflow-visible">
              <div className="brain-glow absolute -inset-2 rounded-[20px] bg-[radial-gradient(circle_at_28%_35%,rgba(34,211,238,0.65),transparent_63%),radial-gradient(circle_at_72%_55%,rgba(168,85,247,0.6),transparent_66%)] blur-xl opacity-80 pointer-events-none"></div>
              <img
                src={brainIcon}
                alt="Cortex Brain"
                width="40"
                height="40"
                fetchpriority="high"
                className="relative z-10 w-10 h-10 object-contain"
                style={{ filter: 'drop-shadow(0 0 11px rgba(34,211,238,0.7)) drop-shadow(0 0 16px rgba(168,85,247,0.65))' }}
              />
            </div>
            <span className="font-bold text-3xl tracking-tighter text-white">CORTEX</span>
          </div>

          <div className="space-y-3">
            <NavItem
              icon={LayoutDashboard}
              label="Command Center"
              active={view === 'home'}
              href="?view=home"
              onClick={() => handleViewChange('home')}
              testId="nav-home"
            />
            <NavItem
              icon={Cpu}
              label="Agent Factory"
              active={view === 'agents'}
              href="?view=agents"
              onClick={() => handleViewChange('agents')}
              testId="nav-agents"
            />
            <NavItem
              icon={Activity}
              label="Runs"
              badge={runs.length}
              active={view === 'runs'}
              href="?view=runs"
              onClick={() => handleViewChange('runs')}
              testId="nav-runs"
            />
            <NavItem
              icon={FlaskConical}
              label="Evaluations"
              badge={evaluations.length}
              active={view === 'evaluations'}
              href="?view=evaluations"
              onClick={() => handleViewChange('evaluations')}
              testId="nav-evaluations"
            />
            <NavItem
              icon={Library}
              label="Library"
              badge={savedPrompts.length}
              active={view === 'library'}
              href="?view=library"
              onClick={() => handleViewChange('library')}
              testId="nav-library"
            />
            <NavItem
              icon={BookOpen}
              label="Knowledge Base"
              badge={repos.length}
              active={view === 'knowledge'}
              href="?view=knowledge"
              onClick={() => handleViewChange('knowledge')}
              testId="nav-knowledge"
            />
            <NavItem
              icon={Terminal}
              label="System Logs"
              active={view === 'logs'}
              href="?view=logs"
              onClick={() => handleViewChange('logs')}
              testId="nav-logs"
            />
            <NavItem
              icon={Settings}
              label="Settings"
              active={view === 'settings'}
              href="?view=settings"
              onClick={() => handleViewChange('settings')}
              testId="nav-settings"
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
          {view === 'home' && (
            <HomeView
              repos={repos}
              runs={runs}
              datasets={datasets}
              evaluations={evaluations}
              savedPrompts={savedPrompts}
              sessions={sessions}
              onNavigate={handleViewChange}
              appConfig={appConfig}
            />
          )}

          {view === 'agents' && (
            <OrchestratorView
              onSpawn={handleSpawn}
              loading={loading}
              result={spawnResult}
              sessions={sessions}
              savedPrompts={savedPrompts}
              onSavePrompt={savePrompt}
              onDeletePrompt={deletePrompt}
              onUsePrompt={() => {}}
              onDirtyChange={setDirtyGoal}
              prefillGoal={prefillGoal}
              onPrefillConsumed={handlePrefillConsumed}
            />
          )}

          {view === 'runs' && (
            <RunsView runs={runs} />
          )}

          {view === 'evaluations' && (
            <EvaluationsView
              datasets={datasets}
              runs={runs}
              evaluations={evaluations}
              templates={evaluationTemplates}
              onCreateDataset={createDataset}
              onDeleteDataset={deleteDataset}
              onAddDatasetItem={addDatasetItem}
              onCreateEvaluation={createEvaluation}
              onImportDataset={importDataset}
            />
          )}

          {view === 'library' && (
            <LibraryView
              savedPrompts={savedPrompts}
              agents={agents}
              tools={tools}
              onDeletePrompt={deletePrompt}
              onUsePrompt={handleLibraryUsePrompt}
            />
          )}

          {view === 'knowledge' && (
            <motion.div
              key="knowledge"
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
                  const testKey = cat.toLowerCase();
                  return (
                    <StatCard
                      key={cat}
                      title={cat.charAt(0).toUpperCase() + cat.slice(1)}
                      count={categorized[cat] ? categorized[cat].length : 0}
                      sizeLabel={formatBytes(sizeBytes)}
                      icon={config.icon}
                      color={config.color}
                      delay={i * 0.05}
                      description={config.desc}
                      testId={`stat-card-${testKey}`}
                      sizeTestId={`stat-size-${testKey}`}
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
                <div className="mb-3">
                  <label
                    htmlFor="repo-url"
                    className="text-xs font-bold text-slate-500 uppercase tracking-widest inline-flex items-center w-fit bg-slate-950 px-2 py-1 rounded-lg border border-slate-800/70"
                  >
                    Add Repository
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-3xl focus-within:ring-2 focus-within:ring-cyan-500/20">
                  <div className="flex-1 min-w-[260px]">
                    <input
                      id="repo-url"
                      name="repoUrl"
                      type="url"
                      data-testid="repo-url-input"
                      inputMode="url"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
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
                    disabled={repoLoading || !url}
                    data-testid="repo-clone-btn"
                    className="px-6 py-3 bg-slate-100 hover:bg-white text-slate-900 rounded-2xl font-bold transition-ui disabled:opacity-50 text-sm shadow-lg shadow-white/5 active:scale-95 flex items-center gap-2"
                  >
                    {repoLoading && repoAction === 'clone' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                        Cloning…
                      </>
                    ) : (
                      'Clone'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={repoLoading}
                    data-testid="repo-scan-btn"
                    className="group flex items-center gap-2 px-5 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-2xl border border-slate-700/50 transition-ui text-sm font-bold disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={cn("transition-transform group-hover:rotate-180 duration-500", repoLoading && repoAction === 'scan' ? "animate-spin" : "")} aria-hidden="true" />
                    {repoLoading && repoAction === 'scan' ? "Syncing…" : "Scan"}
                  </button>
                </div>
                {repoNotice && (
                  <div
                    className={cn(
                      "mt-3 px-4 py-2 rounded-xl text-sm border",
                      repoNotice.type === 'success'
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                        : repoNotice.type === 'error'
                          ? "bg-red-500/10 border-red-500/20 text-red-400"
                          : "bg-slate-900/60 border-slate-700/60 text-slate-300"
                    )}
                    role="status"
                    aria-live="polite"
                    data-testid="repo-notice"
                  >
                    {repoNotice.message}
                  </div>
                )}
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
            >
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex justify-between border-b border-slate-800 pb-6">
                <span>System Logs</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 font-mono text-sm" role="log" aria-live="polite" aria-relevant="additions" data-testid="system-logs">
                {logs.length === 0 && <div className="text-slate-600 italic">No activity recorded.</div>}
                {logs.map((log, i) => (
                  <div key={i} className="text-slate-300 border-l-2 border-slate-700 pl-4 py-1.5 hover:bg-slate-800/30 rounded-r-lg break-words">
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


