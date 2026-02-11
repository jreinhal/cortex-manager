/**
 * Route configuration for CORTEX.
 *
 * Maps URL paths to the internal view keys used by App.jsx.
 * App reads the current location to decide which view to render,
 * keeping all state centralised until contexts are extracted later.
 */

/** Maps route paths to internal view keys. */
export const VIEW_ROUTES = {
  '/': 'home',
  '/agents': 'agents',
  '/runs': 'runs',
  '/jobs': 'jobs',
  '/evaluations': 'evaluations',
  '/library': 'library',
  '/knowledge': 'knowledge',
  '/audit': 'audit',
  '/logs': 'logs',
  '/settings': 'settings',
}

/** Maps internal view keys to route paths (reverse lookup). */
export const VIEW_PATHS = Object.fromEntries(
  Object.entries(VIEW_ROUTES).map(([path, key]) => [key, path])
)

/** Ordered list of view keys. */
export const VIEW_KEYS = [
  'home', 'agents', 'runs', 'jobs', 'evaluations',
  'library', 'knowledge', 'audit', 'logs', 'settings',
]

/** Legacy query-param aliases. */
export const VIEW_ALIASES = {
  dashboard: 'home',
  repos: 'knowledge',
  repositories: 'knowledge',
}

/**
 * Resolve a pathname to a view key.
 * Returns 'home' for unknown paths.
 */
export function resolveViewFromPath(pathname) {
  return VIEW_ROUTES[pathname] || 'home'
}

/**
 * Resolve a legacy ?view= query param to a view key.
 * Handles aliases and returns null if no valid view found.
 */
export function resolveViewFromQuery(queryValue) {
  if (!queryValue) return null
  const aliased = VIEW_ALIASES[queryValue] || queryValue
  return VIEW_KEYS.includes(aliased) ? aliased : null
}
