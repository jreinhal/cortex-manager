import { useState, useEffect, useRef, useCallback } from 'react'
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
import { AuditView } from './views/AuditView';
import { LogsView } from './views/LogsView';
import { SettingsPanel } from './views/SettingsPanel';
import { LibraryView } from './views/LibraryView';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';
const AUTH_TOKEN_KEY = 'cortex_token';
const WORKSPACE_KEY = 'cortex_workspace_id';
const THEME_KEY = 'cortex_theme';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const MANUAL_URL = (() => {
  const base = API_BASE.replace(/\/api\/?$/, '');
  return `${base}/manual/index.html`;
})();

function apiFetch(path, options = {}) {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  const workspaceId = window.localStorage.getItem(WORKSPACE_KEY);
  const headers = {
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId;
  }
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, { ...options, headers }).then((res) => {
    if (res.status === 401) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('auth-expired'));
    }
    return res;
  });
}

// --- Utils ---
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '0 B';
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
const DEFAULT_RBAC_ROLES = {
  viewer: {
    config: ['read'],
    system: ['read'],
    llm: ['read'],
    workspaces: ['read'],
    users: [],
    repos: ['read'],
    vector_index: ['read'],
    runs: ['read'],
    jobs: ['read'],
    datasets: ['read', 'export'],
    evaluations: ['read', 'compare'],
    evaluation_templates: ['read', 'export'],
    prompts: ['read'],
    agents: ['read'],
    tools: ['read'],
    analytics: ['read'],
    observability: ['read'],
    audit: ['read'],
    sessions: ['read'],
    logs: ['read']
  },
  editor: {
    config: ['read'],
    system: ['read'],
    llm: ['read', 'test'],
    workspaces: ['read'],
    users: [],
    repos: ['read', 'scan', 'create', 'update'],
    vector_index: ['read', 'rebuild'],
    runs: ['read', 'create'],
    jobs: ['read', 'create', 'update'],
    datasets: ['read', 'create', 'update', 'delete', 'export', 'import'],
    evaluations: ['read', 'create', 'compare'],
    evaluation_templates: ['read', 'create', 'update', 'delete', 'export', 'import'],
    prompts: ['read', 'create', 'update', 'delete'],
    agents: ['read'],
    tools: ['read'],
    analytics: ['read'],
    observability: ['read'],
    audit: ['read'],
    sessions: ['read', 'create'],
    logs: ['read']
  },
  admin: {
    '*': ['*']
  }
};
const VIEW_KEYS = ['home', 'agents', 'runs', 'jobs', 'evaluations', 'library', 'knowledge', 'audit', 'logs', 'settings'];
const SPRING_SMOOTH = { type: 'tween', duration: 0.2, ease: [0.2, 0.7, 0.2, 1] };
const SPRING_FAST = { type: 'tween', duration: 0.16, ease: [0.2, 0.7, 0.2, 1] };
const FORMAT_OPTIONS = [
  { value: 'universal', label: 'Universal', accent: 'bg-cyan-400/80' },
  { value: 'chatgpt', label: 'ChatGPT', accent: 'bg-sky-400/80' },
  { value: 'claude', label: 'Claude', accent: 'bg-amber-400/80' },
  { value: 'gemini', label: 'Gemini', accent: 'bg-violet-400/80' }
];
const DEFAULT_FORMAT = FORMAT_OPTIONS[0].value;

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
      const res = await apiFetch(url);
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
        className="glass-panel rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl overscroll-contain"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 id="directory-browser-title" className="font-bold text-white flex items-center gap-2">
            <FolderInput size={20} className="text-cyan-400" aria-hidden="true" />
            Select Directory
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
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

function ChecklistModal({ isOpen, onClose, content, loading, error, onRefresh, onCopy }) {
  if (!isOpen) return null;

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
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center gap-3 text-cyan-400 text-sm" role="status" aria-live="polite">
              <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
              Loading checklist…
            </div>
          )}
          {!loading && error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2" role="alert">
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
      const res = await apiFetch(`/validate-path`, {
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
      const res = await apiFetch(`/setup`, {
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
    <div className="min-h-screen flex items-center justify-center app-shell p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING_SMOOTH}
        className="max-w-xl w-full"
      >
        <div className="glass-panel wizard-shell p-[2px] rounded-[2.5rem]">
          <div className="wizard-inner rounded-[2.2rem] p-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="tag-chip tag-chip-muted">Step 1 of 1</span>
              <span className="h-px flex-1 bg-slate-800/70"></span>
            </div>

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
            <div className="mb-8 p-4 bg-slate-900/40 rounded-2xl border border-white/5">
              <p className="text-slate-300 text-sm leading-relaxed">
                CORTEX needs a directory to store your reference repositories. This is where your Agents, Skills, Knowledge, and Tools will live.
              </p>
            </div>

            {/* Path Input */}
            <div className="mb-6">
              <label htmlFor="repos-root" className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">
                Repository Root Directory
              </label>
              <div className="flex gap-2 rounded-2xl">
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
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50 transition-ui font-mono text-sm"
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
// Authentication Screens
// ==========================================
function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center app-shell p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING_SMOOTH}
        className="max-w-md w-full"
      >
        <div className="glass-panel rounded-[2.5rem] p-[2px]">
          <div className="rounded-[2.2rem] p-10 bg-slate-950/70">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-black rounded-2xl p-3 relative overflow-visible">
                <div className="brain-glow absolute -inset-2 rounded-[20px] bg-[radial-gradient(circle_at_28%_35%,rgba(34,211,238,0.65),transparent_63%),radial-gradient(circle_at_72%_55%,rgba(168,85,247,0.6),transparent_66%)] blur-xl opacity-80 pointer-events-none"></div>
                <img
                  src={brainIcon}
                  alt="Cortex"
                  width="40"
                  height="40"
                  className="relative z-10 w-10 h-10 object-contain"
                  style={{ filter: 'drop-shadow(0 0 11px rgba(34,211,238,0.7)) drop-shadow(0 0 16px rgba(168,85,247,0.65))' }}
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                <p className="text-sm text-slate-400">{subtitle}</p>
              </div>
            </div>
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function LoginScreen({ onLogin, loading, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (!username || !password) return;
    onLogin(username, password);
  };

  return (
    <AuthShell title="Secure Access" subtitle="Sign in to your CORTEX workspace">
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50"
        />
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold transition-ui"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </AuthShell>
  );
}

function BootstrapAdminScreen({ onBootstrap, loading, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (!username || !password) return;
    onBootstrap(username, password);
  };

  return (
    <AuthShell title="Create Admin" subtitle="Bootstrap the first CORTEX administrator">
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Admin username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50"
        />
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50"
        />
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold transition-ui"
        >
          {loading ? 'Creating…' : 'Create admin & sign in'}
        </button>
      </div>
    </AuthShell>
  );
}

// ==========================================
const SPAWN_STEP_DEFS = [
  {
    key: 'analyze',
    label: 'Analyze goal keywords',
    detail: 'Extract intent, complexity, and routing signals.',
    type: 'search'
  },
  {
    key: 'route',
    label: 'Select best agent',
    detail: 'Score agents against the goal and pick the top match.',
    type: 'route'
  },
  {
    key: 'retrieve',
    label: 'Search knowledge base',
    detail: 'Hybrid retrieval + RRF fusion across knowledge/skills/tools.',
    type: 'retrieve'
  },
  {
    key: 'compose',
    label: 'Generate flight plan',
    detail: 'Assemble directive, required reading, and decision matrix.',
    type: 'synthesize'
  }
];

function SpawnTimeline({ steps }) {
  const [expanded, setExpanded] = useState(true);
  const totalSteps = steps.length;
  const doneCount = steps.filter(step => step.done).length;
  const hasError = steps.some(step => step.error);
  const isComplete = totalSteps > 0 && doneCount === totalSteps && !hasError;
  const currentStep = steps.find(step => !step.done && !step.error);
  const rawProgress = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;
  const displayProgress = isComplete ? 100 : Math.max(8, rawProgress);
  const totalDuration = steps.reduce((sum, step) => sum + (step.durationMs || 0), 0);
  const hasTiming = steps.some(step => step.durationMs !== null && step.durationMs !== undefined);

  useEffect(() => {
    if (steps.some(step => !step.done)) {
      setExpanded(true);
    }
  }, [steps]);

  return (
    <div className="glassbox-accordion" role="status" aria-live="polite" data-testid="spawn-steps">
      <button
        type="button"
        className={cn("glassbox-toggle", expanded && "expanded")}
        onClick={() => setExpanded((open) => !open)}
      >
        <ChevronDown size={14} aria-hidden="true" />
        <span className="font-semibold">View Generation Chain ({totalSteps} steps)</span>
        <span className="glassbox-toggle-meta">{doneCount}/{totalSteps} · {displayProgress}%</span>
        {hasTiming && <span className="glassbox-total-duration">{totalDuration}ms</span>}
      </button>
      <div className={cn("glassbox-content", expanded && "visible")}>
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
              {currentStep ? `Now: ${currentStep.label || currentStep.text}` : 'Working…'} This can take a few minutes for large prompts.
            </div>
          )}
          {hasError && (
            <div className="text-[11px] text-red-400">An error occurred. Check System Logs.</div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {steps.map((step, i) => (
            <div key={step.key || i} className="glassbox-step">
              <div className={cn("glassbox-step-icon", step.type || '')}>
                {i + 1}
              </div>
              <div className="glassbox-step-content">
                <div className="glassbox-step-label">
                  {step.label || step.text}
                  {step.durationMs !== null && step.durationMs !== undefined && (
                    <span className="glassbox-step-duration">{Math.max(0, Math.round(step.durationMs))}ms</span>
                  )}
                </div>
                {step.detail && <div className="glassbox-step-detail">{step.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Main Components
// ==========================================

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
  onPrefillConsumed,
  queueEnabled,
  externalSkillsConfig,
  latestRun
}) {
  const [goal, setGoal] = useState('');
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [trainingMenuOpen, setTrainingMenuOpen] = useState(false);
  const [spawnSteps, setSpawnSteps] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [runInBackground, setRunInBackground] = useState(false);
  const [onlineSkills, setOnlineSkills] = useState(false);
  const [onlineSkillsTrainingMode, setOnlineSkillsTrainingMode] = useState('blocking');
  const spawnTimeoutsRef = useRef([]);
  const formatMenuRef = useRef(null);
  const formatButtonRef = useRef(null);
  const trainingMenuRef = useRef(null);
  const trainingButtonRef = useRef(null);

  const externalSkillsEnabled = externalSkillsConfig?.enabled === true;
  const externalSkillsAllowRemote = externalSkillsConfig?.allowRemote === true;
  const showOnlineSkillsToggle = externalSkillsEnabled || import.meta.env.DEV;

  const currentFormat = FORMAT_OPTIONS.find((option) => option.value === format) || FORMAT_OPTIONS[0];
  const trainingOptions = [
    { value: 'blocking', label: 'Blocking' },
    { value: 'background', label: 'Background' }
  ];
  const currentTraining = trainingOptions.find((option) => option.value === onlineSkillsTrainingMode) || trainingOptions[0];
  const latestExternalSkills = latestRun?.decisionMatrix?.resourceSelection?.externalSkills || null;
  const externalSkillsInstalled = Array.isArray(latestExternalSkills?.installed)
    ? latestExternalSkills.installed
        .filter((item) => item && (item.installed || item.alreadyInstalled) && item.slug)
        .map((item) => (item.providerId ? `${item.providerId}:${item.slug}` : item.slug))
    : [];
  const externalSkillsStatus = (() => {
    if (!latestExternalSkills) return null;
    if (latestExternalSkills.error) return { tone: 'error', label: `Error: ${latestExternalSkills.error}` };
    if (latestExternalSkills.skippedReason) {
      return { tone: 'warn', label: `Skipped (${latestExternalSkills.skippedReason.replace(/_/g, ' ')})` };
    }
    if (latestExternalSkills.enabled !== true || latestExternalSkills.mode === 'off') {
      return { tone: 'muted', label: 'Disabled' };
    }
    if (latestExternalSkills.used) return { tone: 'success', label: `Used (${latestExternalSkills.mode})` };
    return { tone: 'info', label: `Enabled (${latestExternalSkills.mode})` };
  })();
  const externalSkillsSummary = externalSkillsInstalled.length > 0
    ? `Installed: ${externalSkillsInstalled.slice(0, 3).join(', ')}${externalSkillsInstalled.length > 3 ? ` +${externalSkillsInstalled.length - 3}` : ''}`
    : null;

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
    if (!formatMenuOpen && !trainingMenuOpen) return;

    const handleClick = (event) => {
      if (formatMenuOpen && formatMenuRef.current && !formatMenuRef.current.contains(event.target)) {
        setFormatMenuOpen(false);
      }
      if (trainingMenuOpen && trainingMenuRef.current && !trainingMenuRef.current.contains(event.target)) {
        setTrainingMenuOpen(false);
      }
    };

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        if (formatMenuOpen) {
          setFormatMenuOpen(false);
          formatButtonRef.current?.focus();
        }
        if (trainingMenuOpen) {
          setTrainingMenuOpen(false);
          trainingButtonRef.current?.focus();
        }
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
  }, [formatMenuOpen, trainingMenuOpen]);

  const clearSpawnTimeouts = useCallback(() => {
    spawnTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    spawnTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearSpawnTimeouts();
    };
  }, [clearSpawnTimeouts]);

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
    clearSpawnTimeouts();
    const startTime = Date.now();
    setSpawnSteps(
      SPAWN_STEP_DEFS.map((step, index) => ({
        ...step,
        done: false,
        error: false,
        startedAt: index === 0 ? startTime : null,
        durationMs: null
      }))
    );

    // Simulate progress (actual progress comes from backend)
    const advanceStep = (nextIndex) => {
      setSpawnSteps((prev) =>
        prev.map((step, idx) => {
          if (idx === nextIndex - 1 && !step.done) {
            const endTime = Date.now();
            return {
              ...step,
              done: true,
              durationMs: step.startedAt ? endTime - step.startedAt : step.durationMs
            };
          }
          if (idx === nextIndex && !step.startedAt) {
            return {
              ...step,
              startedAt: Date.now()
            };
          }
          return step;
        })
      );
    };

    [300, 600, 900].forEach((delay, idx) => {
      const timeoutId = setTimeout(() => advanceStep(idx + 1), delay);
      spawnTimeoutsRef.current.push(timeoutId);
    });

    const externalSkillsRequest = showOnlineSkillsToggle
      ? { online: onlineSkills, trainingMode: onlineSkillsTrainingMode }
      : null;

    await onSpawn(goal, format, runInBackground, externalSkillsRequest);

    // Mark all done
    clearSpawnTimeouts();
    setSpawnSteps((prev) =>
      prev.map((step) => {
        if (step.done) {
          return step;
        }
        const endTime = Date.now();
        return {
          ...step,
          done: true,
          durationMs: step.startedAt ? endTime - step.startedAt : 0
        };
      })
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      /* Fallback for non-secure contexts */
      const textarea = document.createElement('textarea');
      textarea.value = result;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
      transition={SPRING_SMOOTH}
      className="w-full space-y-2 density-stack"
    >
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">Agent Factory</h1>
        <p className="text-slate-400 text-sm">Spawn specialized autonomous agents using natural language.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
          {/* Input Area */}
        <div className="lg:col-span-8 flex flex-col gap-2 self-start">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <label htmlFor="goal-input" className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.22em]">Describe the outcome</label>
            <div className="flex items-center gap-2" ref={formatMenuRef}>
              <label htmlFor="format-select" className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.22em]">Format</label>
              <div className="relative z-40">
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
                    "group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-ui",
                    "bg-white/5 text-slate-200 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                    "hover:border-cyan-400/50 hover:text-white focus-visible:outline-none",
                    formatMenuOpen ? "border-cyan-400/60" : ""
                  )}
                >
                  <span className="relative flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/90 shadow-[0_0_8px_rgba(34,211,238,0.55)]"></span>
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
                      transition={SPRING_FAST}
                      className="absolute right-0 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-950/90 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.8)] backdrop-blur-xl p-1.5 z-50"
                      role="listbox"
                      aria-label="Format"
                    >
                      <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"></div>
                      {FORMAT_OPTIONS.map((option, index) => (
                        <motion.button
                          key={option.value}
                          type="button"
                          role="option"
                          data-testid={`format-option-${option.value}`}
                          aria-selected={format === option.value}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...SPRING_FAST, delay: index * 0.03 }}
                          onClick={() => {
                            setFormat(option.value);
                            setFormatMenuOpen(false);
                            formatButtonRef.current?.focus();
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-ui flex items-center gap-2",
                            format === option.value
                              ? "bg-cyan-400/10 text-cyan-200"
                              : "text-slate-200 hover:bg-white/5 hover:text-white"
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
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <textarea
                id="goal-input"
                name="goal"
                data-testid="goal-input"
                rows={2}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Example: Audit the dashboard UI for clarity, accessibility, and visual hierarchy…"
                autoComplete="off"
                className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-2.5 text-[13px] text-slate-100 focus-visible:outline-none focus-visible:border-cyan-400/50 transition-ui h-[72px] max-h-[96px] resize-none leading-normal placeholder:text-slate-500 font-medium"
              />

              {showOnlineSkillsToggle && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={onlineSkills}
                        disabled={externalSkillsEnabled && !externalSkillsAllowRemote && !import.meta.env.DEV}
                        onChange={(e) => setOnlineSkills(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30 disabled:opacity-50"
                      />
                      Search online for skills
                    </label>
                    {externalSkillsEnabled && !externalSkillsAllowRemote && !import.meta.env.DEV && (
                      <div className="text-[10px] text-slate-500">
                        Remote providers are disabled in Settings.
                      </div>
                    )}
                    {!externalSkillsEnabled && import.meta.env.DEV && (
                      <div className="text-[10px] text-slate-500">
                        Dev mode: requires server env `CORTEX_DEV_MODE=1` if remote is disabled in Settings.
                      </div>
                    )}
                  </div>

                  {onlineSkills && (
                    <div className="flex items-center gap-2 text-xs text-slate-400" ref={trainingMenuRef}>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.22em]">Training</span>
                      <div className="relative z-40">
                        <button
                          type="button"
                          ref={trainingButtonRef}
                          aria-haspopup="listbox"
                          aria-expanded={trainingMenuOpen}
                          onClick={() => setTrainingMenuOpen((open) => !open)}
                          className={cn(
                            "group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-ui",
                            "bg-white/5 text-slate-200 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                            "hover:border-cyan-400/50 hover:text-white focus-visible:outline-none",
                            trainingMenuOpen ? "border-cyan-400/60" : ""
                          )}
                        >
                          <span className="relative flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/90 shadow-[0_0_8px_rgba(34,211,238,0.55)]"></span>
                            {currentTraining.label}
                          </span>
                          <ChevronDown
                            size={14}
                            className={cn(
                              "transition-transform duration-200 text-slate-400 group-hover:text-cyan-200",
                              trainingMenuOpen ? "rotate-180 text-cyan-200" : ""
                            )}
                            aria-hidden="true"
                          />
                        </button>

                        <AnimatePresence>
                          {trainingMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={SPRING_FAST}
                              className="absolute right-0 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-950/90 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.8)] backdrop-blur-xl p-1.5 z-50"
                              role="listbox"
                              aria-label="Training"
                            >
                              <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"></div>
                              {trainingOptions.map((option, index) => (
                                <motion.button
                                  key={option.value}
                                  type="button"
                                  role="option"
                                  aria-selected={onlineSkillsTrainingMode === option.value}
                                  initial={{ opacity: 0, x: -4 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ ...SPRING_FAST, delay: index * 0.03 }}
                                  onClick={() => {
                                    setOnlineSkillsTrainingMode(option.value);
                                    setTrainingMenuOpen(false);
                                    trainingButtonRef.current?.focus();
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-ui flex items-center gap-2",
                                    onlineSkillsTrainingMode === option.value
                                      ? "bg-cyan-400/10 text-cyan-200"
                                      : "text-slate-200 hover:bg-white/5 hover:text-white"
                                  )}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/90 shadow-[0_0_6px_rgba(34,211,238,0.55)]"></span>
                                  <span>{option.label}</span>
                                </motion.button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-0">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  disabled={!goal}
                  data-testid="save-prompt-btn"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-semibold uppercase tracking-[0.2em] transition-ui border",
                    justSaved
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      : "bg-white/5 text-slate-300 border-white/10 hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-40"
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
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-cyan-500/40 bg-cyan-500/20 text-slate-100 uppercase tracking-[0.2em] text-[11px] font-semibold transition-ui hover:bg-cyan-500/30 hover:text-white disabled:opacity-50"
                  title="Generate Flight Plan"
                >
                  {loading ? <RefreshCw size={18} className="animate-spin text-white" aria-hidden="true" /> : <ChevronRight size={18} className="text-white" aria-hidden="true" />}
                  Generate Flight Plan
                </button>
              </div>
              {queueEnabled && (
                <label className="flex items-center gap-2 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={runInBackground}
                    onChange={(e) => setRunInBackground(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                  />
                  Run in background queue
                </label>
              )}
            </div>

            {/* Status Timeline */}
            {spawnSteps.length > 0 && (
              <div className="mt-3 p-4 bg-white/[0.04] rounded-2xl border border-white/[0.08]">
                <SpawnTimeline steps={spawnSteps} />
              </div>
            )}
            {externalSkillsStatus && (
              <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="uppercase tracking-[0.22em] text-[10px] text-slate-500 font-semibold">
                    Last run external skills
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      externalSkillsStatus.tone === 'error' && "text-red-300",
                      externalSkillsStatus.tone === 'warn' && "text-amber-300",
                      externalSkillsStatus.tone === 'success' && "text-emerald-300",
                      externalSkillsStatus.tone === 'info' && "text-slate-200",
                      externalSkillsStatus.tone === 'muted' && "text-slate-500"
                    )}
                  >
                    {externalSkillsStatus.label}
                  </span>
                  {externalSkillsSummary && (
                    <span className="text-slate-500">{externalSkillsSummary}</span>
                  )}
                </div>
              </div>
            )}
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
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus-visible:outline-none focus-visible:border-amber-500/50 mb-3"
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

function EmptyState({ title, subtitle }) {
  return (
    <div className="text-center text-slate-500 py-10 border border-dashed border-slate-800 rounded-3xl">
      <div className="text-sm font-semibold text-slate-400">{title}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function buildSparklinePath(values, width, height) {
  if (!Array.isArray(values) || values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = step * index;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function Sparkline({ values, stroke = '#38bdf8' }) {
  const width = 120;
  const height = 36;
  const path = buildSparklinePath(values, width, height);
  if (!path) {
    return <div className="text-[10px] text-slate-500">No data</div>;
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrendCard({ label, trend, accent }) {
  const hasData = trend.count > 0;
  const delta = trend.delta ?? 0;
  return (
    <div className="p-4 rounded-2xl border border-slate-800/70 bg-slate-900/40">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">{label}</div>
        <span className="tag-inline tag-inline-muted text-[10px]">{trend.count} runs</span>
      </div>
      {hasData ? (
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-slate-100 tabular-nums">{trend.latest}</div>
            <div className={cn(
              "text-[11px] font-semibold",
              delta >= 0 ? "text-emerald-300" : "text-red-300"
            )}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)} since last
            </div>
            <div className="text-[11px] text-slate-500">Avg {trend.avg.toFixed(1)}</div>
          </div>
          <Sparkline values={trend.values} stroke={accent} />
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-500">No evaluations captured yet.</div>
      )}
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
  onOpenChecklist,
  appConfig,
  observabilitySummary,
  jobs
}) {
  const totalRepos = repos.length;
  const runCount = runs.length;
  const datasetCount = datasets.length;
  const evalCount = evaluations.length;
  const promptCount = savedPrompts.length;
  const recentRuns = runs.slice(0, 4);
  const obsRuns = observabilitySummary?.runs || {};
  const obsEvals = observabilitySummary?.evaluations || {};
  const queuedJobs = (jobs || []).filter(job => ['queued', 'running'].includes(job.status));

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
      transition={SPRING_SMOOTH}
      className="space-y-8 density-stack"
    >
      <div className="glass-panel rounded-3xl p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-3">
            Command Center
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            Operational snapshot of runs, evaluations, and knowledge coverage. Use the quickstart
            checklist to keep the system production-ready.{' '}
            <button
              type="button"
              onClick={onOpenChecklist}
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
            >
              Open checklist
            </button>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="tag-inline tag-inline-muted">Runs {runCount}</span>
            <span className="tag-inline tag-inline-muted">Evaluations {evalCount}</span>
            <span className="tag-inline tag-inline-muted">Prompts {promptCount}</span>
            <span className="tag-inline tag-inline-muted">Repos {totalRepos}</span>
          </div>
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

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Quickstart</div>
            <span className="text-[10px] text-slate-500">Keep momentum</span>
          </div>
          <div className="space-y-3 pl-1">
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

        <div className="glass-panel rounded-3xl p-6">
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
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Observability</div>
            <span className="text-[10px] text-slate-500">Last 30 days</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-300">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest">Run tokens</div>
              <div className="text-lg text-white tabular-nums">{obsRuns.totalTokens ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest">Run cost</div>
              <div className="text-lg text-white tabular-nums">${(obsRuns.totalCost ?? 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest">Avg duration</div>
              <div className="text-lg text-white tabular-nums">{formatDuration(obsRuns.avgDurationMs ?? 0)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest">Eval tokens</div>
              <div className="text-lg text-white tabular-nums">{obsEvals.totalTokens ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Queue Snapshot</div>
            <button
              type="button"
              onClick={() => onNavigate('jobs')}
              className="text-[10px] text-cyan-400 uppercase tracking-[0.3em]"
            >
              View queue
            </button>
          </div>
          {queuedJobs.length === 0 ? (
            <EmptyState title="No active jobs" subtitle="Queue is idle." />
          ) : (
            <div className="space-y-3">
              {queuedJobs.slice(0, 4).map((job) => (
                <div key={job.id} className="p-3 bg-slate-900/50 rounded-2xl border border-slate-800/60">
                  <div className="text-sm text-slate-200">{job.type}</div>
                  <div className="text-xs text-slate-500 mt-2">{job.status} • {new Date(job.createdAt).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function RunsView({ runs, apiFetch }) {
  const [selectedId, setSelectedId] = useState(runs[0]?.id || null);
  const [query, setQuery] = useState('');
  const [compareId, setCompareId] = useState('');
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');

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
        resources: (selected.resources?.total ?? 0) - (compareRun.resources?.total ?? 0),
        cost: (selected.metrics?.costEstimated ?? selected.usage?.costEstimated ?? 0) -
          (compareRun.metrics?.costEstimated ?? compareRun.usage?.costEstimated ?? 0)
      }
    : null;

  const matrix = selected?.decisionMatrix || {};
  const retrievalGate = matrix.retrievalGate?.enabled ? 'enabled' : 'disabled';
  const ragFusion = matrix.resourceSelection?.ragFusionUsed ? `used (${matrix.resourceSelection?.ragFusionVariants || 0} variants)` : 'not used';
  const hyde = matrix.resourceSelection?.hydeUsed ? 'used' : 'not used';
  const hybrid = matrix.resourceSelection?.hybridUsed ? 'enabled' : 'disabled';
  const vectorIndexLabel = matrix.resourceSelection?.vectorIndexUsed ? 'used' : 'not used';
  const lateInteraction = matrix.resourceSelection?.lateInteractionUsed ? 'used' : 'not used';
  const llmAgentMode = matrix.agentSelection?.rerankPolicy || 'n/a';
  const llmResourceMode = matrix.resourceSelection?.rerankPolicy || 'n/a';
  const agentRerankLabel = matrix.agentSelection?.rerankUsed
    ? (matrix.agentSelection?.rerankAccepted ? 'used (accepted)' : 'used (ignored)')
    : `not used${matrix.agentSelection?.rerankReason ? ` (${matrix.agentSelection.rerankReason})` : ''}`;
  const resourceRerankLabel = matrix.resourceSelection?.rerankUsed ? 'used' : 'not used';
  const perfTotal = selected?.performance?.totalMs ?? selected?.durationMs ?? 0;
  const perfSpans = Array.isArray(selected?.performance?.spans) ? selected.performance.spans : [];

  const planFileName = selected?.outputPath
    ? selected.outputPath.split(/[\\/]/).pop()
    : `cortex-run-${selected?.id || 'plan'}.md`;

  const handleExport = async (type) => {
    if (!selected || !apiFetch) return;
    setExporting(type);
    setExportError('');
    try {
      const endpoint = type === 'plan'
        ? `/runs/${selected.id}/plan`
        : `/runs/${selected.id}/export?includeOutput=true`;
      const res = await apiFetch(endpoint);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = type === 'plan' ? planFileName : `cortex-run-${selected.id}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e.message || 'Export failed');
    }
    setExporting('');
  };

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
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Run Detail</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">{selected.id}</span>
                  {selected.metrics?.issues?.length > 0 && (
                    <span
                      className="px-2 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-semibold uppercase tracking-[0.2em]"
                      title={selected.metrics.issues.join(' • ')}
                    >
                      {selected.metrics.issues.length > 1 ? `${selected.metrics.issues.length} issues` : selected.metrics.issues[0]}
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
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Cost (est)</div>
                  <div>{selected.metrics?.costEstimated ?? selected.usage?.costEstimated ?? '—'} {selected.metrics?.currency || selected.usage?.currency || ''}</div>
                </div>
              </div>
              {exportError && (
                <div className="mt-4 text-xs text-red-300 border border-red-500/30 bg-red-500/10 rounded-xl px-3 py-2">
                  {exportError}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Performance Timeline</div>
              {!perfSpans.length && (
                <EmptyState title="No performance trace" subtitle="Run spans will appear after new spawns." />
              )}
              {perfSpans.length > 0 && (
                <div className="space-y-3">
                  {perfSpans.map((span, index) => {
                    const duration = span.durationMs || 0;
                    const percent = perfTotal > 0 ? Math.min(100, Math.max(4, (duration / perfTotal) * 100)) : 0;
                    return (
                      <div key={`${span.name}-${index}`} className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/60">
                        <div className="flex items-center justify-between text-sm text-slate-200">
                          <span className="capitalize">{span.name.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-slate-500">{formatDuration(duration)}</span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-slate-950/70">
                          <div className="h-2 rounded-full bg-cyan-500/70" style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-3xl p-6">
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
                  <div className={cn("p-3 rounded-2xl border", delta.cost <= 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200")}>
                    Cost Δ {delta.cost >= 0 ? '+' : ''}{delta.cost.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {selected.git && (
              <div className="glass-panel rounded-3xl p-6">
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

            <div className="glass-panel rounded-3xl p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Decision Matrix</div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-300">
                <div>Retrieval gate: <span className="text-slate-100">{retrievalGate}</span></div>
                <div>RAG-Fusion: <span className="text-slate-100">{ragFusion}</span></div>
                <div>HyDE fallback: <span className="text-slate-100">{hyde}</span></div>
                <div>Hybrid retrieval: <span className="text-slate-100">{hybrid}</span></div>
                <div>Semantic index: <span className="text-slate-100">{vectorIndexLabel}</span></div>
                <div>Late-interaction rerank: <span className="text-slate-100">{lateInteraction}</span></div>
                <div>LLM agent mode: <span className="text-slate-100">{llmAgentMode}</span></div>
                <div>LLM agent router: <span className="text-slate-100">{agentRerankLabel}</span></div>
                <div>LLM resource mode: <span className="text-slate-100">{llmResourceMode}</span></div>
                <div>Resource rerank: <span className="text-slate-100">{resourceRerankLabel}</span></div>
                <div>Uncertainty: <span className="text-slate-100">{Math.round((matrix.uncertainty?.score || 0) * 100)}%</span></div>
                <div>Requires review: <span className="text-slate-100">{selected.metrics?.requiresReview ? 'yes' : 'no'}</span></div>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6">
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

function JobsView({ jobs, onCancelJob }) {
  const [selectedId, setSelectedId] = useState(jobs[0]?.id || null);

  useEffect(() => {
    if (!selectedId && jobs.length > 0) {
      setSelectedId(jobs[0].id);
    }
  }, [jobs, selectedId]);

  const selected = jobs.find((job) => job.id === selectedId) || jobs[0];

  const statusTone = (status) => {
    if (status === 'completed') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
    if (status === 'running') return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30';
    if (status === 'failed') return 'text-red-300 bg-red-500/10 border-red-500/30';
    if (status === 'cancelled') return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
    return 'text-slate-300 bg-slate-800/60 border-slate-700';
  };

  return (
    <motion.div
      key="jobs"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={SPRING_SMOOTH}
      className="grid lg:grid-cols-3 gap-6"
    >
      <div className="glass-panel rounded-3xl p-6 h-[calc(100vh-220px)] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Queue</div>
          <span className="text-[10px] text-slate-500">{jobs.length} jobs</span>
        </div>
        <div className="space-y-3 overflow-y-auto pr-1">
          {jobs.length === 0 && <EmptyState title="No jobs queued" subtitle="Background tasks will appear here." />}
          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedId(job.id)}
              className={cn(
                "w-full text-left p-3 rounded-2xl border transition-ui",
                job.id === selected?.id
                  ? "bg-slate-800/60 border-cyan-500/40"
                  : "bg-slate-900/40 border-slate-800/60 hover:border-slate-700"
              )}
            >
              <div className="text-sm text-slate-200">{job.type}</div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                <span className={cn("px-2 py-0.5 rounded-full border text-[10px] uppercase", statusTone(job.status))}>
                  {job.status}
                </span>
                <span>{new Date(job.createdAt).toLocaleTimeString()}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        {!selected && <EmptyState title="Select a job" subtitle="Choose a job to inspect details." />}
        {selected && (
          <div className="glass-panel rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Job Detail</div>
                <div className="text-lg text-white font-semibold">{selected.type}</div>
              </div>
              <span className={cn("px-3 py-1 rounded-full border text-xs uppercase", statusTone(selected.status))}>
                {selected.status}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-300">
              <div>Created: <span className="text-slate-100">{new Date(selected.createdAt).toLocaleString()}</span></div>
              <div>Updated: <span className="text-slate-100">{new Date(selected.updatedAt).toLocaleString()}</span></div>
              {selected.durationMs && <div>Duration: <span className="text-slate-100">{formatDuration(selected.durationMs)}</span></div>}
              {selected.runId && <div>Run: <span className="text-slate-100">{selected.runId}</span></div>}
            </div>
            {selected.error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {selected.error}
              </div>
            )}
            {['queued', 'running'].includes(selected.status) && (
              <button
                type="button"
                onClick={() => onCancelJob?.(selected.id)}
                className="px-4 py-2 rounded-2xl bg-red-500/20 text-red-300 border border-red-500/30 text-sm"
              >
                Cancel job
              </button>
            )}
            {selected.result?.stdout && (
              <pre className="text-xs text-slate-400 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-3 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {selected.result.stdout.slice(0, 2000)}
              </pre>
            )}
          </div>
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
  onImportDataset,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onImportTemplates,
  onExportTemplates
}) {
  const [selectedDatasetId, setSelectedDatasetId] = useState(datasets[0]?.id || '');
  const [datasetName, setDatasetName] = useState('');
  const [datasetDescription, setDatasetDescription] = useState('');
  const [datasetType, setDatasetType] = useState('response');
  const [itemInput, setItemInput] = useState('');
  const [itemExpected, setItemExpected] = useState('');
  const [itemExpectedPaths, setItemExpectedPaths] = useState('');
  const [itemWeight, setItemWeight] = useState('1');
  const [itemRubric, setItemRubric] = useState('');
  const [itemExpectedType, setItemExpectedType] = useState('contains');
  const [evalDatasetId, setEvalDatasetId] = useState('');
  const [evalRunId, setEvalRunId] = useState('');
  const [selectedEvaluationId, setSelectedEvaluationId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateExpectedType, setTemplateExpectedType] = useState('llm');
  const [templateRubric, setTemplateRubric] = useState('');
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const importInputRef = useRef(null);
  const templateImportRef = useRef(null);

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
  const isRetrievalDataset = selectedDataset?.benchmarkType === 'retrieval';

  const handleCreateDataset = async () => {
    if (!datasetName.trim()) return;
    const created = await onCreateDataset?.(datasetName.trim(), datasetDescription.trim(), datasetType);
    if (created) {
      setSelectedDatasetId(created.id);
      setDatasetName('');
      setDatasetDescription('');
      setDatasetType('response');
    }
  };

  const handleAddItem = async () => {
    if (!selectedDataset || !itemInput.trim()) return;
    const parsedPaths = itemExpectedPaths
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const added = await onAddDatasetItem?.(selectedDataset.id, {
      input: itemInput.trim(),
      expected: itemExpected.trim(),
      weight: Number(itemWeight) || 1,
      expectedType: isRetrievalDataset ? 'retrieval' : itemExpectedType,
      rubric: isRetrievalDataset ? '' : itemRubric.trim(),
      expectedPaths: isRetrievalDataset ? parsedPaths : []
    });
    if (added) {
      setItemInput('');
      setItemExpected('');
      setItemWeight('1');
      setItemRubric('');
      setItemExpectedType('contains');
      setItemExpectedPaths('');
    }
  };

  const handleTemplateApply = () => {
    if (isRetrievalDataset) return;
    if (!selectedTemplate) return;
    if (selectedTemplate.rubric) {
      setItemRubric(selectedTemplate.rubric);
    }
    if (selectedTemplate.expectedType) {
      setItemExpectedType(selectedTemplate.expectedType);
    }
  };

  const resetTemplateForm = () => {
    setEditingTemplateId('');
    setTemplateName('');
    setTemplateDescription('');
    setTemplateExpectedType('llm');
    setTemplateRubric('');
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    const payload = {
      name: templateName.trim(),
      description: templateDescription.trim(),
      rubric: templateRubric.trim(),
      expectedType: templateExpectedType
    };
    const saved = editingTemplateId
      ? await onUpdateTemplate?.(editingTemplateId, payload)
      : await onCreateTemplate?.(payload);
    if (saved) {
      setSelectedTemplateId(saved.id);
      resetTemplateForm();
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name || '');
    setTemplateDescription(template.description || '');
    setTemplateExpectedType(template.expectedType || 'llm');
    setTemplateRubric(template.rubric || '');
  };

  const handleDeleteTemplate = async (template) => {
    if (!template) return;
    const label = template.name ? `“${template.name}”` : 'this template';
    if (!window.confirm(`Delete ${label}?`)) return;
    await onDeleteTemplate?.(template.id);
    if (editingTemplateId === template.id) {
      resetTemplateForm();
    }
  };

  const handleExportTemplates = async () => {
    await onExportTemplates?.();
  };

  const handleImportTemplates = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed.templates || parsed.template || parsed;
      await onImportTemplates?.(payload);
    } catch (e) {
      console.error('Failed to import templates:', e);
    } finally {
      event.target.value = '';
    }
  };

  const handleExportDataset = async () => {
    if (!selectedDataset) return;
    try {
      const res = await apiFetch(`/datasets/${selectedDataset.id}/export`);
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
    if (!evalDatasetId) return;
    const dataset = datasets.find((entry) => entry.id === evalDatasetId);
    const needsRun = dataset?.benchmarkType !== 'retrieval';
    if (needsRun && !evalRunId) return;
    const created = await onCreateEvaluation?.(evalDatasetId, needsRun ? evalRunId : null);
    if (created) {
      setSelectedEvaluationId(created.id);
    }
  };

  const handleCompareEvaluations = async () => {
    if (!compareLeftId || !compareRightId) return;
    setCompareLoading(true);
    try {
      const res = await apiFetch(`/evaluations/compare?left=${encodeURIComponent(compareLeftId)}&right=${encodeURIComponent(compareRightId)}`);
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
  const evalDataset = datasets.find((dataset) => dataset.id === evalDatasetId);
  const evalNeedsRun = evalDataset?.benchmarkType !== 'retrieval';
  const deltaScore = compareResult?.delta?.score ?? 0;
  const deltaPassRate = compareResult?.delta?.passRate ?? 0;
  const deltaItemCount = compareResult?.delta?.itemCount ?? 0;
  const compareMeta = compareResult?.meta || {};

  const orderedEvaluations = [...evaluations]
    .filter((evaluation) => evaluation.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const buildTrend = (type) => {
    const values = orderedEvaluations
      .filter((evaluation) => evaluation.type === type)
      .map((evaluation) => Number(evaluation.metrics?.score ?? 0));
    const latest = values.length > 0 ? values[values.length - 1] : 0;
    const previous = values.length > 1 ? values[values.length - 2] : latest;
    const avg = values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
    return {
      values,
      latest: Number(latest.toFixed(1)),
      delta: Number((latest - previous).toFixed(1)),
      avg: Number(avg.toFixed(1)),
      count: values.length
    };
  };

  const responseTrend = buildTrend('response');
  const retrievalTrend = buildTrend('retrieval');

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
      transition={SPRING_SMOOTH}
      className="grid lg:grid-cols-3 gap-6"
    >
      <div className="glass-panel rounded-3xl p-6 space-y-5">
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
                <div className="text-xs text-slate-500 mt-1">
                  {dataset.items?.length || 0} items · {dataset.benchmarkType || 'response'} · v{dataset.version || 1}
                </div>
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
          <select
            value={datasetType}
            onChange={(e) => setDatasetType(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
          >
            <option value="response">Response evaluation</option>
            <option value="retrieval">Retrieval benchmark</option>
          </select>
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
        <div className="glass-panel rounded-3xl p-6">
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
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="tag-inline tag-inline-muted">Version v{selectedDataset.version || 1}</span>
                  <span className="tag-inline tag-inline-muted">
                    Type {selectedDataset.benchmarkType || 'response'}
                  </span>
                  {selectedDataset.updatedAt && (
                    <span className="tag-inline tag-inline-muted">
                      Updated {new Date(selectedDataset.updatedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <input
                  type="text"
                  value={itemInput}
                  onChange={(e) => setItemInput(e.target.value)}
                  placeholder="Prompt / input"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                />
                {isRetrievalDataset ? (
                  <input
                    type="text"
                    value={itemExpectedPaths}
                    onChange={(e) => setItemExpectedPaths(e.target.value)}
                    placeholder="Expected resource paths (comma-separated)"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                  />
                ) : (
                  <input
                    type="text"
                    value={itemExpected}
                    onChange={(e) => setItemExpected(e.target.value)}
                    placeholder="Expected text or regex:..."
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                  />
                )}
                {isRetrievalDataset ? (
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={itemWeight}
                    onChange={(e) => setItemWeight(e.target.value)}
                    placeholder="Weight"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                  />
                ) : (
                  <select
                    value={itemExpectedType}
                    onChange={(e) => setItemExpectedType(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                  >
                    <option value="contains">Contains</option>
                    <option value="regex">Regex</option>
                    <option value="llm">LLM Rubric</option>
                  </select>
                )}
                {!isRetrievalDataset && (
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={itemWeight}
                    onChange={(e) => setItemWeight(e.target.value)}
                    placeholder="Weight"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                  />
                )}
              </div>
              {!isRetrievalDataset && (
                <>
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
                </>
              )}
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
                    {item.expectedPaths?.length > 0 && (
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        Expected paths: {item.expectedPaths.join(', ')}
                      </div>
                    )}
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

        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Evaluation Trends</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <TrendCard label="Response" trend={responseTrend} accent="#38bdf8" />
              <TrendCard label="Retrieval" trend={retrievalTrend} accent="#22c55e" />
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-6">
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
                disabled={!evalNeedsRun}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              >
                <option value="">{evalNeedsRun ? 'Select run' : 'Not required for retrieval'}</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>{(run.goal || 'Untitled run').substring(0, 60)}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleCreateEvaluation}
              disabled={!evalDatasetId || (evalNeedsRun && !evalRunId)}
              className="px-4 py-2 rounded-2xl bg-emerald-500/90 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-sm font-semibold transition-ui"
            >
              Create evaluation
            </button>
          <div className="mt-6 space-y-3">
            {evaluations.length === 0 && <EmptyState title="No evaluations yet" subtitle="Create one to capture scores." />}
            {evaluations.map((evaluation) => {
              const isRetrieval = evaluation.type === 'retrieval';
              const detail = isRetrieval
                ? `Recall@${evaluation.metrics?.topK ?? 0} ${Math.round((evaluation.metrics?.recallAtK || 0) * 100)}% · MRR ${(evaluation.metrics?.mrr || 0).toFixed(2)} · Items ${evaluation.metrics?.itemCount ?? 0}`
                : `Score ${evaluation.metrics?.score ?? '—'} · Pass ${Math.round((evaluation.metrics?.passRate || 0) * 100)}% · Items ${evaluation.metrics?.itemCount ?? 0}`;
              return (
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
                    {detail} · v{evaluation.datasetVersion || 1}
                  </div>
                </button>
              );
            })}
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
            {(compareMeta.datasetMismatch || compareMeta.datasetVersionMismatch) && (
              <div className="mt-3 text-xs text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-xl px-3 py-2">
                {compareMeta.datasetMismatch ? 'Comparing different datasets.' : 'Dataset versions differ between evaluations.'}
              </div>
            )}
          </div>
          {selectedEvaluation && (
            <div className="mt-6">
              {selectedEvaluation.type === 'retrieval' ? (
                <div className="grid sm:grid-cols-3 gap-3 mb-4 text-xs text-slate-300">
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    Recall@{selectedEvaluation.metrics?.topK ?? 0}{' '}
                    <span className="text-slate-100">{Math.round((selectedEvaluation.metrics?.recallAtK || 0) * 100)}%</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    Precision@{selectedEvaluation.metrics?.topK ?? 0}{' '}
                    <span className="text-slate-100">{Math.round((selectedEvaluation.metrics?.precisionAtK || 0) * 100)}%</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    MRR <span className="text-slate-100">{(selectedEvaluation.metrics?.mrr || 0).toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3 mb-4 text-xs text-slate-300">
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    LLM calls <span className="text-slate-100">{selectedEvaluation.usage?.llmCalls ?? selectedEvaluation.metrics?.llmCalls ?? 0}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    LLM tokens <span className="text-slate-100">{selectedEvaluation.usage?.tokensEstimated ?? 0}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    LLM cost <span className="text-slate-100">${(selectedEvaluation.usage?.costEstimated ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
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
                    {item.expectedPaths?.length > 0 && (
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        Expected paths: {item.expectedPaths.join(', ')}
                      </div>
                    )}
                    {selectedEvaluation.type === 'retrieval' ? (
                      <div className="text-[10px] text-slate-500 mt-2">
                        Precision {Math.round((item.precision || 0) * 100)}% · Recall {Math.round((item.recall || 0) * 100)}% · MRR {(item.mrr || 0).toFixed(2)}
                      </div>
                    ) : (
                    <div className="text-[10px] text-slate-500 mt-2">
                      Score {Math.round((item.score || 0) * 100)} · Weight {item.weight || 1} · {item.method}
                    </div>
                    )}
                    {item.notes && (
                      <div className="text-[10px] text-slate-500 mt-2">Notes: {item.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Rubric Templates</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportTemplates}
                className="text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => templateImportRef.current?.click()}
                className="text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
              >
                Import
              </button>
            </div>
          </div>
          <input
            ref={templateImportRef}
            type="file"
            accept="application/json"
            onChange={handleImportTemplates}
            className="hidden"
          />
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {templates.length === 0 && (
                <EmptyState title="No templates yet" subtitle="Create a rubric template to standardize grading." />
              )}
              {templates.map((template) => (
                <div key={template.id} className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-200">{template.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{template.description || 'No description'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditTemplate(template)}
                        className="text-xs px-2 py-1 rounded-full border border-slate-700 text-slate-300 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(template)}
                        className="text-xs px-2 py-1 rounded-full border border-red-500/40 text-red-300 hover:text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">Type: {template.expectedType || 'llm'}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">
                {editingTemplateId ? 'Edit Template' : 'Create Template'}
              </div>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              />
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              />
              <select
                value={templateExpectedType}
                onChange={(e) => setTemplateExpectedType(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              >
                <option value="llm">LLM rubric</option>
                <option value="contains">Contains</option>
                <option value="regex">Regex</option>
              </select>
              <textarea
                value={templateRubric}
                onChange={(e) => setTemplateRubric(e.target.value)}
                placeholder="Rubric instructions"
                rows={4}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="px-4 py-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-semibold"
                >
                  {editingTemplateId ? 'Save changes' : 'Create template'}
                </button>
                {editingTemplateId && (
                  <button
                    type="button"
                    onClick={resetTemplateForm}
                    className="px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm border border-slate-700/60"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
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
    if (p.includes("agent")) return { text: "text-slate-300", bg: "bg-white/5", badge: "text-slate-200 border-white/10 bg-white/5" };
    if (p.includes("skill")) return { text: "text-slate-300", bg: "bg-white/5", badge: "text-slate-200 border-white/10 bg-white/5" };
    if (p.includes("knowledge")) return { text: "text-slate-300", bg: "bg-white/5", badge: "text-slate-200 border-white/10 bg-white/5" };
    if (p.includes("tool")) return { text: "text-slate-300", bg: "bg-white/5", badge: "text-slate-200 border-white/10 bg-white/5" };
    if (p.includes("benchmark")) return { text: "text-slate-300", bg: "bg-white/5", badge: "text-slate-200 border-white/10 bg-white/5" };
    return { text: "text-slate-300", bg: "bg-white/5", badge: "text-slate-200 border-white/10 bg-white/5" };
  }

  const Icon = getIcon(repo.Purpose);
  const color = getPurposeColor(repo.Purpose);

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING_FAST, delay }}
      className="border-b border-white/5 hover:bg-white/[0.03] group"
    >
      <td className="py-2.5 pl-5 pr-4">
        <div className="flex items-center gap-3.5">
          <div className={cn("p-1.5 rounded-xl transition-ui group-hover:scale-105", color.bg)}>
            <Icon size={16} className={color.text} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-200 group-hover:text-slate-100 text-sm">{repo.Name}</div>
            <div className="text-[10px] text-slate-500 font-mono truncate max-w-[220px] mt-0.5 opacity-70">{repo.Path}</div>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-4">
        <div className="tag-inline tag-inline-muted font-mono text-[10px]">
          <GitBranch size={12} aria-hidden="true" />
          {repo.Branch}
        </div>
      </td>
      <td className="py-2.5 px-4">
        <span className={cn("tag-inline", color.badge)}>
          {repo.Purpose}
        </span>
      </td>
    </motion.tr>
  )
}

function RepoTable({ repos }) {
  return (
    <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl shadow-black/30" data-testid="repos-table">
      <div className="px-6 py-3 border-b border-white/5 flex justify-between items-center bg-slate-900/20">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
          <Database size={16} className="text-slate-500" aria-hidden="true" />
          Tracked Resources
        </h3>
        <span className="tag-inline tag-inline-muted font-mono tabular-nums">{repos.length} Items</span>
      </div>
      <div
        className="overflow-x-auto"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}
      >
        <table className="w-full text-left border-collapse text-sm tabular-nums density-table">
          <thead className="table-head text-slate-400 text-[10px] font-medium tracking-[0.14em] border-b border-white/5">
            <tr>
              <th className="py-2.5 pl-5 pr-4">Name / Path</th>
              <th className="py-2.5 px-4">Branch</th>
              <th className="py-2.5 px-4">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
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
        "nav-pill w-full flex items-center gap-3 px-4 py-2.5 rounded-full transition-ui text-[11px] font-semibold group no-underline",
        active
          ? "nav-pill-active text-slate-100"
          : "text-slate-400 hover:text-slate-200"
      )}
    >
      <Icon size={20} className={cn("", active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300")} aria-hidden="true" />
      <span className="font-display uppercase tracking-[0.26em] text-[11px] leading-none">{label}</span>

      {badge && (
        <span className={cn("ml-auto tag-chip tag-chip-muted tabular-nums", active ? "text-slate-100" : "text-slate-300")}>
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
  const [externalSkillsInstalled, setExternalSkillsInstalled] = useState([]);
  const [status, setStatus] = useState('Online');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoAction, setRepoAction] = useState(null);
  const [repoNotice, setRepoNotice] = useState(null);
  const repoNoticeTimeoutRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlView = params.get('view');
    const normalized = urlView === 'dashboard'
      ? 'home'
      : urlView === 'repos' || urlView === 'repositories'
        ? 'knowledge'
        : urlView;
    return (normalized && VIEW_KEYS.includes(normalized)) ? normalized : 'home';
  });
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
  const [jobs, setJobs] = useState([]);
  const [observabilitySummary, setObservabilitySummary] = useState(null);
  const [vectorStatus, setVectorStatus] = useState(null);
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [authStatus, setAuthStatus] = useState({ enabled: false, bootstrapNeeded: false });
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [uiTheme, setUiTheme] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    return window.localStorage.getItem(THEME_KEY) || 'system';
  });
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistContent, setChecklistContent] = useState('');
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState('');

  // New state for config/setup
  const [appConfig, setAppConfig] = useState(null);
  const [isFirstRun, setIsFirstRun] = useState(null); // null = loading
  const [defaultPaths, setDefaultPaths] = useState({});
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(THEME_KEY);
    const configTheme = appConfig?.config?.ui?.theme;
    if (!stored && configTheme) {
      setUiTheme(configTheme);
    }
  }, [appConfig?.config?.ui?.theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_KEY, uiTheme);
    const root = document.documentElement;

    if (uiTheme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const applySystemTheme = () => {
        root.setAttribute('data-theme', media.matches ? 'dark' : 'light');
        root.setAttribute('data-theme-mode', 'system');
      };
      applySystemTheme();
      media.addEventListener('change', applySystemTheme);
      return () => media.removeEventListener('change', applySystemTheme);
    }

    root.setAttribute('data-theme', uiTheme);
    root.setAttribute('data-theme-mode', uiTheme);
  }, [uiTheme]);

  const loadChecklist = async (force = false) => {
    if (!force && checklistContent) return;
    setChecklistLoading(true);
    setChecklistError('');
    try {
      const res = await apiFetch('/checklist');
      if (!res.ok) {
        throw new Error(`Checklist request failed (${res.status})`);
      }
      const text = await res.text();
      setChecklistContent(text);
    } catch (err) {
      console.error('Checklist load failed:', err);
      setChecklistError('Failed to load the checklist. Please try again.');
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleOpenChecklist = () => {
    setChecklistOpen(true);
    loadChecklist(false);
  };

  const handleRefreshChecklist = () => {
    loadChecklist(true);
  };

  const handleCopyChecklist = async () => {
    if (!checklistContent) return;
    try {
      await navigator.clipboard.writeText(checklistContent);
    } catch (err) {
      console.error('Checklist copy failed:', err);
    }
  };

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

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setAuthUser(null);
      setAuthError('Session expired. Please sign in again.');
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (authStatus.enabled && !authUser) return;
    checkConfig();
  }, [authReady, authStatus.enabled, authUser]);

  const initializeAuth = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/status`);
      const data = await res.json();
      setAuthStatus(data);
      if (!data.enabled) {
        setAuthReady(true);
        return;
      }

      const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        const meRes = await apiFetch(`/auth/me`);
        if (meRes.ok) {
          const meData = await meRes.json();
          setAuthUser(meData.user || null);
        } else {
          window.localStorage.removeItem(AUTH_TOKEN_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to initialize auth:', e);
    } finally {
      setAuthReady(true);
    }
  };

  const handleLogin = async (username, password) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        setAuthUser(data.user || null);
      } else {
        setAuthError(data?.error || 'Login failed.');
      }
    } catch (e) {
      setAuthError('Login failed. Check server connectivity.');
    }
    setAuthLoading(false);
  };

  const handleBootstrap = async (username, password) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        setAuthUser(data.user || null);
        setAuthStatus((prev) => ({ ...prev, bootstrapNeeded: false }));
      } else {
        setAuthError(data?.error || 'Bootstrap failed.');
      }
    } catch (e) {
      setAuthError('Bootstrap failed. Check server connectivity.');
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthUser(null);
  };

  const handleWorkspaceSwitch = (workspaceId) => {
    if (!workspaceId) return;
    window.localStorage.setItem(WORKSPACE_KEY, workspaceId);
    const selected = workspaces.find((ws) => ws.id === workspaceId) || null;
    setActiveWorkspace(selected);
    fetchData();
    fetchSessions();
  };

  const checkConfig = async () => {
    try {
      const [configRes, pathsRes] = await Promise.all([
        apiFetch(`/config`),
        apiFetch(`/default-paths`)
      ]);
      if (!configRes.ok) {
        return;
      }
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
    fetchWorkspaces();
    fetchRepos();
    fetchCategories();
    fetchExternalSkillsInstalled();
    fetchRuns();
    fetchAuditLogs();
    fetchDatasets();
    fetchEvaluations();
    fetchAgents();
    fetchTools();
    fetchSavedPrompts();
    fetchEvaluationTemplates();
    fetchJobs();
    fetchObservabilitySummary();
    fetchVectorStatus();
    if (authStatus.enabled && authUser?.role === 'admin') {
      fetchUsers();
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await apiFetch(`/audit?limit=200`);
      if (!res.ok) return;
      const data = await res.json();
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await apiFetch(`/workspaces/active`);
      if (!res.ok) return;
      const data = await res.json();
      const active = data.active || null;
      const list = Array.isArray(data.workspaces) ? data.workspaces : [];
      setActiveWorkspace(active);
      setWorkspaces(list);
      if (active?.id && !window.localStorage.getItem(WORKSPACE_KEY)) {
        window.localStorage.setItem(WORKSPACE_KEY, active.id);
      }
    } catch (e) {
      console.error('Failed to fetch workspaces:', e);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await apiFetch(`/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  };

  const fetchRuns = async () => {
    try {
      const res = await apiFetch(`/runs`);
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch runs:', e);
    }
  };

  const fetchDatasets = async () => {
    try {
      const res = await apiFetch(`/datasets`);
      const data = await res.json();
      setDatasets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch datasets:', e);
    }
  };

  const fetchEvaluations = async () => {
    try {
      const res = await apiFetch(`/evaluations`);
      const data = await res.json();
      setEvaluations(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch evaluations:', e);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await apiFetch(`/agents`);
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    }
  };

  const fetchTools = async () => {
    try {
      const res = await apiFetch(`/tools`);
      const data = await res.json();
      setTools(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch tools:', e);
    }
  };

  const fetchSavedPrompts = async () => {
    try {
      const res = await apiFetch(`/prompts`);
      const data = await res.json();
      setSavedPrompts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch saved prompts:', e);
    }
  };

  const fetchEvaluationTemplates = async () => {
    try {
      const res = await apiFetch(`/evaluation-templates`);
      const data = await res.json();
      setEvaluationTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch evaluation templates:', e);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await apiFetch(`/jobs`);
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
    }
  };

  const fetchObservabilitySummary = async () => {
    try {
      const res = await apiFetch(`/observability/summary`);
      const data = await res.json();
      setObservabilitySummary(data);
    } catch (e) {
      console.error('Failed to fetch observability summary:', e);
    }
  };

  const fetchVectorStatus = async () => {
    try {
      const res = await apiFetch(`/vector-index/status`);
      const data = await res.json();
      setVectorStatus(data);
    } catch (e) {
      console.error('Failed to fetch vector status:', e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch(`/users`);
      if (!res.ok) return;
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiFetch(`/categories`);
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
      const res = await apiFetch(`/category-sizes`);
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

  const fetchExternalSkillsInstalled = async () => {
    try {
      const res = await apiFetch(`/external-skills/installed`);
      if (!res.ok) return;
      const data = await res.json();
      setExternalSkillsInstalled(Array.isArray(data?.installed) ? data.installed : []);
    } catch (e) {
      console.error('Failed to fetch external skills:', e);
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
      const res = await apiFetch(`/repos`);
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
      const res = await apiFetch(`/prompts`, {
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
      const res = await apiFetch(`/prompts/${id}`, { method: 'DELETE' });
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

  const createDataset = async (name, description, benchmarkType = 'response') => {
    try {
      const res = await apiFetch(`/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, benchmarkType })
      });
      const data = await res.json();
      if (data.success) {
        setDatasets(prev => [data.dataset, ...prev]);
        addLog(`Dataset created: ${name}`);
        fetchEvaluations();
        return data.dataset;
      }
    } catch (e) {
      console.error('Failed to create dataset:', e);
    }
    return null;
  };

  const deleteDataset = async (id) => {
    try {
      const res = await apiFetch(`/datasets/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDatasets(prev => prev.filter(dataset => dataset.id !== id));
        addLog(`Dataset deleted: ${id}`);
        return true;
      }
    } catch (e) {
      console.error('Failed to delete dataset:', e);
    }
    return false;
  };

  const addDatasetItem = async (datasetId, item) => {
    try {
      const res = await apiFetch(`/datasets/${datasetId}/items`, {
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
      const res = await apiFetch(`/evaluations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId, runId })
      });
      const data = await res.json();
      if (data.success) {
        setEvaluations(prev => [data.evaluation, ...prev]);
        addLog(`Evaluation created for dataset ${datasetId}`);
        return data.evaluation;
      }
    } catch (e) {
      console.error('Failed to create evaluation:', e);
    }
    return null;
  };

  const importDataset = async (datasetPayload) => {
    try {
      const res = await apiFetch(`/datasets/import`, {
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

  const createEvaluationTemplate = async (payload) => {
    try {
      const res = await apiFetch(`/evaluation-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setEvaluationTemplates(prev => [data.template, ...prev]);
        return data.template;
      }
    } catch (e) {
      console.error('Failed to create template:', e);
    }
    return null;
  };

  const updateEvaluationTemplate = async (id, payload) => {
    try {
      const res = await apiFetch(`/evaluation-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setEvaluationTemplates(prev => prev.map((template) => template.id === id ? data.template : template));
        return data.template;
      }
    } catch (e) {
      console.error('Failed to update template:', e);
    }
    return null;
  };

  const deleteEvaluationTemplate = async (id) => {
    try {
      const res = await apiFetch(`/evaluation-templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEvaluationTemplates(prev => prev.filter((template) => template.id !== id));
        return true;
      }
    } catch (e) {
      console.error('Failed to delete template:', e);
    }
    return false;
  };

  const importEvaluationTemplates = async (payload) => {
    try {
      const res = await apiFetch(`/evaluation-templates/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: payload })
      });
      const data = await res.json();
      if (data.success) {
        await fetchEvaluationTemplates();
        return data.templates || [];
      }
    } catch (e) {
      console.error('Failed to import templates:', e);
    }
    return [];
  };

  const exportEvaluationTemplates = async () => {
    try {
      const res = await apiFetch(`/evaluation-templates/export`);
      const data = await res.json();
      if (!res.ok) return;
      const templates = data.templates || [];
      const blob = new Blob([JSON.stringify({ templates }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evaluation-templates-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export templates:', e);
    }
  };

  const rebuildVectorIndex = async () => {
    try {
      const res = await apiFetch(`/vector-index/rebuild`, { method: 'POST' });
      const data = await res.json();
      if (data?.queued) {
        addLog('Vector index rebuild queued.');
        fetchJobs();
      } else {
        addLog('Vector index rebuild complete.');
        fetchVectorStatus();
      }
    } catch (e) {
      console.error('Vector index rebuild failed:', e);
    }
  };

  const createUser = async ({ username, password, role, workspaceId }) => {
    try {
      const res = await apiFetch(`/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, workspaceId })
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      }
    } catch (e) {
      console.error('Failed to create user:', e);
    }
  };

  const updateUser = async (id, updates) => {
    try {
      const res = await apiFetch(`/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      }
    } catch (e) {
      console.error('Failed to update user:', e);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      }
    } catch (e) {
      console.error('Failed to delete user:', e);
    }
  };

  const createWorkspace = async (payload) => {
    try {
      const res = await apiFetch(`/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        fetchWorkspaces();
      }
    } catch (e) {
      console.error('Failed to create workspace:', e);
    }
  };

  const updateWorkspace = async (id, payload) => {
    try {
      const res = await apiFetch(`/workspaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        fetchWorkspaces();
      }
    } catch (e) {
      console.error('Failed to update workspace:', e);
    }
  };

  const deleteWorkspace = async (id) => {
    if (!window.confirm('Delete this workspace?')) return;
    try {
      const res = await apiFetch(`/workspaces/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchWorkspaces();
      }
    } catch (e) {
      console.error('Failed to delete workspace:', e);
    }
  };

  const setDefaultWorkspace = async (id) => {
    try {
      const res = await apiFetch(`/workspaces/${id}/default`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchWorkspaces();
      }
    } catch (e) {
      console.error('Failed to set default workspace:', e);
    }
  };

  const cancelJob = async (id) => {
    try {
      const res = await apiFetch(`/jobs/${id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchJobs();
      }
    } catch (e) {
      console.error('Failed to cancel job:', e);
    }
  };

  const handleScan = async () => {
    setRepoLoading(true);
    setRepoAction('scan');
    pushRepoNotice('Scanning repositories…', 'info', 0);
    try {
      addLog("Starting System Scan…");
      const res = await apiFetch(`/scan`, { method: 'POST' });
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
      const res = await apiFetch(`/add`, {
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

  const handleSpawn = async (goal, format = 'universal', runInBackground = false, externalSkillsRequest = null) => {
    setLoading(true);
    setSpawnResult('');
    addLog(`Orchestrating agent for: “${goal}”…`);
    try {
      const res = await apiFetch(`/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, format, async: runInBackground, externalSkills: externalSkillsRequest })
      });
      const data = await res.json();
      if (data.success) {
        if (data.queued) {
          setSpawnResult(`Spawn queued as ${data.job?.id}. Monitor Jobs for progress.`);
          addLog(`Spawn queued (${data.job?.id || 'job'}).`);
          fetchJobs();
        } else {
          setSpawnResult(data.output);
          addLog("Agent Spawned Successfully");

          // Save session
          await apiFetch(`/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal, agent: 'std-agent', output: data.output, format })
          });
          fetchSessions();
          fetchRuns();
        }
      } else {
        addLog(`Spawn Error: ${data.error}`);
      }
    } catch (e) {
      addLog("Spawn request failed. Check the server and try again.");
    }
    setLoading(false);
  };

  const addLog = (msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 200));
  };

  /* Seed system logs from recent audit trail so Logs view is never empty on load */
  useEffect(() => {
    if (auditLogs.length > 0 && logs.length === 0) {
      const seeded = auditLogs.slice(0, 20).reverse().map(entry => {
        const rawTs = entry.ts || entry.timestamp;
        const ts = rawTs ? new Date(rawTs).toLocaleTimeString() : '—';
        const meta = entry.metadata || entry.meta || {};
        const detail = meta.name || meta.source || meta.id || '';
        return `[${ts}] ${entry.event}${detail ? ': ' + detail : ''}`;
      });
      setLogs(seeded);
    }
  }, [auditLogs]);

  if (authStatus.enabled && !authReady) {
    return (
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        <div className="min-h-screen flex items-center justify-center app-shell">
          <div className="flex items-center gap-4 text-cyan-400" role="status" aria-live="polite">
            <RefreshCw size={24} className="animate-spin" aria-hidden="true" />
            <span className="text-xl">Authenticating…</span>
          </div>
        </div>
      </MotionConfig>
    );
  }

  if (authStatus.enabled && authStatus.bootstrapNeeded && !authUser) {
    return (
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        <BootstrapAdminScreen onBootstrap={handleBootstrap} loading={authLoading} error={authError} />
      </MotionConfig>
    );
  }

  if (authStatus.enabled && !authUser) {
    return (
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        <LoginScreen onLogin={handleLogin} loading={authLoading} error={authError} />
      </MotionConfig>
    );
  }

  // Show loading state while checking config
  if (isFirstRun === null) {
    return (
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        <div className="min-h-screen flex items-center justify-center app-shell">
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
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        <SetupWizard onComplete={handleSetupComplete} defaultPath={defaultPaths.reposRoot} />
      </MotionConfig>
    );
  }

  // Group repos by category (dynamic)
  const categorized = {};
  categories.forEach(cat => {
    categorized[cat] = repos.filter(r => r.Purpose?.toLowerCase().includes(cat.toLowerCase()));
  });
  const externalSkillsCount = externalSkillsInstalled.length;
  const latestExternalSkills = runs[0]?.decisionMatrix?.resourceSelection?.externalSkills || null;
  const externalSkillsInstalledThisRun = Array.isArray(latestExternalSkills?.installed)
    ? latestExternalSkills.installed.filter((item) => item?.installed === true).length
    : 0;

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
    jobs: {
      title: 'Job Queue',
      subtitle: 'Monitor background tasks and queued spawns.'
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
    audit: {
      title: 'Audit Trail',
      subtitle: 'Security and compliance events across workspaces.'
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
  const mainPadding = view === 'agents'
    ? 'pl-4 pr-6 pt-4 pb-8'
    : 'pl-4 pr-6 py-8';
  const handleViewChange = (nextView) => {
    if (nextView === view) return;
    if (dirtyGoal && view === 'agents') {
      const confirmLeave = window.confirm('You have an unsent goal. Leave this page?');
      if (!confirmLeave) return;
      setDirtyGoal(false);
    }
    setView(nextView);
  };

  const handleAgentUsePrompt = (query) => {
    setPrefillGoal(query);
  };

  const handleLibraryUsePrompt = (query) => {
    handleAgentUsePrompt(query);
    handleViewChange('agents');
  };

  const handlePrefillConsumed = () => {
    setPrefillGoal('');
  };

  const handleConfigSave = (newConfig) => {
    setAppConfig(prev => ({ ...prev, config: newConfig }));
    const enabled = newConfig?.auth?.enabled === true;
    setAuthStatus((prev) => ({ ...prev, enabled }));
    if (!enabled) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      setAuthUser(null);
    } else {
      initializeAuth();
    }
  };

  return (
    <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
      <a href="#main-content" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:bg-slate-900 focus-visible:text-white focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-lg">
        Skip to main content
      </a>
      <div
        className="min-h-screen flex text-slate-100 selection:bg-cyan-500/30 app-shell"
        data-density={appConfig?.config?.ui?.density || 'comfortable'}
      >

      {/* Sidebar */}
      <nav className="w-64 glass-panel sidebar-shell flex flex-col h-screen sticky top-0 shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 text-cyan-400 mb-8 pl-1">
            <div className="bg-black rounded-2xl p-3 relative overflow-visible">
              <div className="brain-glow absolute -inset-2 rounded-[20px] bg-[radial-gradient(circle_at_28%_35%,rgba(93,126,166,0.55),transparent_64%),radial-gradient(circle_at_72%_55%,rgba(79,110,146,0.5),transparent_66%)] blur-xl opacity-80 pointer-events-none"></div>
              <img
                src={brainIcon}
                alt="Cortex Brain"
                width="40"
                height="40"
                fetchpriority="high"
                className="relative z-10 w-10 h-10 object-contain"
                style={{ filter: 'drop-shadow(0 0 10px rgba(93,126,166,0.6)) drop-shadow(0 0 14px rgba(79,110,146,0.5))' }}
              />
            </div>
            <span className="font-display font-bold text-3xl tracking-tighter text-white">CORTEX</span>
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
              icon={BarChart3}
              label="Jobs"
              badge={jobs.length}
              active={view === 'jobs'}
              href="?view=jobs"
              onClick={() => handleViewChange('jobs')}
              testId="nav-jobs"
            />
            <NavItem
              icon={FlaskConical}
              label="Evaluations"
              badge={datasets.length + evaluations.length}
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
              icon={History}
              label="Audit Trail"
              active={view === 'audit'}
              href="?view=audit"
              onClick={() => handleViewChange('audit')}
              testId="nav-audit"
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
            <span className={`text-[10px] font-semibold uppercase tracking-[0.28em] font-display ${status === 'Online' ? 'text-emerald-400' : 'text-red-400'}`}>System {status}</span>
          </div>
          <div className="text-[10px] text-slate-600 font-display mt-2">v{APP_VERSION} • Cross-Platform</div>
          <a
            href={MANUAL_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] font-display text-slate-400 hover:text-slate-200 transition-ui"
          >
            <BookOpen size={14} aria-hidden="true" />
            User Manual
          </a>
          {authStatus.enabled && authUser && (
            <div className="mt-4 text-xs text-slate-400">
              <div>Signed in as <span className="text-slate-200">{authUser.username}</span></div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">{authUser.role}</div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 text-[10px] uppercase tracking-widest text-red-300 hover:text-red-200"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" className={cn("flex-1 min-w-0", mainPadding)}>

        {/* Top Bar */}
        {showHeader && (
          <header className="top-bar flex justify-between items-center mb-8 py-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-[0.04em] text-slate-100 mb-2 font-display">{headerMeta.title}</h1>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 font-semibold">{headerMeta.subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={MANUAL_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-800/70 bg-slate-900/50 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 hover:text-white transition-ui"
              >
                <BookOpen size={14} aria-hidden="true" />
                User Manual
              </a>
              {activeWorkspace && (
                <div className="px-4 py-2 rounded-2xl border border-slate-800/70 bg-slate-900/50 flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Workspace</span>
                  {authUser?.role === 'admin' && workspaces.length > 1 ? (
                    <select
                      value={activeWorkspace.id}
                      onChange={(e) => handleWorkspaceSwitch(e.target.value)}
                      className="bg-transparent text-xs text-slate-100 font-semibold focus:outline-none"
                    >
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id} className="bg-slate-950 text-slate-100">
                          {workspace.name || workspace.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-100 font-semibold">
                      {activeWorkspace.name || activeWorkspace.id}
                    </span>
                  )}
                </div>
              )}
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
              onOpenChecklist={handleOpenChecklist}
              appConfig={appConfig}
              observabilitySummary={observabilitySummary}
              jobs={jobs}
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
              onUsePrompt={handleAgentUsePrompt}
              onDirtyChange={setDirtyGoal}
              prefillGoal={prefillGoal}
              onPrefillConsumed={handlePrefillConsumed}
              queueEnabled={appConfig?.config?.queue?.enabled === true}
              externalSkillsConfig={appConfig?.config?.externalSkills}
              latestRun={runs[0] || null}
            />
          )}

          {view === 'runs' && (
            <RunsView runs={runs} apiFetch={apiFetch} />
          )}

          {view === 'jobs' && (
            <JobsView jobs={jobs} onCancelJob={cancelJob} />
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
              onCreateTemplate={createEvaluationTemplate}
              onUpdateTemplate={updateEvaluationTemplate}
              onDeleteTemplate={deleteEvaluationTemplate}
              onImportTemplates={importEvaluationTemplates}
              onExportTemplates={exportEvaluationTemplates}
            />
          )}

          {view === 'library' && (
            <LibraryView
              savedPrompts={savedPrompts}
              agents={agents}
              tools={tools}
              onDeletePrompt={deletePrompt}
              onUsePrompt={handleLibraryUsePrompt}
              EmptyState={EmptyState}
              transition={SPRING_SMOOTH}
            />
          )}

          {view === 'knowledge' && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
      transition={SPRING_SMOOTH}
            >
              {/* Repository Overview */}
              <div className="glass-panel rounded-3xl px-6 py-4 mb-8">
                {categories.length === 0 ? (
                  <div className="text-sm text-slate-500 py-4">Initializing Knowledge Base…</div>
                ) : (
                    <div className="flex flex-wrap items-center gap-6">
                      {categories.map((cat, i) => {
                        const sizeBytes = categorySizes[cat.toLowerCase()] ?? 0;
                        const testKey = cat.toLowerCase();
                        const count = categorized[cat] ? categorized[cat].length : 0;
                        const label = cat.toLowerCase() === 'skills' ? 'Skill Repos' : cat;
                        return (
                          <div
                            key={cat}
                            data-testid={`stat-card-${testKey}`}
                            className="flex items-center gap-4 pr-6 border-r border-white/5 last:border-r-0"
                          >
                            <div>
                              <div className="text-[10px] font-medium text-slate-500 tracking-[0.18em] uppercase">
                                {label}
                              </div>
                              <div className="text-2xl font-semibold text-slate-100 tabular-nums">
                                {count}
                              </div>
                              <div className="text-[11px] text-slate-500" data-testid={`stat-size-${testKey}`}>
                                Size {formatBytes(sizeBytes)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div
                        data-testid="stat-card-external-skills"
                        className="flex items-center gap-4 pr-6"
                      >
                        <div>
                          <div className="text-[10px] font-medium text-slate-500 tracking-[0.18em] uppercase">
                            External Skills
                          </div>
                          <div className="text-2xl font-semibold text-slate-100 tabular-nums">
                            {externalSkillsCount}
                            {externalSkillsInstalledThisRun > 0 && (
                              <span className="ml-2 inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                                +{externalSkillsInstalledThisRun}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Installed from providers
                          </div>
                        </div>
                      </div>
                    </div>
                )}
              </div>

              <div className="glass-panel rounded-3xl p-6 mb-8">
                <div className="mb-3">
                  <label
                    htmlFor="repo-url"
                    className="tag-inline tag-inline-muted"
                  >
                    Add Repository
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-3xl">
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
                      className="w-full bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 focus-visible:border-cyan-500/50 rounded-2xl px-4 py-3 text-sm focus-visible:outline-none transition-ui placeholder:text-slate-600 shadow-inner"
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

          {view === 'audit' && (
            <AuditView
              auditLogs={auditLogs}
              apiFetch={apiFetch}
              EmptyState={EmptyState}
              transition={SPRING_SMOOTH}
            />
          )}

          {view === 'logs' && (
            <LogsView logs={logs} transition={SPRING_SMOOTH} />
          )}

          {view === 'settings' && (
            <SettingsPanel
              config={appConfig}
              onSave={handleConfigSave}
              uiTheme={uiTheme}
              onThemeChange={setUiTheme}
              authStatus={authStatus}
              authUser={authUser}
              users={users}
              onCreateUser={createUser}
              onUpdateUser={updateUser}
              onDeleteUser={deleteUser}
              vectorStatus={vectorStatus}
              onRebuildVector={rebuildVectorIndex}
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onCreateWorkspace={createWorkspace}
              onUpdateWorkspace={updateWorkspace}
              onDeleteWorkspace={deleteWorkspace}
              onSetDefaultWorkspace={setDefaultWorkspace}
              apiFetch={apiFetch}
              cn={cn}
              defaultRbacRoles={DEFAULT_RBAC_ROLES}
              manualUrl={MANUAL_URL}
              transition={SPRING_SMOOTH}
            />
          )}
        </AnimatePresence>

      </main>
      </div>

      <ChecklistModal
        isOpen={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        content={checklistContent}
        loading={checklistLoading}
        error={checklistError}
        onRefresh={handleRefreshChecklist}
        onCopy={handleCopyChecklist}
      />
    </MotionConfig>
  )
}

export default App


