export const SPRING_SMOOTH = { type: 'tween', duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }
export const SPRING_FAST = { type: 'tween', duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'
export const AUTH_TOKEN_KEY = 'cortex_token'
export const WORKSPACE_KEY = 'cortex_workspace_id'
export const THEME_KEY = 'cortex_theme'
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

export const MANUAL_URL = (() => {
  const base = API_BASE.replace(/\/api\/?$/, '')
  return `${base}/manual/index.html`
})()

export const FORMAT_OPTIONS = [
  { value: 'universal', label: 'Universal', accent: 'bg-cyan-400/80' },
  { value: 'chatgpt', label: 'ChatGPT', accent: 'bg-sky-400/80' },
  { value: 'claude', label: 'Claude', accent: 'bg-amber-400/80' },
  { value: 'gemini', label: 'Gemini', accent: 'bg-violet-400/80' },
]
export const DEFAULT_FORMAT = FORMAT_OPTIONS[0].value
