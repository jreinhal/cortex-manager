export function EmptyState({ title, subtitle }) {
  return (
    <div className="text-center text-slate-500 py-10 border border-dashed border-slate-800 rounded-3xl">
      <div className="text-sm font-semibold text-slate-400">{title}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  )
}
