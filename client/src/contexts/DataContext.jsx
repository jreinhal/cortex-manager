import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '../lib/api'

const DataContext = createContext(null)

export function DataProvider({ children, isFirstRun, authEnabled, authUser }) {
  const [repos, setRepos] = useState([])
  const [categories, setCategories] = useState([])
  const [categorySizes, setCategorySizes] = useState({})
  const [externalSkillsInstalled, setExternalSkillsInstalled] = useState([])
  const [runs, setRuns] = useState([])
  const [datasets, setDatasets] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [agents, setAgents] = useState([])
  const [tools, setTools] = useState([])
  const [savedPrompts, setSavedPrompts] = useState([])
  const [evaluationTemplates, setEvaluationTemplates] = useState([])
  const [jobs, setJobs] = useState([])
  const [observabilitySummary, setObservabilitySummary] = useState(null)
  const [vectorStatus, setVectorStatus] = useState(null)
  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [logs, setLogs] = useState([])

  // Repo add/scan UI state
  const [url, setUrl] = useState('')
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoAction, setRepoAction] = useState(null)
  const [repoNotice, setRepoNotice] = useState(null)
  const repoNoticeTimeoutRef = useRef(null)

  // Spawn state
  const [loading, setLoading] = useState(false)
  const [spawnResult, setSpawnResult] = useState('')

  const addLog = useCallback((msg) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 200))
  }, [])

  const pushRepoNotice = useCallback((message, type = 'info', timeoutMs = 4000) => {
    if (repoNoticeTimeoutRef.current) {
      clearTimeout(repoNoticeTimeoutRef.current)
      repoNoticeTimeoutRef.current = null
    }
    setRepoNotice({ message, type })
    if (timeoutMs > 0) {
      repoNoticeTimeoutRef.current = setTimeout(() => {
        setRepoNotice(null)
        repoNoticeTimeoutRef.current = null
      }, timeoutMs)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (repoNoticeTimeoutRef.current) clearTimeout(repoNoticeTimeoutRef.current)
    }
  }, [])

  // --- Fetch helpers ---

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await apiFetch('/audit?limit=200')
      if (!res.ok) return
      const data = await res.json()
      setAuditLogs(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch audit logs:', e)
    }
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiFetch('/sessions')
      const data = await res.json()
      setSessions(data)
    } catch (e) {
      console.error('Failed to fetch sessions:', e)
    }
  }, [])

  const fetchRuns = useCallback(async () => {
    try {
      const res = await apiFetch('/runs')
      const data = await res.json()
      setRuns(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch runs:', e)
    }
  }, [])

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await apiFetch('/datasets')
      const data = await res.json()
      setDatasets(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch datasets:', e)
    }
  }, [])

  const fetchEvaluations = useCallback(async () => {
    try {
      const res = await apiFetch('/evaluations')
      const data = await res.json()
      setEvaluations(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch evaluations:', e)
    }
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await apiFetch('/agents')
      const data = await res.json()
      setAgents(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch agents:', e)
    }
  }, [])

  const fetchTools = useCallback(async () => {
    try {
      const res = await apiFetch('/tools')
      const data = await res.json()
      setTools(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch tools:', e)
    }
  }, [])

  const fetchSavedPrompts = useCallback(async () => {
    try {
      const res = await apiFetch('/prompts')
      const data = await res.json()
      setSavedPrompts(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch saved prompts:', e)
    }
  }, [])

  const fetchEvaluationTemplates = useCallback(async () => {
    try {
      const res = await apiFetch('/evaluation-templates')
      const data = await res.json()
      setEvaluationTemplates(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch evaluation templates:', e)
    }
  }, [])

  const fetchJobs = useCallback(async () => {
    try {
      const res = await apiFetch('/jobs')
      const data = await res.json()
      setJobs(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch jobs:', e)
    }
  }, [])

  const fetchObservabilitySummary = useCallback(async () => {
    try {
      const res = await apiFetch('/observability/summary')
      const data = await res.json()
      setObservabilitySummary(data)
    } catch (e) {
      console.error('Failed to fetch observability summary:', e)
    }
  }, [])

  const fetchVectorStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/vector-index/status')
      const data = await res.json()
      setVectorStatus(data)
    } catch (e) {
      console.error('Failed to fetch vector status:', e)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch('/users')
      if (!res.ok) return
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch users:', e)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiFetch('/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (e) {
      console.error('Failed to fetch categories', e)
    }
  }, [])

  const fetchCategorySizes = useCallback(async () => {
    try {
      const res = await apiFetch('/category-sizes')
      if (res.ok) {
        const data = await res.json()
        const normalized = {}
        Object.entries(data || {}).forEach(([key, value]) => {
          normalized[key.toLowerCase()] = value
        })
        setCategorySizes(normalized)
      }
    } catch (e) {
      console.error('Failed to fetch category sizes', e)
    }
  }, [])

  const fetchExternalSkillsInstalled = useCallback(async () => {
    try {
      const res = await apiFetch('/external-skills/installed')
      if (!res.ok) return
      const data = await res.json()
      setExternalSkillsInstalled(Array.isArray(data?.installed) ? data.installed : [])
    } catch (e) {
      console.error('Failed to fetch external skills:', e)
    }
  }, [])

  const derivePurpose = (repoPath) => {
    if (!repoPath) return 'Unknown'
    const normalize = repoPath.replace(/\\/g, '/')
    const sections = normalize.split('/')
    if (sections.length < 2) return 'Unknown'
    const parent = sections[sections.length - 2]
    return parent.charAt(0).toUpperCase() + parent.slice(1)
  }

  const fetchRepos = useCallback(async () => {
    try {
      const res = await apiFetch('/repos')
      const data = await res.json()
      const enriched = data.map((repo) => ({
        ...repo,
        Purpose: repo.Category || derivePurpose(repo.Path),
      }))
      setRepos(enriched)
    } catch (e) {
      console.error('Failed to fetch repos:', e)
    }
  }, [])

  // Aggregate fetch
  const fetchWorkspacesRef = useRef(null)
  const fetchData = useCallback(() => {
    if (fetchWorkspacesRef.current) fetchWorkspacesRef.current()
    fetchRepos()
    fetchCategories()
    fetchExternalSkillsInstalled()
    fetchRuns()
    fetchAuditLogs()
    fetchDatasets()
    fetchEvaluations()
    fetchAgents()
    fetchTools()
    fetchSavedPrompts()
    fetchEvaluationTemplates()
    fetchJobs()
    fetchObservabilitySummary()
    fetchVectorStatus()
    if (authEnabled && authUser?.role === 'admin') {
      fetchUsers()
    }
  }, [
    fetchRepos, fetchCategories, fetchExternalSkillsInstalled, fetchRuns,
    fetchAuditLogs, fetchDatasets, fetchEvaluations, fetchAgents, fetchTools,
    fetchSavedPrompts, fetchEvaluationTemplates, fetchJobs,
    fetchObservabilitySummary, fetchVectorStatus, fetchUsers,
    authEnabled, authUser,
  ])

  // Allow workspace context to plug in its fetchWorkspaces
  const setWorkspaceFetcher = useCallback((fn) => {
    fetchWorkspacesRef.current = fn
  }, [])

  // Polling intervals when not first run
  useEffect(() => {
    if (isFirstRun === false) {
      fetchData()
      fetchCategorySizes()
      const dataInterval = setInterval(fetchData, 10000)
      const sizeInterval = setInterval(fetchCategorySizes, 5000)
      return () => {
        clearInterval(dataInterval)
        clearInterval(sizeInterval)
      }
    }
  }, [isFirstRun, fetchData, fetchCategorySizes])

  // Seed logs from audit trail
  useEffect(() => {
    if (auditLogs.length === 0) return
    setLogs((prev) => {
      if (prev.length > 0) return prev
      const seeded = auditLogs
        .slice(0, 20)
        .reverse()
        .map((entry) => {
          const rawTs = entry.ts || entry.timestamp
          const ts = rawTs ? new Date(rawTs).toLocaleTimeString() : '—'
          const meta = entry.metadata || entry.meta || {}
          const detail = meta.name || meta.source || meta.id || ''
          return `[${ts}] ${entry.event}${detail ? ': ' + detail : ''}`
        })
      return seeded
    })
  }, [auditLogs])

  // --- CRUD operations ---

  const savePrompt = useCallback(async (title, query) => {
    if (!query) return null
    try {
      const res = await apiFetch('/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, query }),
      })
      const data = await res.json()
      if (data.success) {
        setSavedPrompts((prev) => [data.prompt, ...prev])
        return data.prompt
      }
    } catch (e) {
      console.error('Failed to save prompt:', e)
    }
    return null
  }, [])

  const deletePrompt = useCallback(async (id) => {
    try {
      const res = await apiFetch(`/prompts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setSavedPrompts((prev) => prev.filter((prompt) => prompt.id !== id))
        return true
      }
    } catch (e) {
      console.error('Failed to delete prompt:', e)
    }
    return false
  }, [])

  const createDataset = useCallback(
    async (name, description, benchmarkType = 'response') => {
      try {
        const res = await apiFetch('/datasets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, benchmarkType }),
        })
        const data = await res.json()
        if (data.success) {
          setDatasets((prev) => [data.dataset, ...prev])
          addLog(`Dataset created: ${name}`)
          fetchEvaluations()
          return data.dataset
        }
      } catch (e) {
        console.error('Failed to create dataset:', e)
      }
      return null
    },
    [addLog, fetchEvaluations],
  )

  const deleteDataset = useCallback(
    async (id) => {
      try {
        const res = await apiFetch(`/datasets/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (data.success) {
          setDatasets((prev) => prev.filter((dataset) => dataset.id !== id))
          addLog(`Dataset deleted: ${id}`)
          return true
        }
      } catch (e) {
        console.error('Failed to delete dataset:', e)
      }
      return false
    },
    [addLog],
  )

  const addDatasetItem = useCallback(
    async (datasetId, item) => {
      try {
        const res = await apiFetch(`/datasets/${datasetId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
        const data = await res.json()
        if (data.success) {
          await fetchDatasets()
          return data.item
        }
      } catch (e) {
        console.error('Failed to add dataset item:', e)
      }
      return null
    },
    [fetchDatasets],
  )

  const createEvaluation = useCallback(
    async (datasetId, runId) => {
      try {
        const res = await apiFetch('/evaluations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ datasetId, runId }),
        })
        const data = await res.json()
        if (data.success) {
          setEvaluations((prev) => [data.evaluation, ...prev])
          addLog(`Evaluation created for dataset ${datasetId}`)
          return data.evaluation
        }
      } catch (e) {
        console.error('Failed to create evaluation:', e)
      }
      return null
    },
    [addLog],
  )

  const importDataset = useCallback(async (datasetPayload) => {
    try {
      const res = await apiFetch('/datasets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: datasetPayload }),
      })
      const data = await res.json()
      if (data.success) {
        setDatasets((prev) => [data.dataset, ...prev])
        return data.dataset
      }
    } catch (e) {
      console.error('Failed to import dataset:', e)
    }
    return null
  }, [])

  const createEvaluationTemplate = useCallback(async (payload) => {
    try {
      const res = await apiFetch('/evaluation-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        setEvaluationTemplates((prev) => [data.template, ...prev])
        return data.template
      }
    } catch (e) {
      console.error('Failed to create template:', e)
    }
    return null
  }, [])

  const updateEvaluationTemplate = useCallback(async (id, payload) => {
    try {
      const res = await apiFetch(`/evaluation-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        setEvaluationTemplates((prev) =>
          prev.map((template) => (template.id === id ? data.template : template)),
        )
        return data.template
      }
    } catch (e) {
      console.error('Failed to update template:', e)
    }
    return null
  }, [])

  const deleteEvaluationTemplate = useCallback(async (id) => {
    try {
      const res = await apiFetch(`/evaluation-templates/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setEvaluationTemplates((prev) => prev.filter((template) => template.id !== id))
        return true
      }
    } catch (e) {
      console.error('Failed to delete template:', e)
    }
    return false
  }, [])

  const importEvaluationTemplates = useCallback(
    async (payload) => {
      try {
        const res = await apiFetch('/evaluation-templates/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templates: payload }),
        })
        const data = await res.json()
        if (data.success) {
          await fetchEvaluationTemplates()
          return data.templates || []
        }
      } catch (e) {
        console.error('Failed to import templates:', e)
      }
      return []
    },
    [fetchEvaluationTemplates],
  )

  const exportEvaluationTemplates = useCallback(async () => {
    try {
      const res = await apiFetch('/evaluation-templates/export')
      const data = await res.json()
      if (!res.ok) return
      const templates = data.templates || []
      const blob = new Blob([JSON.stringify({ templates }, null, 2)], { type: 'application/json' })
      const dlUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = dlUrl
      link.download = `evaluation-templates-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(dlUrl)
    } catch (e) {
      console.error('Failed to export templates:', e)
    }
  }, [])

  const rebuildVectorIndex = useCallback(
    async () => {
      try {
        const res = await apiFetch('/vector-index/rebuild', { method: 'POST' })
        const data = await res.json()
        if (data?.queued) {
          addLog('Vector index rebuild queued.')
          fetchJobs()
        } else {
          addLog('Vector index rebuild complete.')
          fetchVectorStatus()
        }
      } catch (e) {
        console.error('Vector index rebuild failed:', e)
      }
    },
    [addLog, fetchJobs, fetchVectorStatus],
  )

  const createUser = useCallback(
    async ({ username, password, role, workspaceId }) => {
      try {
        const res = await apiFetch('/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role, workspaceId }),
        })
        const data = await res.json()
        if (data.success) fetchUsers()
      } catch (e) {
        console.error('Failed to create user:', e)
      }
    },
    [fetchUsers],
  )

  const updateUser = useCallback(
    async (id, updates) => {
      try {
        const res = await apiFetch(`/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        const data = await res.json()
        if (data.success) fetchUsers()
      } catch (e) {
        console.error('Failed to update user:', e)
      }
    },
    [fetchUsers],
  )

  const deleteUser = useCallback(
    async (id) => {
      if (!window.confirm('Delete this user?')) return
      try {
        const res = await apiFetch(`/users/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (data.success) fetchUsers()
      } catch (e) {
        console.error('Failed to delete user:', e)
      }
    },
    [fetchUsers],
  )

  const cancelJob = useCallback(
    async (id) => {
      try {
        const res = await apiFetch(`/jobs/${id}/cancel`, { method: 'POST' })
        const data = await res.json()
        if (data.success) fetchJobs()
      } catch (e) {
        console.error('Failed to cancel job:', e)
      }
    },
    [fetchJobs],
  )

  const handleScan = useCallback(
    async () => {
      setRepoLoading(true)
      setRepoAction('scan')
      pushRepoNotice('Scanning repositories…', 'info', 0)
      try {
        addLog('Starting System Scan…')
        const res = await apiFetch('/scan', { method: 'POST' })
        const data = await res.json()
        addLog(`Scan: ${data.output || 'Complete'}`)
        pushRepoNotice(data.output || 'Scan complete.', 'success')
        fetchData()
        fetchCategorySizes()
      } catch (_e) {
        addLog('Scan failed. Check the server and try again.')
        pushRepoNotice('Scan failed. Check the server and try again.', 'error')
      }
      setRepoLoading(false)
      setRepoAction(null)
    },
    [addLog, pushRepoNotice, fetchData, fetchCategorySizes],
  )

  const handleAdd = useCallback(
    async () => {
      if (!url) return
      const trimmedUrl = url.trim().replace(/\/+$/, '')
      const repoName = trimmedUrl.split('/').pop()?.replace(/\.git$/i, '')
      if (repoName && repos.some((r) => r.Name?.toLowerCase() === repoName.toLowerCase())) {
        addLog(`Repo already exists: ${repoName}`)
        pushRepoNotice(`Repository already exists: ${repoName}`, 'error')
        return
      }

      setRepoLoading(true)
      setRepoAction('clone')
      addLog(`Cloning ${url}…`)
      pushRepoNotice(`Cloning ${repoName || 'repository'}…`, 'info', 0)
      let shouldClear = false
      let shouldRefresh = false
      try {
        const res = await apiFetch('/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.success === false) {
          if (data.code === 'REPO_EXISTS') {
            const location = data.repo?.Path || data.error || 'Repository already exists.'
            addLog(`Repo already exists: ${location}`)
            pushRepoNotice(`Repository already exists: ${location}`, 'error')
          } else if (data.code === 'INVALID_URL') {
            addLog('Invalid repository URL. Check the URL and try again.')
            pushRepoNotice('Invalid repository URL. Check the URL and try again.', 'error')
          } else if (data.error) {
            addLog(`Add failed: ${data.error}`)
            pushRepoNotice(`Add failed: ${data.error}`, 'error')
          } else {
            addLog('Add failed. Check the URL and try again.')
            pushRepoNotice('Add failed. Check the URL and try again.', 'error')
          }
        } else {
          addLog(data.output || 'Clone Complete')
          pushRepoNotice(data.output || 'Clone complete.', 'success')
          shouldClear = true
          shouldRefresh = true
          fetchCategorySizes()
        }
      } catch (_e) {
        addLog('Add failed. Check the URL and try again.')
        pushRepoNotice('Add failed. Check the URL and try again.', 'error')
      }
      setRepoLoading(false)
      setRepoAction(null)
      if (shouldClear) setUrl('')
      if (shouldRefresh) fetchData()
    },
    [url, repos, addLog, pushRepoNotice, fetchData, fetchCategorySizes],
  )

  const handleSpawn = useCallback(
    async (goal, format = 'universal', runInBackground = false, externalSkillsRequest = null) => {
      setLoading(true)
      setSpawnResult('')
      addLog(`Orchestrating agent for: "${goal}"…`)
      try {
        const res = await apiFetch('/spawn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal, format, async: runInBackground, externalSkills: externalSkillsRequest }),
        })
        const data = await res.json()
        if (data.success) {
          if (data.queued) {
            setSpawnResult(`Spawn queued as ${data.job?.id}. Monitor Jobs for progress.`)
            addLog(`Spawn queued (${data.job?.id || 'job'}).`)
            fetchJobs()
          } else {
            setSpawnResult(data.output)
            addLog('Agent Spawned Successfully')

            await apiFetch('/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ goal, agent: 'std-agent', output: data.output, format }),
            })
            fetchSessions()
            fetchRuns()
          }
        } else {
          addLog(`Spawn Error: ${data.error}`)
        }
      } catch (_e) {
        addLog('Spawn request failed. Check the server and try again.')
      }
      setLoading(false)
    },
    [addLog, fetchJobs, fetchSessions, fetchRuns],
  )

  const value = {
    // Data
    repos,
    categories,
    categorySizes,
    externalSkillsInstalled,
    runs,
    datasets,
    evaluations,
    agents,
    tools,
    savedPrompts,
    evaluationTemplates,
    jobs,
    observabilitySummary,
    vectorStatus,
    users,
    sessions,
    auditLogs,
    logs,

    // Repo UI
    url,
    setUrl,
    repoLoading,
    repoAction,
    repoNotice,

    // Spawn
    loading,
    spawnResult,

    // Actions
    addLog,
    fetchData,
    fetchSessions,
    fetchCategorySizes,
    setWorkspaceFetcher,
    handleScan,
    handleAdd,
    handleSpawn,
    savePrompt,
    deletePrompt,
    createDataset,
    deleteDataset,
    addDatasetItem,
    createEvaluation,
    importDataset,
    createEvaluationTemplate,
    updateEvaluationTemplate,
    deleteEvaluationTemplate,
    importEvaluationTemplates,
    exportEvaluationTemplates,
    rebuildVectorIndex,
    createUser,
    updateUser,
    deleteUser,
    cancelJob,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) {
    throw new Error('useData must be used within a DataProvider')
  }
  return ctx
}
