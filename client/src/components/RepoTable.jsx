import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal,
  Database,
  Cpu,
  Wrench,
  BarChart3,
  GitBranch,
  Folder,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { SPRING_FAST } from '../lib/constants'

function getIcon(purpose) {
  const p = purpose?.toLowerCase() || ''
  if (p.includes('agent')) return Cpu
  if (p.includes('skill')) return Terminal
  if (p.includes('knowledge')) return Database
  if (p.includes('tool')) return Wrench
  if (p.includes('benchmark')) return BarChart3
  return Folder
}

function getPurposeColor(purpose) {
  const p = purpose?.toLowerCase() || ''
  const match = { text: 'text-slate-300', bg: 'bg-white/5', badge: 'text-slate-200 border-white/10 bg-white/5' }
  if (p.includes('agent')) return match
  if (p.includes('skill')) return match
  if (p.includes('knowledge')) return match
  if (p.includes('tool')) return match
  if (p.includes('benchmark')) return match
  return match
}

function RepoRow({ repo, delay }) {
  const Icon = getIcon(repo.Purpose)
  const color = getPurposeColor(repo.Purpose)

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING_FAST, delay }}
      className="border-b border-white/5 hover:bg-white/[0.03] group"
    >
      <td className="py-2.5 pl-5 pr-4">
        <div className="flex items-center gap-3.5">
          <div className={cn('p-1.5 rounded-xl transition-ui group-hover:scale-105', color.bg)}>
            <Icon size={16} className={color.text} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-200 group-hover:text-slate-100 text-sm">
              {repo.Name}
            </div>
            <div className="text-[10px] text-slate-500 font-mono truncate max-w-[220px] mt-0.5 opacity-70">
              {repo.Path}
            </div>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-4">
        <div className="tag-inline tag-inline-muted font-mono text-[10px]">
          <GitBranch size={12} aria-hidden="true" />
          {repo.Branch}
        </div>
      </td>
      <td className="py-2.5 px-4">
        <span className={cn('tag-inline', color.badge)}>{repo.Purpose}</span>
      </td>
    </motion.tr>
  )
}

export function RepoTable({ repos }) {
  return (
    <div
      className="glass-panel rounded-3xl overflow-hidden shadow-2xl shadow-black/30"
      data-testid="repos-table"
    >
      <div className="px-6 py-3 border-b border-white/5 flex justify-between items-center bg-slate-900/20">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
          <Database size={16} className="text-slate-500" aria-hidden="true" />
          Tracked Resources
        </h3>
        <span className="tag-inline tag-inline-muted font-mono tabular-nums">
          {repos.length} Items
        </span>
      </div>
      <div
        className="overflow-x-auto"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}
      >
        <table className="w-full text-left border-collapse text-sm tabular-nums density-table">
          <thead className="table-head text-slate-400 text-[10px] font-medium tracking-[0.14em] border-b border-white/5">
            <tr>
              <th className="py-2.5 pl-5 pr-4">Name / Path</th>
              <th className="py-2.5 px-4">Branch</th>
              <th className="py-2.5 px-4">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <AnimatePresence>
              {repos.map((repo, i) => (
                <RepoRow key={repo.Name + i} repo={repo} delay={i * 0.05} />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  )
}
