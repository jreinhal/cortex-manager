import { motion } from 'framer-motion';

export function LogsView({ logs, transition }) {
  return (
    <motion.div
      key="logs"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={transition}
      className="h-[calc(100vh-180px)] glass-panel rounded-3xl p-6 flex flex-col"
    >
      <div
        className="flex-1 overflow-y-auto space-y-2 font-mono text-sm"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        data-testid="system-logs"
      >
        {logs.length === 0 && (
          <div className="text-slate-600 italic">No activity recorded.</div>
        )}
        {logs.map((log, i) => (
          <div
            key={i}
            className="text-slate-300 border-l-2 border-slate-700 pl-4 py-1.5 hover:bg-slate-800/30 rounded-r-lg break-words"
          >
            {log}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
