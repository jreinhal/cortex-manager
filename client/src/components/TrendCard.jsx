import { cn } from '../lib/utils'
import { Sparkline } from './Sparkline'

export function TrendCard({ label, trend, accent }) {
  const hasData = trend.count > 0
  const delta = trend.delta ?? 0
  return (
    <div className="p-4 rounded-2xl border border-slate-800/70 bg-slate-900/40">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">
          {label}
        </div>
        <span className="tag-inline tag-inline-muted text-[10px]">{trend.count} runs</span>
      </div>
      {hasData ? (
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-slate-100 tabular-nums">{trend.latest}</div>
            <div
              className={cn(
                'text-[11px] font-semibold',
                delta >= 0 ? 'text-emerald-300' : 'text-red-300'
              )}
            >
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)} since last
            </div>
            <div className="text-[11px] text-slate-500">Avg {trend.avg.toFixed(1)}</div>
          </div>
          <Sparkline values={trend.values} stroke={accent} />
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-500">No evaluations captured yet.</div>
      )}
    </div>
  )
}
