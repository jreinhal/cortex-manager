import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal, LayoutDashboard, Database, Cpu, Wrench,
  BarChart3, Search, Plus, RefreshCw, CheckCircle2,
  AlertCircle, ChevronRight, Activity, GitBranch, Folder,
  Package, Settings, FolderOpen, Check, X, Clock,
  TrendingUp, Zap, History, ExternalLink, HardDrive,
  ChevronUp, FolderInput
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import brainIcon from './assets/brain.png'

const API_BASE = 'http://localhost:3001/api';

// --- Utils ---
function cn(...inputs) {
  return twMerge(clsx(inputs));
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

  const fetchDirectory = async (path = '') => {
    setLoading(true);
    setError(null);
    try {
      const url = path
        ? `${API_BASE}/browse?path=${encodeURIComponent(path)}`
        : `${API_BASE}/browse`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCurrentPath(data.path);
        setItems(data.items || []);
        setParentPath(data.parent);
      }
    } catch (e) {
      setError('Failed to browse directory');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchDirectory(initialPath || '');
    }
  }, [isOpen, initialPath]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <FolderInput size={20} className="text-cyan-400" />
            Select Directory
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
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
            onClick={() => fetchDirectory(parentPath)}
            className="flex items-center gap-2 px-4 py-3 hover:bg-slate-800 text-slate-300 border-b border-slate-800"
          >
            <ChevronUp size={16} />
            <span>..</span>
          </button>
        )}

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={24} className="animate-spin text-cyan-400" />
            </div>
          ) : error ? (
            <div className="p-4 text-red-400 text-sm">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-slate-500 text-sm text-center">No subdirectories</div>
          ) : (
            items.map((item) => (
              <button
                key={item.path}
                onClick={() => fetchDirectory(item.path)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800 text-slate-300 w-full text-left border-b border-slate-800/50"
              >
                {item.name.includes(':') ? (
                  <HardDrive size={18} className="text-cyan-400" />
                ) : (
                  <Folder size={18} className="text-yellow-400" />
                )}
                <span className="font-mono text-sm">{item.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSelect(currentPath);
              onClose();
            }}
            disabled={!currentPath}
            className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold transition-all"
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
      setValidation({ valid: false, errors: ['Failed to validate path'] });
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
        setError(data.error || 'Setup failed');
      }
    } catch (e) {
      setError('Failed to connect to server');
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
                <img src={brainIcon} alt="Cortex" className="w-12 h-12 object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Welcome to CORTEX</h1>
                <p className="text-slate-400">Let's set up your workspace</p>
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">
                Repository Root Directory
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FolderOpen size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={reposRoot}
                    onChange={(e) => setReposRoot(e.target.value)}
                    placeholder="/path/to/reference-repos"
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 transition-all font-mono text-sm"
                  />
                </div>
                <button
                  onClick={() => setShowBrowser(true)}
                  className="px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-slate-300 transition-all flex items-center gap-2"
                  title="Browse directories"
                >
                  <FolderInput size={20} />
                </button>
              </div>

              {/* Validation Status */}
              {validation && (
                <div className={cn(
                  "mt-3 p-3 rounded-xl text-sm flex items-start gap-2",
                  validation.valid
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                )}>
                  {validation.valid ? <Check size={16} /> : <X size={16} />}
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
                "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                createStructure
                  ? "bg-cyan-500 border-cyan-500"
                  : "border-slate-600 group-hover:border-slate-500"
              )}>
                {createStructure && <Check size={14} className="text-white" />}
              </div>
              <input
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
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSetup}
              disabled={loading || !reposRoot || (validation && !validation.valid)}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Check size={20} />
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

  const handleSave = async () => {
    // Guard against empty submissions
    if (!reposRoot || !reposRoot.trim()) {
      setError('Repository root path cannot be empty');
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
        setError(data.error || 'Failed to save settings');
      }
    } catch (e) {
      console.error('Save failed:', e);
      setError('Failed to save settings');
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
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            Repository Root Directory
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={reposRoot}
              onChange={(e) => setReposRoot(e.target.value)}
              className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono text-sm"
            />
            <button
              onClick={handleSave}
              disabled={loading || saved}
              className={cn(
                "px-6 py-4 rounded-2xl font-bold transition-all flex items-center gap-2",
                saved
                  ? "bg-emerald-500 text-white"
                  : "bg-cyan-500 hover:bg-cyan-400 text-white"
              )}
            >
              {saved ? <Check size={20} /> : loading ? <RefreshCw size={20} className="animate-spin" /> : null}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-2">
            This is where CORTEX looks for Agents, Skills, Knowledge, and Tools
          </p>
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
        </div>

        {/* System Info */}
        <div className="pt-6 border-t border-slate-800">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
            System Information
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="text-slate-500 text-xs uppercase mb-1">Platform</div>
              <div className="text-slate-200 font-mono">{config?.system?.platform || 'Unknown'}</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="text-slate-500 text-xs uppercase mb-1">Node Version</div>
              <div className="text-slate-200 font-mono">{config?.system?.nodeVersion || 'Unknown'}</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// Analytics Panel Component
// ==========================================
function AnalyticsPanel({ analytics }) {
  return (
    <div className="glass-panel rounded-3xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-purple-500/10 rounded-xl">
          <TrendingUp size={20} className="text-purple-400" />
        </div>
        <h3 className="font-bold text-lg text-slate-200">Analytics</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/50 rounded-xl p-4">
          <div className="text-3xl font-bold text-cyan-400">{analytics?.thisMonthSpawns || 0}</div>
          <div className="text-slate-500 text-xs uppercase mt-1">This Month</div>
        </div>
        <div className="bg-slate-900/50 rounded-xl p-4">
          <div className="text-3xl font-bold text-purple-400">{analytics?.totalSpawns || 0}</div>
          <div className="text-slate-500 text-xs uppercase mt-1">Total Spawns</div>
        </div>
      </div>

      {analytics?.topAgent && (
        <div className="bg-slate-900/50 rounded-xl p-4">
          <div className="text-slate-500 text-xs uppercase mb-2">Most Used Agent</div>
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-purple-400" />
            <span className="text-slate-200 font-medium">{analytics.topAgent.name}</span>
            <span className="text-slate-500 text-sm">({analytics.topAgent.count}x)</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Session History Component
// ==========================================
function SessionHistory({ sessions, onReuse }) {
  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="glass-panel rounded-3xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-cyan-500/10 rounded-xl">
          <History size={20} className="text-cyan-400" />
        </div>
        <h3 className="font-bold text-lg text-slate-200">Recent Sessions</h3>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {sessions.slice(0, 5).map((session) => (
          <button
            key={session.id}
            onClick={() => onReuse(session.goal)}
            className="w-full text-left bg-slate-900/50 hover:bg-slate-800/50 rounded-xl p-3 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-slate-200 text-sm truncate group-hover:text-cyan-400 transition-colors">
                  {session.goal}
                </div>
                <div className="text-slate-500 text-xs mt-1 flex items-center gap-2">
                  <Clock size={12} />
                  {new Date(session.timestamp).toLocaleDateString()}
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-600 group-hover:text-cyan-400 transition-colors mt-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// Spawn Status Timeline Component
// ==========================================
function SpawnTimeline({ steps }) {
  return (
    <div className="space-y-2">
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
            {step.done ? <Check size={14} /> : step.error ? <X size={14} /> : <RefreshCw size={14} className="animate-spin" />}
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

function StatCard({ title, count, icon: Icon, color, delay, description }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn("relative transition-all duration-300 transform", isHovered ? "z-20 scale-105" : "z-0")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="glass-card p-6 rounded-3xl relative overflow-hidden h-full border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl shadow-xl"
      >
        <div className={cn("absolute -right-4 -top-4 w-32 h-32 rounded-full opacity-10 blur-3xl transition-opacity", color.replace('text-', 'bg-'))} />

        <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex justify-between items-start">
            <div className={cn("p-3 rounded-2xl w-fit mb-3 transition-colors", color.replace('text-', 'bg-').replace('400', '500/10'))}>
              <Icon size={24} className={color} />
            </div>
            {isHovered && <ChevronRight size={16} className="text-slate-500" />}
          </div>

          <div>
            <div className="text-4xl font-bold text-slate-100 tracking-tight">{count}</div>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mt-2">{title}</div>
          </div>
        </div>
      </motion.div>

      <div className={cn(
        "absolute top-full mt-4 left-1/2 -translate-x-1/2 w-52 p-4 bg-slate-950/95 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl transition-all duration-300 pointer-events-none z-50 text-xs text-slate-300 text-center leading-relaxed",
        isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        {description}
      </div>
    </div>
  )
}

function AgentReflectionBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full w-fit">
      <Activity size={12} className="text-indigo-400 animate-pulse" />
      <span className="text-[10px] font-medium text-indigo-300 uppercase tracking-wider">Agent-S Assisted Design</span>
    </div>
  )
}

function OrchestratorView({ onSpawn, loading, result, sessions, analytics, onReuseSession }) {
  const [goal, setGoal] = useState('');
  const [spawnSteps, setSpawnSteps] = useState([]);

  const handleSpawn = async () => {
    if (!goal) return;

    // Initialize timeline
    setSpawnSteps([
      { text: 'Analyzing goal keywords...', done: false }
    ]);

    // Simulate progress (actual progress comes from backend)
    setTimeout(() => setSpawnSteps(s => [...s.slice(0, 1).map(x => ({ ...x, done: true })), { text: 'Selecting best agent...', done: false }]), 300);
    setTimeout(() => setSpawnSteps(s => [...s.slice(0, 2).map(x => ({ ...x, done: true })), { text: 'Searching knowledge base...', done: false }]), 600);
    setTimeout(() => setSpawnSteps(s => [...s.slice(0, 3).map(x => ({ ...x, done: true })), { text: 'Generating flight plan...', done: false }]), 900);

    await onSpawn(goal);

    // Mark all done
    setSpawnSteps(s => s.map(x => ({ ...x, done: true })));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
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
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Agent Factory</h2>
          <p className="text-slate-400 text-lg">Spawn specialized autonomous agents using natural language.</p>
        </div>
        <AgentReflectionBadge />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-panel p-1 rounded-[2.5rem] bg-slate-800/40 border border-slate-700/30 shadow-2xl backdrop-blur-3xl">
            <div className="bg-slate-950/60 rounded-[2.2rem] p-8 h-full relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-slate-800/20 rounded-full blur-3xl -z-10 transition-opacity group-hover:opacity-100 opacity-50 pointer-events-none" />

              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block pl-1">How can we help today?</label>
              <div className="relative">
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Ask me to spawn an agent..."
                  className="w-full bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 text-xl text-slate-200 focus:outline-none focus:border-cyan-500/30 focus:ring-4 focus:ring-cyan-500/10 transition-all min-h-[140px] resize-none leading-relaxed placeholder:text-slate-600/70 font-medium"
                />

                <div className="absolute bottom-4 right-4">
                  <button
                    onClick={handleSpawn}
                    disabled={loading || !goal}
                    className="h-12 w-12 bg-cyan-500 hover:bg-cyan-400 text-black py-0 px-0 flex items-center justify-center rounded-full shadow-lg shadow-cyan-500/20 transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                    title="Spawn Agent"
                  >
                    {loading ? <RefreshCw size={20} className="animate-spin text-white" /> : <ChevronRight size={24} className="ml-0.5 text-white" />}
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
                  <div className="p-1.5 bg-green-500/20 rounded-full text-green-400"><CheckCircle2 size={16} /></div>
                  <span className="font-semibold text-purple-200">Flight Plan Ready</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium border border-slate-700"
                >
                  Copy to Clipboard
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
          {/* Capabilities */}
          <div className="glass-panel p-6 rounded-3xl space-y-6">
            <h3 className="font-bold text-slate-200 text-lg">Capabilities</h3>

            <div className="space-y-4">
              <div className="flex gap-4 items-center group cursor-default">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center border border-purple-500/30 group-hover:scale-110 transition-transform">
                  <Cpu size={24} className="text-purple-400" />
                </div>
                <div>
                  <div className="font-bold text-slate-200">Standard Agent</div>
                  <div className="text-xs text-slate-500">Logic & Reasoning Chassis</div>
                </div>
              </div>

              <div className="flex gap-4 items-center group cursor-default">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30 group-hover:scale-110 transition-transform">
                  <Terminal size={24} className="text-cyan-400" />
                </div>
                <div>
                  <div className="font-bold text-slate-200">Agent-S</div>
                  <div className="text-xs text-slate-500">OS & Browser Specialist</div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800/50">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Compatible Models</h4>
              <div className="flex gap-2 flex-wrap">
                {['Gemini', 'Claude', 'GPT-4', 'Llama'].map(m => (
                  <span key={m} className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 cursor-default transition-colors">{m}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Analytics */}
          {analytics && <AnalyticsPanel analytics={analytics} />}

          {/* Session History */}
          <SessionHistory sessions={sessions} onReuse={handleReuseSession} />
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
      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group"
    >
      <td className="p-4 pl-6">
        <div className="flex items-center gap-4">
          <div className={cn("p-2.5 rounded-xl transition-all group-hover:scale-110 shadow-lg", color.bg)}>
            <Icon size={18} className={color.text} />
          </div>
          <div>
            <div className="font-bold text-slate-200 group-hover:text-cyan-400 transition-colors text-sm">{repo.Name}</div>
            <div className="text-xs text-slate-500 font-mono truncate max-w-[200px] mt-0.5 opacity-60">{repo.Path}</div>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-mono bg-slate-900/50 w-fit px-2 py-1 rounded-md border border-slate-800">
          <GitBranch size={12} />
          {repo.Branch}
        </div>
      </td>
      <td className="p-4">
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm", color.badge)}>
          {repo.Purpose}
        </span>
      </td>
      <td className="p-4 pr-6 text-right">
        <div className="inline-flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Active
        </div>
      </td>
    </motion.tr>
  )
}

function RepoTable({ repos }) {
  return (
    <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl shadow-black/20 border border-slate-800/50">
      <div className="px-8 py-5 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/30 backdrop-blur-md">
        <h3 className="font-bold text-slate-200 flex items-center gap-2">
          <Database size={16} className="text-slate-500" />
          Tracked Resources
        </h3>
        <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-1 rounded-md border border-slate-700">{repos.length} ITEMS</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950/40 text-slate-500 uppercase text-[10px] font-extrabold tracking-widest border-b border-slate-800/50">
            <tr>
              <th className="p-5 pl-6">Name / Path</th>
              <th className="p-5">Branch</th>
              <th className="p-5">Type</th>
              <th className="p-5 pr-6 text-right">Status</th>
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

function NavItem({ icon: Icon, label, active, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-sm font-semibold group relative overflow-hidden",
        active
          ? "bg-white text-slate-950 shadow-lg shadow-white/5"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
      )}
    >
      <Icon size={20} className={cn("transition-colors", active ? "text-cyan-600" : "text-slate-500 group-hover:text-slate-300")} />
      <span>{label}</span>

      {badge && (
        <span className={cn("ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border", active ? "bg-slate-200 text-slate-800 border-slate-300" : "bg-slate-800 text-slate-400 border-slate-700")}>
          {badge}
        </span>
      )}
      {!active && !badge && <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-50 -translate-x-2 group-hover:translate-x-0 transition-all" />}
    </button>
  )
}

// ==========================================
// Main App
// ==========================================

function App() {
  const [repos, setRepos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('Online');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [view, setView] = useState('dashboard');
  const [spawnResult, setSpawnResult] = useState('');

  // New state for config/setup
  const [appConfig, setAppConfig] = useState(null);
  const [isFirstRun, setIsFirstRun] = useState(null); // null = loading
  const [defaultPaths, setDefaultPaths] = useState({});
  const [sessions, setSessions] = useState([]);
  const [analytics, setAnalytics] = useState(null);

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
        fetchAnalytics();
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
    addLog(`Setup complete! Repos root: ${result.reposRoot}`);
  };

  useEffect(() => {
    if (isFirstRun === false) {
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
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

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics`);
      const data = await res.json();
      setAnalytics(data);
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
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
      addLog("Starting System Scan...");
      const res = await fetch(`${API_BASE}/scan`, { method: 'POST' });
      const data = await res.json();
      addLog(data.output || "Scan Complete");
      fetchData();
    } catch (e) {
      addLog("Scan Failed");
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!url) return;
    setLoading(true);
    addLog(`Cloning ${url}...`);
    try {
      const res = await fetch(`${API_BASE}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      addLog(data.output || "Clone Complete");
      setUrl('');
      fetchData();
    } catch (e) {
      addLog("Add Failed");
    }
    setLoading(false);
  };

  const handleSpawn = async (goal) => {
    setLoading(true);
    setSpawnResult('');
    addLog(`Orchestrating agent for: "${goal}"...`);
    try {
      const res = await fetch(`${API_BASE}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal })
      });
      const data = await res.json();
      if (data.success) {
        setSpawnResult(data.output);
        addLog("Agent Spawned Successfully");

        // Save session
        await fetch(`${API_BASE}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal, agent: 'std-agent', output: data.output })
        });
        fetchSessions();
        fetchAnalytics();
      } else {
        addLog(`Spawn Error: ${data.error}`);
      }
    } catch (e) {
      addLog("Spawn Request Failed");
    }
    setLoading(false);
  };

  const addLog = (msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  // Show loading state while checking config
  if (isFirstRun === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0C15]">
        <div className="flex items-center gap-4 text-cyan-400">
          <RefreshCw size={24} className="animate-spin" />
          <span className="text-xl">Loading CORTEX...</span>
        </div>
      </div>
    );
  }

  // Show setup wizard if first run
  if (isFirstRun) {
    return <SetupWizard onComplete={handleSetupComplete} defaultPath={defaultPaths.reposRoot} />;
  }

  // Group repos by category (dynamic)
  const categorized = {};
  categories.forEach(cat => {
    categorized[cat] = repos.filter(r => r.Purpose?.toLowerCase().includes(cat.toLowerCase()));
  });

  return (
    <div className="min-h-screen flex text-slate-100 font-sans selection:bg-cyan-500/30 bg-[#0B0C15]">

      {/* Sidebar */}
      <nav className="w-72 glass-panel border-r border-slate-800/50 flex flex-col fixed h-full z-50 backdrop-blur-xl bg-slate-950/80">
        <div className="p-8">
          <div className="flex items-center gap-4 text-cyan-400 mb-10 pl-2">
            <div className="bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 rounded-2xl p-3 border border-white/10 shadow-2xl">
              <img src={brainIcon} alt="Cortex Brain" className="w-8 h-8 object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" />
            </div>
            <span className="font-bold text-3xl tracking-tighter text-white">CORTEX</span>
          </div>

          <div className="space-y-3">
            <NavItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={view === 'dashboard'}
              onClick={() => setView('dashboard')}
            />
            <NavItem
              icon={Cpu}
              label="Agent Factory"
              active={view === 'agents'}
              badge="New"
              onClick={() => setView('agents')}
            />
            <NavItem
              icon={Terminal}
              label="System Logs"
              active={view === 'logs'}
              onClick={() => setView('logs')}
            />
            <NavItem
              icon={GitBranch}
              label="Repositories"
              badge={repos.length}
              active={view === 'repos'}
              onClick={() => setView('repos')}
            />
            <NavItem
              icon={Settings}
              label="Settings"
              active={view === 'settings'}
              onClick={() => setView('settings')}
            />
          </div>
        </div>

        <div className="mt-auto p-8 border-t border-slate-800/50 bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-2.5 h-2.5 rounded-full ${status === 'Online' ? 'bg-emerald-500' : 'bg-red-500'} z-10 relative`}></div>
              <div className={`absolute inset-0 rounded-full ${status === 'Online' ? 'bg-emerald-500' : 'bg-red-500'} animate-ping opacity-75`}></div>
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider ${status === 'Online' ? 'text-emerald-400' : 'text-red-400'}`}>System {status}</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono mt-2">v2.1.0 • Cross-Platform</div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 ml-72 p-10 max-w-[1600px] mx-auto">

        {/* Top Bar */}
        <header className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white mb-2">CORTEX UI</h1>
            <p className="text-slate-400 font-medium">Centralized AI Repo, Spawn, and Training Management</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleScan}
              disabled={loading}
              className="group flex items-center gap-3 px-6 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-2xl border border-slate-700/50 transition-all text-sm font-bold disabled:opacity-50 hover:shadow-lg"
            >
              <RefreshCw size={16} className={cn("transition-transform group-hover:rotate-180 duration-500", loading ? "animate-spin" : "")} />
              {loading ? "Syncing..." : "Scan System"}
            </button>
            <button className="flex items-center gap-3 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl shadow-lg shadow-cyan-900/20 transition-all text-sm font-bold hover:scale-105 active:scale-95">
              <Plus size={18} />
              New Resource
            </button>
          </div>
        </header>

        {/* Content Views */}
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Bento Grid Stats */}
              <div className="grid grid-cols-5 gap-6 mb-10">
                {categories.map((cat, i) => {
                  const config = CATEGORY_CONFIG[cat.toLowerCase()] || DEFAULT_CATEGORY;
                  return (
                    <StatCard
                      key={cat}
                      title={cat.charAt(0).toUpperCase() + cat.slice(1)}
                      count={categorized[cat] ? categorized[cat].length : 0}
                      icon={config.icon}
                      color={config.color}
                      delay={i * 0.05}
                      description={config.desc}
                    />
                  );
                })}
                {categories.length === 0 && (
                  <div className="col-span-5 text-center text-slate-500 py-12 border border-dashed border-slate-800 rounded-3xl">
                    Initializing Knowledge Base...
                  </div>
                )}
              </div>

              {/* Smart Add Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                <div className="lg:col-span-2">
                  <div className="glass-panel p-1 rounded-[32px] bg-gradient-to-br from-slate-800/50 to-slate-900/50 h-full">
                    <div className="bg-slate-950/80 p-8 rounded-[28px] h-full border border-slate-800/50 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2.5 bg-cyan-500/10 rounded-xl">
                            <Search size={20} className="text-cyan-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-xl text-slate-100">Smart Clone</h3>
                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Auto-Classification Engine</div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="Paste GitHub URL..."
                            className="flex-1 bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 focus:border-cyan-500/50 rounded-2xl px-6 py-4 text-sm focus:outline-none transition-all placeholder:text-slate-600 shadow-inner"
                          />
                          <button
                            onClick={handleAdd}
                            disabled={loading || !url}
                            className="px-8 bg-slate-100 hover:bg-white text-slate-900 rounded-2xl font-bold transition-all disabled:opacity-50 text-sm shadow-lg shadow-white/5 active:scale-95"
                          >
                            Clone
                          </button>
                        </div>
                      </div>
                      <div className="mt-8 flex items-center justify-between border-t border-slate-800/50 pt-6">
                        <div className="flex -space-x-2">
                          {[1, 2, 3].map(i => <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-950" />)}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Auto-classifies into <span className="text-cyan-400">{categories.length} categories</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-[32px] p-8 h-[280px] overflow-hidden flex flex-col border border-slate-800/60 bg-slate-950/30">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex justify-between items-center">
                    <span>Terminal Output</span>
                    <span className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[11px] scrollbar-thin scrollbar-thumb-slate-800">
                    {logs.length === 0 && <div className="text-slate-600 italic">Connected to Cortex Daemon...</div>}
                    {logs.map((log, i) => (
                      <div key={i} className="text-slate-300 border-l-2 border-slate-800 pl-3 py-0.5 opacity-80 hover:opacity-100 transition-opacity">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <RepoTable repos={repos} />
            </motion.div>
          )}

          {view === 'agents' && (
            <OrchestratorView
              onSpawn={handleSpawn}
              loading={loading}
              result={spawnResult}
              sessions={sessions}
              analytics={analytics}
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
                <span className="text-emerald-500 flex items-center gap-2">
                  <Activity size={16} /> Stream Active
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 font-mono text-sm">
                {logs.length === 0 && <div className="text-slate-600 italic">No activity recorded.</div>}
                {logs.map((log, i) => (
                  <div key={i} className="text-slate-300 border-l-2 border-slate-700 pl-4 py-1.5 hover:bg-slate-800/30 rounded-r-lg transition-colors">
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
  )
}

export default App
