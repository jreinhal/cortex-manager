import { motion } from 'framer-motion';
import { EmptyState } from '../components/EmptyState';

export function LibraryView({
  savedPrompts,
  agents,
  tools,
  onDeletePrompt,
  onClearAllPrompts,
  onUsePrompt,
  transition
}) {
  const handleDeletePrompt = (prompt) => {
    const label = prompt?.title ? `"${prompt.title}"` : 'this prompt';
    if (!window.confirm(`Delete ${label}?`)) return;
    onDeletePrompt?.(prompt.id);
  };

  const handleClearAllPrompts = () => {
    const count = savedPrompts.length;
    if (!count) return;
    if (!window.confirm(`Clear all ${count} saved prompt${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    onClearAllPrompts?.();
  };

  return (
    <motion.div
      key="library"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={transition}
      className="space-y-6"
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-amber-300 font-bold">Saved Prompts</div>
            {savedPrompts.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllPrompts}
                className="text-[10px] font-medium text-slate-500 hover:text-red-400 transition-colors"
                title="Clear all saved prompts"
                aria-label="Clear all saved prompts"
              >
                Clear All
              </button>
            )}
          </div>
          {savedPrompts.length === 0 && (
            <EmptyState title="No prompts saved" subtitle="Save prompts from Agent Factory." />
          )}
          <div className="space-y-3">
            {savedPrompts.map((prompt) => (
              <div key={prompt.id} className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/60">
                <div className="text-sm text-slate-200 truncate">{prompt.title}</div>
                <div className="text-xs text-slate-500 mt-1 truncate">{prompt.query}</div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => onUsePrompt?.(prompt.query)}
                    className="text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePrompt(prompt)}
                    className="text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-bold mb-4">Agent Templates</div>
          {agents.length === 0 && (
            <EmptyState title="No agent templates" subtitle="Add templates in your reference repos." />
          )}
          <div className="space-y-3">
            {agents.map((agent) => (
              <div key={agent.id} className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/60">
                <div className="text-sm text-slate-200">{agent.name}</div>
                <div className="text-xs text-slate-500 mt-1">{agent.description}</div>
                {agent.keywords?.length > 0 && (
                  <div className="text-[10px] text-slate-500 mt-2">
                    {agent.keywords.slice(0, 4).join(' • ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-emerald-300 font-bold mb-4">Tools & Utilities</div>
          {tools.length === 0 && (
            <EmptyState title="No tools detected" subtitle="Add tools in the reference repos tools folder." />
          )}
          <div className="space-y-3">
            {tools.map((tool) => (
              <div key={tool.id || tool.name} className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/60">
                <div className="text-sm text-slate-200">{tool.name}</div>
                <div className="text-xs text-slate-500 mt-1">{tool.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
