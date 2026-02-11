import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import {
  Terminal, Database, Cpu, Wrench,
  BarChart3, RefreshCw, Folder,
  Settings, History,
  LayoutDashboard, Activity, FlaskConical, Library, BookOpen
} from 'lucide-react'
import brainIcon from './assets/brain.png'
import { cn } from './lib/utils'
import { SPRING_SMOOTH, API_BASE, AUTH_TOKEN_KEY, WORKSPACE_KEY, THEME_KEY, APP_VERSION, MANUAL_URL } from './lib/constants'
import { apiFetch } from './lib/api'
import { NavItem } from './components/NavItem'
import { ChecklistModal } from './components/ChecklistModal'
import { AuditView } from './views/AuditView'
import { LogsView } from './views/LogsView'
import { SettingsPanel } from './views/SettingsPanel'
import { LibraryView } from './views/LibraryView'
import { SetupWizard } from './views/SetupWizard'
import { LoginScreen, BootstrapAdminScreen } from './views/AuthScreens'
import { OrchestratorView } from './views/OrchestratorView'
import { HomeView } from './views/HomeView'
import { RunsView } from './views/RunsView'
import { JobsView } from './views/JobsView'
import { EvaluationsView } from './views/EvaluationsView'
import { KnowledgeView } from './views/KnowledgeView'
import { VIEW_PATHS, resolveViewFromPath, resolveViewFromQuery } from './router'

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
  const location = useLocation();
  const navigate = useNavigate();
  const view = resolveViewFromPath(location.pathname);
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
    const params = new URLSearchParams(location.search);
    const legacyView = resolveViewFromQuery(params.get('view'));
    if (legacyView) {
      navigate(VIEW_PATHS[legacyView], { replace: true });
    }
  }, [location.search, navigate]);

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
      addLog(`Scan: ${data.output || "Complete"}`);
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
    if (auditLogs.length === 0) return;
    setLogs((prev) => {
      if (prev.length > 0) return prev;
      const seeded = auditLogs.slice(0, 20).reverse().map(entry => {
        const rawTs = entry.ts || entry.timestamp;
        const ts = rawTs ? new Date(rawTs).toLocaleTimeString() : '—';
        const meta = entry.metadata || entry.meta || {};
        const detail = meta.name || meta.source || meta.id || '';
        return `[${ts}] ${entry.event}${detail ? ': ' + detail : ''}`;
      });
      return seeded;
    });
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
  const confirmNavigation = useCallback(() => {
    if (dirtyGoal && view === 'agents') {
      const confirmLeave = window.confirm('You have an unsent goal. Leave this page?');
      if (!confirmLeave) return false;
      setDirtyGoal(false);
    }
    return true;
  }, [dirtyGoal, view]);

  const handleViewChange = useCallback((nextView) => {
    if (nextView === view) return;
    if (!confirmNavigation()) return;
    navigate(VIEW_PATHS[nextView] || '/');
  }, [view, confirmNavigation, navigate]);

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
              to="/"
              onBeforeNavigate={confirmNavigation}
              testId="nav-home"
            />
            <NavItem
              icon={Cpu}
              label="Agent Factory"
              active={view === 'agents'}
              to="/agents"
              onBeforeNavigate={confirmNavigation}
              testId="nav-agents"
            />
            <NavItem
              icon={Activity}
              label="Runs"
              badge={runs.length}
              active={view === 'runs'}
              to="/runs"
              onBeforeNavigate={confirmNavigation}
              testId="nav-runs"
            />
            <NavItem
              icon={BarChart3}
              label="Jobs"
              badge={jobs.length}
              active={view === 'jobs'}
              to="/jobs"
              onBeforeNavigate={confirmNavigation}
              testId="nav-jobs"
            />
            <NavItem
              icon={FlaskConical}
              label="Evaluations"
              badge={datasets.length + evaluations.length}
              active={view === 'evaluations'}
              to="/evaluations"
              onBeforeNavigate={confirmNavigation}
              testId="nav-evaluations"
            />
            <NavItem
              icon={Library}
              label="Library"
              badge={savedPrompts.length}
              active={view === 'library'}
              to="/library"
              onBeforeNavigate={confirmNavigation}
              testId="nav-library"
            />
            <NavItem
              icon={BookOpen}
              label="Knowledge Base"
              badge={repos.length}
              active={view === 'knowledge'}
              to="/knowledge"
              onBeforeNavigate={confirmNavigation}
              testId="nav-knowledge"
            />
            <NavItem
              icon={Terminal}
              label="System Logs"
              active={view === 'logs'}
              to="/logs"
              onBeforeNavigate={confirmNavigation}
              testId="nav-logs"
            />
            <NavItem
              icon={History}
              label="Audit Trail"
              active={view === 'audit'}
              to="/audit"
              onBeforeNavigate={confirmNavigation}
              testId="nav-audit"
            />
            <NavItem
              icon={Settings}
              label="Settings"
              active={view === 'settings'}
              to="/settings"
              onBeforeNavigate={confirmNavigation}
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
            <header className="top-bar flex justify-between items-center mb-8 px-6 py-4">
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
                  <div className="px-5 py-2 rounded-2xl border border-slate-800/70 bg-slate-900/50 flex items-center gap-3">
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
              transition={SPRING_SMOOTH}
            />
          )}

          {view === 'knowledge' && (
            <KnowledgeView
              categories={categories}
              categorized={categorized}
              categorySizes={categorySizes}
              externalSkillsCount={externalSkillsCount}
              externalSkillsInstalledThisRun={externalSkillsInstalledThisRun}
              repos={repos}
              url={url}
              setUrl={setUrl}
              handleAdd={handleAdd}
              handleScan={handleScan}
              repoLoading={repoLoading}
              repoAction={repoAction}
              repoNotice={repoNotice}
            />
          )}

          {view === 'audit' && (
            <AuditView
              auditLogs={auditLogs}
              apiFetch={apiFetch}
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


