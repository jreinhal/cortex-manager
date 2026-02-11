import { createContext, useContext, useState, useCallback } from 'react'
import { WORKSPACE_KEY } from '../lib/constants'
import { apiFetch } from '../lib/api'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspace, setActiveWorkspace] = useState(null)

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await apiFetch('/workspaces/active')
      if (!res.ok) return
      const data = await res.json()
      const active = data.active || null
      const list = Array.isArray(data.workspaces) ? data.workspaces : []
      setActiveWorkspace(active)
      setWorkspaces(list)
      if (active?.id && !window.localStorage.getItem(WORKSPACE_KEY)) {
        window.localStorage.setItem(WORKSPACE_KEY, active.id)
      }
    } catch (e) {
      console.error('Failed to fetch workspaces:', e)
    }
  }, [])

  const handleWorkspaceSwitch = useCallback(
    (workspaceId, onSwitch) => {
      if (!workspaceId) return
      window.localStorage.setItem(WORKSPACE_KEY, workspaceId)
      const selected = workspaces.find((ws) => ws.id === workspaceId) || null
      setActiveWorkspace(selected)
      if (onSwitch) onSwitch()
    },
    [workspaces],
  )

  const createWorkspace = useCallback(
    async (payload) => {
      try {
        const res = await apiFetch('/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) fetchWorkspaces()
      } catch (e) {
        console.error('Failed to create workspace:', e)
      }
    },
    [fetchWorkspaces],
  )

  const updateWorkspace = useCallback(
    async (id, payload) => {
      try {
        const res = await apiFetch(`/workspaces/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) fetchWorkspaces()
      } catch (e) {
        console.error('Failed to update workspace:', e)
      }
    },
    [fetchWorkspaces],
  )

  const deleteWorkspace = useCallback(
    async (id) => {
      if (!window.confirm('Delete this workspace?')) return
      try {
        const res = await apiFetch(`/workspaces/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (data.success) fetchWorkspaces()
      } catch (e) {
        console.error('Failed to delete workspace:', e)
      }
    },
    [fetchWorkspaces],
  )

  const setDefaultWorkspace = useCallback(
    async (id) => {
      try {
        const res = await apiFetch(`/workspaces/${id}/default`, { method: 'POST' })
        const data = await res.json()
        if (data.success) fetchWorkspaces()
      } catch (e) {
        console.error('Failed to set default workspace:', e)
      }
    },
    [fetchWorkspaces],
  )

  const value = {
    workspaces,
    activeWorkspace,
    fetchWorkspaces,
    handleWorkspaceSwitch,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    setDefaultWorkspace,
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return ctx
}
