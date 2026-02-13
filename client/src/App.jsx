import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import {
  Cpu, BarChart3, RefreshCw,
  Settings, LayoutDashboard, Activity, FlaskConical, Library, BookOpen
} from 'lucide-react'
import brainIcon from './assets/brain.png'
import { cn } from './lib/utils'
import { SPRING_SMOOTH, APP_VERSION, MANUAL_URL } from './lib/constants'
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
import { useAuth } from './contexts/AuthContext'
import { useConfig } from './contexts/ConfigContext'
import { useData } from './contexts/DataContext'
import { useWorkspace } from './contexts/WorkspaceContext'

const DEFAULT_RBAC_ROLES = {
  viewer: {
    config: ['read'], system: ['read'], llm: ['read'], workspaces: ['read'],
    users: [], repos: ['read'], vector_index: ['read'], runs: ['read'],
    jobs: ['read'], datasets: ['read', 'export'], evaluations: ['read', 'compare'],
    evaluation_templates: ['read', 'export'], prompts: ['read'], agents: ['read'],
    tools: ['read'], analytics: ['read'], observability: ['read'], audit: ['read'],
    sessions: ['read'], logs: ['read'],
  },
  editor: {
    config: ['read'], system: ['read'], llm: ['read', 'test'], workspaces: ['read'],
    users: [], repos: ['read', 'scan', 'create', 'update'],
    vector_index: ['read', 'rebuild'], runs: ['read', 'create'],
    jobs: ['read', 'create', 'update'],
    datasets: ['read', 'create', 'update', 'delete', 'export', 'import'],
    evaluations: ['read', 'create', 'compare'],
    evaluation_templates: ['read', 'create', 'update', 'delete', 'export', 'import'],
    prompts: ['read', 'create', 'update', 'delete'], agents: ['read'], tools: ['read'],
    analytics: ['read'], observability: ['read'], audit: ['read'],
    sessions: ['read', 'create'], logs: ['read'],
  },
  admin: { '*': ['*'] },
}

const VIEW_META = {
  home: { title: 'Command Center', subtitle: 'Operational overview of runs, evaluations, and knowledge coverage.' },
  agents: { title: 'Agent Factory', subtitle: 'Spawn specialized autonomous agents using natural language.' },
  runs: { title: 'Run Explorer', subtitle: 'Inspect decision matrices, traces, and performance signals.' },
  jobs: { title: 'Job Queue', subtitle: 'Monitor background tasks and queued spawns.' },
  evaluations: { title: 'Evaluations', subtitle: 'Create datasets and score runs against them.' },
  library: { title: 'Library', subtitle: 'Prompts, agent templates, and reusable assets.' },
  knowledge: { title: 'Knowledge Base', subtitle: 'Scan, add, and manage reference repos.' },
  audit: { title: 'Audit Trail', subtitle: 'Security and compliance events across workspaces.' },
  logs: { title: 'System Logs', subtitle: 'Operational events from the local CORTEX daemon.' },
  settings: { title: 'Settings', subtitle: 'Configure repository paths and preferences.' },
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const view = resolveViewFromPath(location.pathname)

  // Contexts
  const auth = useAuth()
  const config = useConfig()
  const data = useData()
  const workspace = useWorkspace()

  // Local UI state
  const [dirtyGoal, setDirtyGoal] = useState(false)
  const [prefillGoal, setPrefillGoal] = useState('')
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [checklistContent, setChecklistContent] = useState('')
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [checklistError, setChecklistError] = useState('')

  // Wire workspace fetcher into data context for aggregate refresh
  useEffect(() => {
    data.setWorkspaceFetcher(workspace.fetchWorkspaces)
  }, [data.setWorkspaceFetcher, workspace.fetchWorkspaces])

  // Trigger initial data load + sessions when config is ready
  useEffect(() => {
    if (config.isFirstRun === false) {
      data.fetchData()
      data.fetchSessions()
    }
  }, [config.isFirstRun]) // eslint-disable-line react-hooks/exhaustive-deps

  // Legacy query-param redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const legacyView = resolveViewFromQuery(params.get('view'))
    if (legacyView) {
      navigate(VIEW_PATHS[legacyView], { replace: true })
    }
  }, [location.search, navigate])

  // Warn before unload when agent goal is dirty
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!dirtyGoal) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirtyGoal])

  // Checklist helpers
  const loadChecklist = async (force = false) => {
    if (!force && checklistContent) return
    setChecklistLoading(true)
    setChecklistError('')
    try {
      const res = await apiFetch('/checklist')
      if (!res.ok) throw new Error(`Checklist request failed (${res.status})`)
      setChecklistContent(await res.text())
    } catch (err) {
      console.error('Checklist load failed:', err)
      setChecklistError('Failed to load the checklist. Please try again.')
    } finally {
      setChecklistLoading(false)
    }
  }

  const handleOpenChecklist = () => {
    setChecklistOpen(true)
    loadChecklist(false)
  }

  const handleRefreshChecklist = () => loadChecklist(true)

  const handleCopyChecklist = async () => {
    if (!checklistContent) return
    try { await navigator.clipboard.writeText(checklistContent) } catch (err) {
      console.error('Checklist copy failed:', err)
    }
  }

  // Navigation
  const confirmNavigation = useCallback(() => {
    if (dirtyGoal && view === 'agents') {
      if (!window.confirm('You have an unsent goal. Leave this page?')) return false
      setDirtyGoal(false)
    }
    return true
  }, [dirtyGoal, view])

  const handleViewChange = useCallback((nextView) => {
    if (nextView === view) return
    if (!confirmNavigation()) return
    navigate(VIEW_PATHS[nextView] || '/')
  }, [view, confirmNavigation, navigate])

  // Prompt routing
  const handleAgentUsePrompt = (query) => setPrefillGoal(query)

  const handleLibraryUsePrompt = (query) => {
    handleAgentUsePrompt(query)
    handleViewChange('agents')
  }

  const handlePrefillConsumed = () => setPrefillGoal('')

  // Config save bridges auth + config contexts
  const handleConfigSave = (newConfig) => {
    config.handleConfigSave(newConfig)
    auth.updateAuthFromConfig(newConfig)
  }

  // Setup complete bridges config + data contexts
  const handleSetupComplete = (result) => {
    config.handleSetupComplete(result)
    data.fetchData()
    data.fetchCategorySizes()
    data.addLog(`Setup complete! Repos root: ${result.reposRoot}`)
  }

  // Workspace switch bridges workspace + data contexts
  const handleWorkspaceSwitch = (workspaceId) => {
    workspace.handleWorkspaceSwitch(workspaceId, () => {
      data.fetchData()
      data.fetchSessions()
    })
  }

  // --- Early returns (auth/loading/setup screens) ---

  if (auth.authStatus.enabled && !auth.authReady) {
    return (
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        <div className="min-h-screen flex items-center justify-center app-shell">
          <div className="flex items-center gap-4 text-cyan-400" role="status" aria-live="polite">
            <RefreshCw size={24} className="animate-spin" aria-hidden="true" />
            <span className="text-xl">Authenticating…</span>
          </div>
        </div>
      </MotionConfig>
    )
  }

  if (auth.authStatus.enabled && auth.authStatus.bootstrapNeeded && !auth.authUser) {
    return (
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        <BootstrapAdminScreen onBootstrap={auth.handleBootstrap} loading={auth.authLoading} error={auth.authError} />
      </MotionConfig>
    )
  }

  if (auth.authStatus.enabled && !auth.authUser) {
    return (
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        <LoginScreen onLogin={auth.handleLogin} loading={auth.authLoading} error={auth.authError} />
      </MotionConfig>
    )
  }

  if (config.isFirstRun === null) {
    return (
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        <div className="min-h-screen flex items-center justify-center app-shell">
          <div className="flex items-center gap-4 text-cyan-400" role="status" aria-live="polite">
            <RefreshCw size={24} className="animate-spin" aria-hidden="true" />
            <span className="text-xl">Loading CORTEX…</span>
          </div>
        </div>
      </MotionConfig>
    )
  }

  if (config.isFirstRun) {
    return (
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        <SetupWizard onComplete={handleSetupComplete} defaultPath={config.defaultPaths.reposRoot} />
      </MotionConfig>
    )
  }

  // --- Derived state ---
  const categorized = {}
  data.categories.forEach((cat) => {
    categorized[cat] = data.repos.filter((r) => r.Purpose?.toLowerCase().includes(cat.toLowerCase()))
  })
  const externalSkillsCount = data.externalSkillsInstalled.length
  const latestExternalSkills = data.runs[0]?.decisionMatrix?.resourceSelection?.externalSkills || null
  const externalSkillsInstalledThisRun = Array.isArray(latestExternalSkills?.installed)
    ? latestExternalSkills.installed.filter((item) => item?.installed === true).length
    : 0

  const headerMeta = VIEW_META[view] || VIEW_META.home
  const showHeader = !['agents', 'home'].includes(view)
  const mainPadding = view === 'agents' ? 'pl-4 pr-6 pt-4 pb-8' : 'pl-4 pr-6 py-8'

  return (
    <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
      <a href="#main-content" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:bg-slate-900 focus-visible:text-white focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-lg">
        Skip to main content
      </a>
      <div
        className="min-h-screen flex text-slate-100 selection:bg-cyan-500/30 app-shell"
        data-density={config.appConfig?.config?.ui?.density || 'comfortable'}
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
            <NavItem icon={LayoutDashboard} label="Command Center" active={view === 'home'} to="/" onBeforeNavigate={confirmNavigation} testId="nav-home" />
            <NavItem icon={Cpu} label="Agent Factory" active={view === 'agents'} to="/agents" onBeforeNavigate={confirmNavigation} testId="nav-agents" />
            <NavItem icon={Activity} label="Runs" badge={data.runs.length} active={view === 'runs'} to="/runs" onBeforeNavigate={confirmNavigation} testId="nav-runs" />
            <NavItem icon={BarChart3} label="Jobs" badge={data.jobs.length} active={view === 'jobs'} to="/jobs" onBeforeNavigate={confirmNavigation} testId="nav-jobs" />
            <NavItem icon={FlaskConical} label="Evaluations" badge={data.datasets.length + data.evaluations.length} active={view === 'evaluations'} to="/evaluations" onBeforeNavigate={confirmNavigation} testId="nav-evaluations" />
            <NavItem icon={Library} label="Library" badge={data.savedPrompts.length} active={view === 'library'} to="/library" onBeforeNavigate={confirmNavigation} testId="nav-library" />
            <NavItem icon={BookOpen} label="Knowledge" badge={data.repos.length} active={view === 'knowledge'} to="/knowledge" onBeforeNavigate={confirmNavigation} testId="nav-knowledge" />
            <NavItem icon={Activity} label="Audit Trail" active={view === 'audit'} to="/audit" onBeforeNavigate={confirmNavigation} testId="nav-audit" />
            <NavItem icon={Activity} label="Logs" active={view === 'logs'} to="/logs" onBeforeNavigate={confirmNavigation} testId="nav-logs" />
            <NavItem icon={Settings} label="Settings" active={view === 'settings'} to="/settings" onBeforeNavigate={confirmNavigation} testId="nav-settings" />
          </div>
        </div>

        {/* Sidebar footer */}
        <div className="mt-auto p-4 border-t border-white/5">
          {workspace.activeWorkspace && (
            <div className="mb-3 px-2">
              <div className="text-[10px] font-medium text-slate-500 tracking-[0.18em] uppercase">Workspace</div>
              <select
                value={workspace.activeWorkspace?.id || ''}
                onChange={(e) => handleWorkspaceSwitch(e.target.value)}
                className="w-full mt-1 bg-slate-900/50 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
              >
                {workspace.workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            </div>
          )}
          {auth.authUser && (
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs text-slate-500 truncate">{auth.authUser.username}</span>
              <button onClick={auth.handleLogout} className="text-[10px] text-slate-600 hover:text-red-400 transition-ui">Sign Out</button>
            </div>
          )}
          <div className="text-center mt-2">
            <span className="text-[10px] text-slate-600">v{APP_VERSION}</span>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main id="main-content" className={cn('flex-1 min-w-0', mainPadding)}>

        {showHeader && (
          <header className="mb-8">
            <h1 className="text-2xl font-display font-bold text-white">{headerMeta.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{headerMeta.subtitle}</p>
          </header>
        )}

        {/* Content Views */}
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <HomeView
              repos={data.repos}
              runs={data.runs}
              datasets={data.datasets}
              evaluations={data.evaluations}
              savedPrompts={data.savedPrompts}
              sessions={data.sessions}
              onNavigate={handleViewChange}
              onOpenChecklist={handleOpenChecklist}
              appConfig={config.appConfig}
              observabilitySummary={data.observabilitySummary}
              jobs={data.jobs}
            />
          )}

          {view === 'agents' && (
            <OrchestratorView
              onSpawn={data.handleSpawn}
              loading={data.loading}
              result={data.spawnResult}
              spawnPerformance={data.spawnPerformance}
              sessions={data.sessions}
              savedPrompts={data.savedPrompts}
              onSavePrompt={data.savePrompt}
              onDeletePrompt={data.deletePrompt}
              onClearAllPrompts={data.clearAllPrompts}
              onUsePrompt={handleAgentUsePrompt}
              onDirtyChange={setDirtyGoal}
              prefillGoal={prefillGoal}
              onPrefillConsumed={handlePrefillConsumed}
              queueEnabled={config.appConfig?.config?.queue?.enabled === true}
              externalSkillsConfig={config.appConfig?.config?.externalSkills}
              latestRun={data.runs[0] || null}
            />
          )}

          {view === 'runs' && (
            <RunsView runs={data.runs} apiFetch={apiFetch} />
          )}

          {view === 'jobs' && (
            <JobsView jobs={data.jobs} onCancelJob={data.cancelJob} />
          )}

          {view === 'evaluations' && (
            <EvaluationsView
              datasets={data.datasets}
              runs={data.runs}
              evaluations={data.evaluations}
              templates={data.evaluationTemplates}
              onCreateDataset={data.createDataset}
              onDeleteDataset={data.deleteDataset}
              onAddDatasetItem={data.addDatasetItem}
              onCreateEvaluation={data.createEvaluation}
              onImportDataset={data.importDataset}
              onCreateTemplate={data.createEvaluationTemplate}
              onUpdateTemplate={data.updateEvaluationTemplate}
              onDeleteTemplate={data.deleteEvaluationTemplate}
              onImportTemplates={data.importEvaluationTemplates}
              onExportTemplates={data.exportEvaluationTemplates}
            />
          )}

          {view === 'library' && (
            <LibraryView
              savedPrompts={data.savedPrompts}
              agents={data.agents}
              tools={data.tools}
              onDeletePrompt={data.deletePrompt}
              onClearAllPrompts={data.clearAllPrompts}
              onUsePrompt={handleLibraryUsePrompt}
              transition={SPRING_SMOOTH}
            />
          )}

          {view === 'knowledge' && (
            <KnowledgeView
              categories={data.categories}
              categorized={categorized}
              categorySizes={data.categorySizes}
              externalSkillsCount={externalSkillsCount}
              externalSkillsInstalledThisRun={externalSkillsInstalledThisRun}
              repos={data.repos}
              url={data.url}
              setUrl={data.setUrl}
              handleAdd={data.handleAdd}
              handleScan={data.handleScan}
              repoLoading={data.repoLoading}
              repoAction={data.repoAction}
              repoNotice={data.repoNotice}
            />
          )}

          {view === 'audit' && (
            <AuditView
              auditLogs={data.auditLogs}
              apiFetch={apiFetch}
              transition={SPRING_SMOOTH}
            />
          )}

          {view === 'logs' && (
            <LogsView logs={data.logs} transition={SPRING_SMOOTH} />
          )}

          {view === 'settings' && (
            <SettingsPanel
              config={config.appConfig}
              onSave={handleConfigSave}
              uiTheme={config.uiTheme}
              onThemeChange={config.setUiTheme}
              authStatus={auth.authStatus}
              authUser={auth.authUser}
              users={data.users}
              onCreateUser={data.createUser}
              onUpdateUser={data.updateUser}
              onDeleteUser={data.deleteUser}
              vectorStatus={data.vectorStatus}
              onRebuildVector={data.rebuildVectorIndex}
              workspaces={workspace.workspaces}
              activeWorkspace={workspace.activeWorkspace}
              onCreateWorkspace={workspace.createWorkspace}
              onUpdateWorkspace={workspace.updateWorkspace}
              onDeleteWorkspace={workspace.deleteWorkspace}
              onSetDefaultWorkspace={workspace.setDefaultWorkspace}
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
