import { API_BASE, AUTH_TOKEN_KEY, WORKSPACE_KEY } from './constants'

export function apiFetch(path, options = {}) {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY)
  const workspaceId = window.localStorage.getItem(WORKSPACE_KEY)
  const headers = {
    ...(options.headers || {}),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId
  }
  const url = path.startsWith('http')
    ? path
    : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  return fetch(url, { ...options, headers }).then((res) => {
    if (res.status === 401) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY)
      window.dispatchEvent(new CustomEvent('auth-expired'))
    }
    return res
  })
}
