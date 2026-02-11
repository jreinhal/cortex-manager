import { useState } from 'react';
import { motion } from 'framer-motion';
import { EmptyState } from '../components/EmptyState';

export function AuditView({ auditLogs, apiFetch, transition }) {
  const [query, setQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');

  const events = Array.from(new Set((auditLogs || []).map((entry) => entry.event))).sort();
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = (auditLogs || []).filter((entry) => {
    if (eventFilter !== 'all' && entry.event !== eventFilter) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      entry.event,
      entry.user?.username,
      entry.user?.role,
      entry.workspaceId,
      entry.ip,
      JSON.stringify(entry.metadata || {})
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const handleExport = async (format) => {
    setExporting(format);
    setExportError('');
    try {
      const params = new URLSearchParams({ format });
      if (eventFilter !== 'all') {
        params.set('event', eventFilter);
      }
      const res = await apiFetch(`/audit/export?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `cortex-audit-${stamp}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e.message || 'Export failed');
    }
    setExporting('');
  };

  return (
    <motion.div
      key="audit"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={transition}
      className="space-y-6"
    >
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Audit Trail</div>
          <div className="flex items-center gap-2">
            <span className="tag-inline tag-inline-muted font-mono tabular-nums">{filtered.length} entries</span>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={exporting === 'csv'}
              className="px-3 py-1.5 rounded-2xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 text-[10px] uppercase tracking-[0.2em] border border-slate-700/60 disabled:opacity-50"
            >
              {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={() => handleExport('json')}
              disabled={exporting === 'json'}
              className="px-3 py-1.5 rounded-2xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 text-[10px] uppercase tracking-[0.2em] border border-slate-700/60 disabled:opacity-50"
            >
              {exporting === 'json' ? 'Exporting…' : 'Export JSON'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, users, IPs…"
            className="flex-1 min-w-[220px] bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50"
          />
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
          >
            <option value="all">All events</option>
            {events.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </select>
        </div>
        {exportError && (
          <div className="mt-3 text-xs text-red-300 border border-red-500/30 bg-red-500/10 rounded-xl px-3 py-2">
            {exportError}
          </div>
        )}
        <div className="mt-5 space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1" data-testid="audit-logs">
          {filtered.length === 0 && (
            <EmptyState title="No audit events found" subtitle="Try clearing filters or generate new activity." />
          )}
          {filtered.map((entry, index) => {
            const timestamp = entry.ts ? new Date(entry.ts).toLocaleString() : '—';
            const userLabel = entry.user?.username || 'system';
            const roleLabel = entry.user?.role || '—';
            const workspaceLabel = entry.workspaceId || 'default';
            const agentLabel = entry.userAgent || '';
            return (
              <div key={`${entry.ts}-${entry.event}-${index}`} className="glass-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{entry.event}</div>
                    <div className="text-xs text-slate-500 mt-1">{timestamp}</div>
                  </div>
                  <span className="tag-chip tag-chip-muted font-mono">{workspaceLabel}</span>
                </div>
                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs text-slate-400">
                  <div>User: <span className="text-slate-200">{userLabel}</span></div>
                  <div>Role: <span className="text-slate-200">{roleLabel}</span></div>
                  <div>IP: <span className="text-slate-200">{entry.ip || '—'}</span></div>
                  <div>Agent: <span className="text-slate-200">{agentLabel ? agentLabel.slice(0, 48) : '—'}</span></div>
                </div>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <details className="mt-3 text-xs text-slate-400">
                    <summary className="cursor-pointer text-slate-300">Metadata</summary>
                    <div className="mt-2 grid gap-2">
                      {Object.entries(entry.metadata).map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-4">
                          <span className="text-slate-500">{key}</span>
                          <span className="text-slate-200 text-right break-all">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
