import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal, LayoutDashboard, Database, Cpu, Wrench,
  BarChart3, Search, Plus, RefreshCw, CheckCircle2,
  AlertCircle, ChevronRight, Activity, GitBranch, Folder
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const API_BASE = 'http://localhost:3001/api';

// Brain Icon for CORTEX Branding
function BrainIcon({ size = 24, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-4A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-4A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  )
}

// --- Components ---

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function StatCard({ title, count, icon: Icon, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-6 rounded-2xl relative overflow-hidden group"
    >
      <div className={cn("absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity", color)}>
        <Icon size={64} />
      </div>
      <div className="relative z-10">
        <div className={cn("p-2 rounded-lg w-fit mb-3", color.replace('text-', 'bg-').replace('400', '500/10'))}>
          <Icon size={20} className={color} />
        </div>
        <div className="text-3xl font-bold text-slate-100">{count}</div>
        <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mt-1">{title}</div>
      </div>
    </motion.div>
  )
}

function RepoRow({ repo, delay }) {
  const getIcon = (purpose) => {
    if (purpose.includes("Agent")) return Cpu;
    if (purpose.includes("Skill")) return Terminal;
    if (purpose.includes("Knowledge")) return Database;
    if (purpose.includes("Tool")) return Wrench;
    if (purpose.includes("Benchmark")) return BarChart3;
    return Folder;
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
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", color.bg)}>
            <Icon size={18} className={color.text} />
          </div>
          <div>
            <div className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">{repo.Name}</div>
            <div className="text-xs text-slate-500 font-mono truncate max-w-[200px]">{repo.Path}</div>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm font-mono">
          <GitBranch size={14} />
          {repo.Branch}
        </div>
      </td>
      <td className="p-4">
        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", color.badge)}>
          {repo.Purpose}
        </span>
      </td>
      <td className="p-4 pr-6 text-right">
        <div className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Active
        </div>
      </td>
    </motion.tr>
  )
}

// --- Main App ---

function App() {
  const [repos, setRepos] = useState([]);
  const [status, setStatus] = useState('Online');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [view, setView] = useState('dashboard'); // dashboard | settings

  useEffect(() => {
    fetchRepos();
    const interval = setInterval(fetchRepos, 10000);
    return () => clearInterval(interval);
  }, []);

  const derivePurpose = (path) => {
    if (!path) return "Unknown";
    const normalize = path.replace(/\\/g, '/');
    const sections = normalize.split('/');
    if (sections.length < 2) return "Unknown";
    const parent = sections[sections.length - 2].toLowerCase();

    switch (parent) {
      case 'agents': return "Agent Engine";
      case 'skills': return "Skill Bundle";
      case 'knowledge': return "Knowledge Resource";
      case 'tools': return "Tool / Utility";
      case 'benchmarks': return "Benchmark Suite";
      default: return "Reference";
    }
  };

  const fetchRepos = async () => {
    try {
      const res = await fetch(`${API_BASE}/repos`);
      const data = await res.json();
      const enriched = data.map(repo => ({
        ...repo,
        Purpose: derivePurpose(repo.Path)
      }));
      setRepos(enriched);
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
      fetchRepos();
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
      fetchRepos();
    } catch (e) {
      addLog("Add Failed");
    }
    setLoading(false);
  };

  const addLog = (msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const categorized = {
    agents: repos.filter(r => r.Purpose.includes("Agent")),
    skills: repos.filter(r => r.Purpose.includes("Skill")),
    knowledge: repos.filter(r => r.Purpose.includes("Knowledge")),
    tools: repos.filter(r => r.Purpose.includes("Tool")),
    benchmarks: repos.filter(r => r.Purpose.includes("Benchmark")),
  };

  return (
    <div className="min-h-screen flex text-slate-100 font-sans selection:bg-cyan-500/30">

      {/* Sidebar */}
      <nav className="w-64 glass-panel border-r border-slate-800/50 flex flex-col fixed h-full z-50">
        <div className="p-6">
          <div className="flex items-center gap-3 text-cyan-400 mb-8">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-lg border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
              <BrainIcon size={24} className="text-cyan-300" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">CORTEX</span>
          </div>

          <div className="space-y-1">
            <NavItem icon={LayoutDashboard} active label="Dashboard" />
            <NavItem icon={Terminal} label="System Logs" onClick={() => { }} />
            <NavItem icon={GitBranch} label="Repositories" badge={repos.length} />
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800/50 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-medium text-emerald-400">System Online</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">v1.2.0 • Stable</div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 max-w-7xl mx-auto">

        {/* Top Bar */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">CORTEX UI</h1>
            <p className="text-slate-400 text-sm mt-1">Centralized Intelligence Management Hub</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleScan}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {loading ? "Syncing..." : "Scan System"}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg shadow-lg shadow-cyan-900/20 transition-all text-sm font-medium">
              <Plus size={16} />
              New Resource
            </button>
          </div>
        </header>

        {/* Bento Grid Stats */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <StatCard title="Agents" count={categorized.agents.length} icon={Cpu} color="text-purple-400" delay={0.1} />
          <StatCard title="Skills" count={categorized.skills.length} icon={Terminal} color="text-yellow-400" delay={0.2} />
          <StatCard title="Knowledge" count={categorized.knowledge.length} icon={Database} color="text-blue-400" delay={0.3} />
          <StatCard title="Tools" count={categorized.tools.length} icon={Wrench} color="text-emerald-400" delay={0.4} />
          <StatCard title="Benchmarks" count={categorized.benchmarks.length} icon={BarChart3} color="text-red-400" delay={0.5} />
        </div>

        {/* Smart Add Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Smart Clone Card */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-1">
            <div className="bg-slate-900/50 p-6 rounded-xl h-full border border-slate-800/50">
              <div className="flex items-center gap-2 mb-4">
                <Search size={18} className="text-cyan-400" />
                <h3 className="font-semibold text-slate-200">Smart Clone Repository</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors placeholder:text-slate-600"
                />
                <button
                  onClick={handleAdd}
                  disabled={loading || !url}
                  className="px-6 bg-slate-100 hover:bg-white text-slate-900 rounded-xl font-bold transition-all disabled:opacity-50 text-sm"
                >
                  Clone
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-cyan-500" />
                Auto-classifies into Agents, Skills, or Knowledge folders.
              </p>
            </div>
          </div>

          {/* Logs Panel */}
          <div className="glass-panel rounded-2xl p-4 h-[200px] overflow-hidden flex flex-col">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex justify-between">
              <span>System Activity</span>
              <span className="text-emerald-500">Live</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[10px] sm:text-xs">
              {logs.length === 0 && <div className="text-slate-600 italic">Ready for commands...</div>}
              {logs.map((log, i) => (
                <div key={i} className="text-slate-300 border-l-2 border-slate-700 pl-2">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Repository Table */}
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-black/20">
          <div className="px-6 py-4 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/20">
            <h3 className="font-semibold text-slate-200">Tracked Resources</h3>
            <div className="text-xs text-slate-500 font-mono">{repos.length} total</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-950/30 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="p-4 pl-6">Name / Path</th>
                  <th className="p-4">Branch</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 pr-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                <AnimatePresence>
                  {repos.map((repo, i) => (
                    <RepoRow key={repo.Name + i} repo={repo} delay={i * 0.05} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}

function NavItem({ icon: Icon, label, active, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
        active
          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/10"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
      )}
    >
      <Icon size={18} />
      <span>{label}</span>
      {badge && (
        <span className="ml-auto text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
          {badge}
        </span>
      )}
      {!active && !badge && <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-50" />}
    </button>
  )
}

function getPurposeColor(purpose) {
  if (purpose.includes("Agent")) return { text: "text-purple-400", bg: "bg-purple-400/10", badge: "bg-purple-400/10 text-purple-300 border-purple-400/20" };
  if (purpose.includes("Skill")) return { text: "text-yellow-400", bg: "bg-yellow-400/10", badge: "bg-yellow-400/10 text-yellow-300 border-yellow-400/20" };
  if (purpose.includes("Knowledge")) return { text: "text-blue-400", bg: "bg-blue-400/10", badge: "bg-blue-400/10 text-blue-300 border-blue-400/20" };
  if (purpose.includes("Tool")) return { text: "text-emerald-400", bg: "bg-emerald-400/10", badge: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20" };
  if (purpose.includes("Benchmark")) return { text: "text-red-400", bg: "bg-red-400/10", badge: "bg-red-400/10 text-red-300 border-red-400/20" };
  return { text: "text-slate-400", bg: "bg-slate-400/10", badge: "bg-slate-400/10 text-slate-300 border-slate-400/20" };
}

export default App
