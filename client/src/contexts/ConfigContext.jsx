import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { THEME_KEY } from '../lib/constants'
import { apiFetch } from '../lib/api'

const ConfigContext = createContext(null)

export function ConfigProvider({ children, authReady, authEnabled, authUser }) {
  const [appConfig, setAppConfig] = useState(null)
  const [isFirstRun, setIsFirstRun] = useState(null) // null = loading
  const [defaultPaths, setDefaultPaths] = useState({})
  const [uiTheme, setUiTheme] = useState(() => {
    if (typeof window === 'undefined') return 'system'
    return window.localStorage.getItem(THEME_KEY) || 'system'
  })

  // Sync theme from config when no local preference is stored
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(THEME_KEY)
    const configTheme = appConfig?.config?.ui?.theme
    if (!stored && configTheme) {
      setUiTheme(configTheme)
    }
  }, [appConfig?.config?.ui?.theme])

  // Apply theme to document
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(THEME_KEY, uiTheme)
    const root = document.documentElement

    if (uiTheme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const applySystemTheme = () => {
        root.setAttribute('data-theme', media.matches ? 'dark' : 'light')
        root.setAttribute('data-theme-mode', 'system')
      }
      applySystemTheme()
      media.addEventListener('change', applySystemTheme)
      return () => media.removeEventListener('change', applySystemTheme)
    }

    root.setAttribute('data-theme', uiTheme)
    root.setAttribute('data-theme-mode', uiTheme)
  }, [uiTheme])

  const checkConfig = useCallback(async () => {
    try {
      const [configRes, pathsRes] = await Promise.all([
        apiFetch('/config'),
        apiFetch('/default-paths'),
      ])
      if (!configRes.ok) return
      const configData = await configRes.json()
      const pathsData = await pathsRes.json()

      setAppConfig(configData)
      setDefaultPaths(pathsData)
      setIsFirstRun(configData.isFirstRun)
    } catch (e) {
      console.error('Failed to check config:', e)
      setIsFirstRun(false) // Assume not first run if can't connect
    }
  }, [])

  // Check config when auth is ready
  useEffect(() => {
    if (!authReady) return
    if (authEnabled && !authUser) return
    checkConfig()
  }, [authReady, authEnabled, authUser, checkConfig])

  const handleSetupComplete = useCallback(
    (result) => {
      setIsFirstRun(false)
      setAppConfig((prev) => ({
        ...prev,
        config: { ...prev?.config, reposRoot: result.reposRoot },
      }))
    },
    [],
  )

  const handleConfigSave = useCallback((newConfig) => {
    setAppConfig((prev) => ({ ...prev, config: newConfig }))
  }, [])

  const value = {
    appConfig,
    isFirstRun,
    defaultPaths,
    uiTheme,
    setUiTheme,
    handleSetupComplete,
    handleConfigSave,
  }

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) {
    throw new Error('useConfig must be used within a ConfigProvider')
  }
  return ctx
}
