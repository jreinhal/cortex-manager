import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { cn, formatBytes } from '../lib/utils'
import { SPRING_SMOOTH } from '../lib/constants'
import { RepoTable } from '../components/RepoTable'

export function KnowledgeView({
  categories,
  categorized,
  categorySizes,
  externalSkillsCount,
  externalSkillsInstalledThisRun,
  repos,
  url,
  setUrl,
  handleAdd,
  handleScan,
  repoLoading,
  repoAction,
  repoNotice,
}) {
  return (
    <motion.div
      key="knowledge"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={SPRING_SMOOTH}
    >
      {/* Repository Overview */}
      <div className="glass-panel rounded-3xl px-6 py-4 mb-8">
        {categories.length === 0 ? (
          <div className="text-sm text-slate-500 py-4">Initializing Knowledge Base…</div>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            {categories.map((cat) => {
              const sizeBytes = categorySizes[cat.toLowerCase()] ?? 0
              const testKey = cat.toLowerCase()
              const count = categorized[cat] ? categorized[cat].length : 0
              const label = cat.toLowerCase() === 'skills' ? 'Skill Repos' : cat
              return (
                <div
                  key={cat}
                  data-testid={`stat-card-${testKey}`}
                  className="flex items-center gap-4 pr-6 border-r border-white/5 last:border-r-0"
                >
                  <div>
                    <div className="text-[10px] font-medium text-slate-500 tracking-[0.18em] uppercase">
                      {label}
                    </div>
                    <div className="text-2xl font-semibold text-slate-100 tabular-nums">{count}</div>
                    <div
                      className="text-[11px] text-slate-500"
                      data-testid={`stat-size-${testKey}`}
                    >
                      Size {formatBytes(sizeBytes)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div data-testid="stat-card-external-skills" className="flex items-center gap-4 pr-6">
              <div>
                <div className="text-[10px] font-medium text-slate-500 tracking-[0.18em] uppercase">
                  External Skills
                </div>
                <div className="text-2xl font-semibold text-slate-100 tabular-nums">
                  {externalSkillsCount}
                  {externalSkillsInstalledThisRun > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                      +{externalSkillsInstalledThisRun}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">Installed from providers</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel rounded-3xl p-6 mb-8">
        <div className="mb-3">
          <label htmlFor="repo-url" className="tag-inline tag-inline-muted">
            Add Repository
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-3xl">
          <div className="flex-1 min-w-[260px]">
            <input
              id="repo-url"
              name="repoUrl"
              type="url"
              data-testid="repo-url-input"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g., https://github.com/org/repo…"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="w-full bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 focus-visible:border-cyan-500/50 rounded-2xl px-4 py-3 text-sm focus-visible:outline-none transition-ui placeholder:text-slate-600 shadow-inner"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={repoLoading || !url}
            data-testid="repo-clone-btn"
            className="px-6 py-3 bg-slate-100 hover:bg-white text-slate-900 rounded-2xl font-bold transition-ui disabled:opacity-50 text-sm shadow-lg shadow-white/5 active:scale-95 flex items-center gap-2"
          >
            {repoLoading && repoAction === 'clone' ? (
              <>
                <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                Cloning…
              </>
            ) : (
              'Clone'
            )}
          </button>
          <button
            type="button"
            onClick={handleScan}
            disabled={repoLoading}
            data-testid="repo-scan-btn"
            className="group flex items-center gap-2 px-5 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-2xl border border-slate-700/50 transition-ui text-sm font-bold disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={cn(
                'transition-transform group-hover:rotate-180 duration-500',
                repoLoading && repoAction === 'scan' ? 'animate-spin' : ''
              )}
              aria-hidden="true"
            />
            {repoLoading && repoAction === 'scan' ? 'Syncing…' : 'Scan'}
          </button>
        </div>
        {repoNotice && (
          <div
            className={cn(
              'mt-3 px-4 py-2 rounded-xl text-sm border',
              repoNotice.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : repoNotice.type === 'error'
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-slate-900/60 border-slate-700/60 text-slate-300'
            )}
            role="status"
            aria-live="polite"
            data-testid="repo-notice"
          >
            {repoNotice.message}
          </div>
        )}
      </div>
      <RepoTable repos={repos} />
    </motion.div>
  )
}
