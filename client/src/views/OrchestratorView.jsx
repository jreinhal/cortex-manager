import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, CheckCircle2, ChevronRight, ChevronDown,
  Check, Clock, History, Star, Trash2
} from 'lucide-react'
import { cn } from '../lib/utils'
import { SPRING_SMOOTH, SPRING_FAST, FORMAT_OPTIONS, DEFAULT_FORMAT } from '../lib/constants'
import { SpawnTimeline } from '../components/SpawnTimeline'

const buildSpawnStepDefs = ({ onlineSkills, trainingMode }) => {
  const steps = [
    {
      key: 'init',
      label: 'Create agent profile',
      detail: 'Normalize goal and initialize the agent run.',
      type: 'init'
    },
    {
      key: 'analyze',
      label: 'Analyze goal keywords',
      detail: 'Extract intent, complexity, and routing signals.',
      type: 'search'
    },
    {
      key: 'route',
      label: 'Select best agent',
      detail: 'Score agents against the goal and pick the top match.',
      type: 'route'
    },
    {
      key: 'retrieve',
      label: 'Search knowledge base',
      detail: 'Hybrid retrieval + RRF fusion across knowledge/skills/tools.',
      type: 'retrieve'
    }
  ];

  if (onlineSkills) {
    steps.push(
      {
        key: 'external-search',
        label: 'Search online skills',
        detail: 'Query approved providers for matching skills.',
        type: 'external'
      },
      {
        key: 'external-persist',
        label: 'Persist external skills',
        detail: 'Store verified SKILL.md bundles in the skills repo.',
        type: 'external'
      }
    );

    if (trainingMode && trainingMode !== 'off') {
      steps.push({
        key: 'external-train',
        label: 'Train agent knowledge',
        detail: trainingMode === 'background'
          ? 'Queue vector index rebuild in the background.'
          : 'Rebuild the index with newly installed skills.',
        type: 'training'
      });
    }
  }

  steps.push({
    key: 'compose',
    label: 'Generate flight plan',
    detail: 'Assemble directive, required reading, and decision matrix.',
    type: 'synthesize'
  });

  return steps;
};

export function OrchestratorView({
  onSpawn,
  loading,
  result,
  sessions,
  savedPrompts,
  onSavePrompt,
  onDeletePrompt,
  onClearAllPrompts,
  onUsePrompt,
  onDirtyChange,
  prefillGoal,
  onPrefillConsumed,
  queueEnabled,
  externalSkillsConfig,
  latestRun
}) {
  const [goal, setGoal] = useState('');
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [trainingMenuOpen, setTrainingMenuOpen] = useState(false);
  const [spawnSteps, setSpawnSteps] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [runInBackground, setRunInBackground] = useState(false);
  const [onlineSkills, setOnlineSkills] = useState(false);
  const [onlineSkillsTrainingMode, setOnlineSkillsTrainingMode] = useState('blocking');
  const spawnTimeoutsRef = useRef([]);
  const formatMenuRef = useRef(null);
  const formatButtonRef = useRef(null);
  const trainingMenuRef = useRef(null);
  const trainingButtonRef = useRef(null);

  const externalSkillsEnabled = externalSkillsConfig?.enabled === true;
  const externalSkillsAllowRemote = externalSkillsConfig?.allowRemote === true;
  const showOnlineSkillsToggle = externalSkillsEnabled || import.meta.env.DEV;

  const currentFormat = FORMAT_OPTIONS.find((option) => option.value === format) || FORMAT_OPTIONS[0];
  const trainingOptions = [
    { value: 'blocking', label: 'Blocking' },
    { value: 'background', label: 'Background' }
  ];
  const currentTraining = trainingOptions.find((option) => option.value === onlineSkillsTrainingMode) || trainingOptions[0];
  const latestExternalSkills = latestRun?.decisionMatrix?.resourceSelection?.externalSkills || null;
  const externalSkillsInstalled = Array.isArray(latestExternalSkills?.installed)
    ? latestExternalSkills.installed
        .filter((item) => item && (item.installed || item.alreadyInstalled) && item.slug)
        .map((item) => (item.providerId ? `${item.providerId}:${item.slug}` : item.slug))
    : [];
  const externalSkillsStatus = (() => {
    if (!latestExternalSkills) return null;
    if (latestExternalSkills.error) return { tone: 'error', label: `Error: ${latestExternalSkills.error}` };
    if (latestExternalSkills.skippedReason) {
      return { tone: 'warn', label: `Skipped (${latestExternalSkills.skippedReason.replace(/_/g, ' ')})` };
    }
    if (latestExternalSkills.enabled !== true || latestExternalSkills.mode === 'off') {
      return { tone: 'muted', label: 'Disabled' };
    }
    if (latestExternalSkills.used) return { tone: 'success', label: `Used (${latestExternalSkills.mode})` };
    return { tone: 'info', label: `Enabled (${latestExternalSkills.mode})` };
  })();
  const externalSkillsSummary = externalSkillsInstalled.length > 0
    ? `Installed: ${externalSkillsInstalled.slice(0, 3).join(', ')}${externalSkillsInstalled.length > 3 ? ` +${externalSkillsInstalled.length - 3}` : ''}`
    : null;
  const formatExternalSkillsReason = (reason) => (
    reason ? reason.replace(/_/g, ' ') : ''
  );
  const updateExternalSkillSteps = useCallback((meta) => {
    if (!meta) return;
    const installedItems = Array.isArray(meta.installed) ? meta.installed : [];
    const newCount = installedItems.filter((item) => item?.installed).length;
    const alreadyCount = installedItems.filter((item) => item?.alreadyInstalled).length;
    const totalCount = newCount + alreadyCount;
    const pluralize = (count) => (count === 1 ? '' : 's');
    const reason = meta.skippedReason ? formatExternalSkillsReason(meta.skippedReason) : '';

    let searchDetail = 'Query approved providers for matching skills.';
    if (meta.error) {
      searchDetail = `Search failed: ${meta.error}`;
    } else if (meta.skippedReason) {
      searchDetail = `Skipped (${reason})`;
    } else if (meta.used && totalCount === 0) {
      searchDetail = 'No matching skills found.';
    } else if (meta.used && totalCount > 0) {
      searchDetail = `Matched ${totalCount} skill${pluralize(totalCount)}.`;
    }

    let persistDetail = 'Store verified SKILL.md bundles in the skills repo.';
    if (meta.error) {
      persistDetail = 'Persist skipped due to search error.';
    } else if (meta.skippedReason) {
      persistDetail = `Skipped (${reason})`;
    } else if (newCount > 0) {
      persistDetail = `Persisted ${newCount} new skill${pluralize(newCount)}.`;
    } else if (alreadyCount > 0) {
      persistDetail = `No new skills to persist (${alreadyCount} already installed).`;
    } else {
      persistDetail = 'No new skills to persist.';
    }

    const trainingMeta = meta.training || {};
    const trainingMode = trainingMeta.mode || onlineSkillsTrainingMode;
    let trainingDetail = trainingMode === 'background'
      ? 'Queue vector index rebuild in the background.'
      : 'Rebuild the index with newly installed skills.';
    if (trainingMeta.error) {
      trainingDetail = `Training failed: ${trainingMeta.error}`;
    } else if (trainingMeta.performed) {
      if (trainingMeta.background) {
        trainingDetail = 'Background index rebuild launched.';
      } else if (trainingMeta.blocking) {
        trainingDetail = 'Index rebuild completed before response.';
      } else {
        trainingDetail = 'Index rebuild completed.';
      }
    } else if (trainingMode === 'off') {
      trainingDetail = 'Training disabled for this run.';
    } else if (meta.skippedReason) {
      trainingDetail = `Skipped (${reason})`;
    } else if (newCount === 0 && !trainingMeta.performed) {
      trainingDetail = 'No new skills to train.';
    }

    setSpawnSteps((prev) => prev.map((step) => {
      if (step.key === 'external-search') {
        return { ...step, detail: searchDetail };
      }
      if (step.key === 'external-persist') {
        return { ...step, detail: persistDetail };
      }
      if (step.key === 'external-train') {
        return { ...step, detail: trainingDetail };
      }
      return step;
    }));
  }, [onlineSkillsTrainingMode]);

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(Boolean(goal));
    }
  }, [goal, onDirtyChange]);
  useEffect(() => {
    if (!latestExternalSkills || spawnSteps.length === 0) return;
    updateExternalSkillSteps(latestExternalSkills);
  }, [latestExternalSkills, spawnSteps.length, updateExternalSkillSteps]);

  useEffect(() => {
    if (!prefillGoal) return;
    setGoal(prefillGoal);
    if (onPrefillConsumed) {
      onPrefillConsumed();
    }
  }, [prefillGoal, onPrefillConsumed]);

  useEffect(() => {
    if (!formatMenuOpen && !trainingMenuOpen) return;

    const handleClick = (event) => {
      if (formatMenuOpen && formatMenuRef.current && !formatMenuRef.current.contains(event.target)) {
        setFormatMenuOpen(false);
      }
      if (trainingMenuOpen && trainingMenuRef.current && !trainingMenuRef.current.contains(event.target)) {
        setTrainingMenuOpen(false);
      }
    };

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        if (formatMenuOpen) {
          setFormatMenuOpen(false);
          formatButtonRef.current?.focus();
        }
        if (trainingMenuOpen) {
          setTrainingMenuOpen(false);
          trainingButtonRef.current?.focus();
        }
      }
    };

    window.addEventListener('mousedown', handleClick);
    window.addEventListener('touchstart', handleClick);
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('touchstart', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [formatMenuOpen, trainingMenuOpen]);

  const clearSpawnTimeouts = useCallback(() => {
    spawnTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    spawnTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearSpawnTimeouts();
    };
  }, [clearSpawnTimeouts]);

  const handleSavePrompt = async () => {
    if (!goal) return;
    const saved = await onSavePrompt?.(promptTitle || 'Untitled', goal);
    if (saved) {
      setShowSaveModal(false);
      setPromptTitle('');
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  const handleDeletePrompt = async (id) => {
    const target = savedPrompts.find((prompt) => prompt.id === id);
    const label = target?.title ? `"${target.title}"` : 'this prompt';
    if (!window.confirm(`Delete ${label}?`)) {
      return;
    }

    await onDeletePrompt?.(id);
  };

  const handleClearAllPrompts = async () => {
    const count = savedPrompts.length;
    if (!window.confirm(`Clear all ${count} saved prompt${count !== 1 ? 's' : ''}? This cannot be undone.`)) {
      return;
    }
    await onClearAllPrompts?.();
  };

  const handleUsePrompt = (query) => {
    setGoal(query);
    if (onUsePrompt) {
      onUsePrompt(query);
    }
  };

  const handleSpawn = async () => {
    if (!goal) return;

    // Initialize timeline
    clearSpawnTimeouts();
    const startTime = Date.now();
    const stepDefs = buildSpawnStepDefs({
      onlineSkills,
      trainingMode: onlineSkillsTrainingMode
    });
    setSpawnSteps(
      stepDefs.map((step, index) => ({
        ...step,
        done: false,
        error: false,
        startedAt: index === 0 ? startTime : null,
        durationMs: null
      }))
    );

    // Simulate progress (actual progress comes from backend)
    const advanceStep = (nextIndex) => {
      setSpawnSteps((prev) =>
        prev.map((step, idx) => {
          if (idx === nextIndex - 1 && !step.done) {
            const endTime = Date.now();
            return {
              ...step,
              done: true,
              durationMs: step.startedAt ? endTime - step.startedAt : step.durationMs
            };
          }
          if (idx === nextIndex && !step.startedAt) {
            return {
              ...step,
              startedAt: Date.now()
            };
          }
          return step;
        })
      );
    };

    Array.from({ length: Math.max(0, stepDefs.length - 1) }, (_, idx) => (idx + 1) * 300)
      .forEach((delay, idx) => {
        const timeoutId = setTimeout(() => advanceStep(idx + 1), delay);
        spawnTimeoutsRef.current.push(timeoutId);
      });

    const externalSkillsRequest = showOnlineSkillsToggle
      ? { online: onlineSkills, trainingMode: onlineSkillsTrainingMode }
      : null;

    await onSpawn(goal, format, runInBackground, externalSkillsRequest);

    // Mark all done
    clearSpawnTimeouts();
    setSpawnSteps((prev) =>
      prev.map((step) => {
        if (step.done) {
          return step;
        }
        const endTime = Date.now();
        return {
          ...step,
          done: true,
          durationMs: step.startedAt ? endTime - step.startedAt : 0
        };
      })
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      /* Fallback for non-secure contexts */
      const textarea = document.createElement('textarea');
      textarea.value = result;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReuseSession = (sessionGoal) => {
    setGoal(sessionGoal);
  };

  return (
    <motion.div
      key="agents"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={SPRING_SMOOTH}
      className="w-full space-y-2 density-stack"
    >
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">Agent Factory</h1>
        <p className="text-slate-400 text-sm">Spawn specialized autonomous agents using natural language.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
          {/* Input Area */}
        <div className="lg:col-span-8 flex flex-col gap-2 self-start">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <label htmlFor="goal-input" className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.22em]">Describe the outcome</label>
            <div className="flex items-center gap-2" ref={formatMenuRef}>
              <label htmlFor="format-select" className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.22em]">Format</label>
              <div className="relative z-40">
                <button
                  id="format-select"
                  name="format"
                  data-testid="format-select"
                  type="button"
                  ref={formatButtonRef}
                  aria-haspopup="listbox"
                  aria-expanded={formatMenuOpen}
                  onClick={() => setFormatMenuOpen((open) => !open)}
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-ui",
                    "bg-white/5 text-slate-200 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                    "hover:border-cyan-400/50 hover:text-white focus-visible:outline-none",
                    formatMenuOpen ? "border-cyan-400/60" : ""
                  )}
                >
                  <span className="relative flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/90 shadow-[0_0_8px_rgba(34,211,238,0.55)]"></span>
                    {currentFormat.label}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "transition-transform duration-200 text-slate-400 group-hover:text-cyan-200",
                      formatMenuOpen ? "rotate-180 text-cyan-200" : ""
                    )}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence>
                  {formatMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={SPRING_FAST}
                      className="absolute right-0 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-950/90 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.8)] backdrop-blur-xl p-1.5 z-50"
                      role="listbox"
                      aria-label="Format"
                    >
                      <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"></div>
                      {FORMAT_OPTIONS.map((option, index) => (
                        <motion.button
                          key={option.value}
                          type="button"
                          role="option"
                          data-testid={`format-option-${option.value}`}
                          aria-selected={format === option.value}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...SPRING_FAST, delay: index * 0.03 }}
                          onClick={() => {
                            setFormat(option.value);
                            setFormatMenuOpen(false);
                            formatButtonRef.current?.focus();
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-ui flex items-center gap-2",
                            format === option.value
                              ? "bg-cyan-400/10 text-cyan-200"
                              : "text-slate-200 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.35)]", option.accent)}></span>
                          <span>{option.label}</span>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <textarea
                id="goal-input"
                name="goal"
                data-testid="goal-input"
                rows={2}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Example: Audit the dashboard UI for clarity, accessibility, and visual hierarchy…"
                autoComplete="off"
                className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-2.5 text-[13px] text-slate-100 focus-visible:outline-none focus-visible:border-cyan-400/50 transition-ui h-[72px] max-h-[96px] resize-none leading-normal placeholder:text-slate-500 font-medium"
              />

              {showOnlineSkillsToggle && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={onlineSkills}
                        disabled={externalSkillsEnabled && !externalSkillsAllowRemote && !import.meta.env.DEV}
                        onChange={(e) => setOnlineSkills(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30 disabled:opacity-50"
                      />
                      Search online for skills
                    </label>
                    {externalSkillsEnabled && !externalSkillsAllowRemote && !import.meta.env.DEV && (
                      <div className="text-[10px] text-slate-500">
                        Remote providers are disabled in Settings.
                      </div>
                    )}
                    {!externalSkillsEnabled && import.meta.env.DEV && (
                      <div className="text-[10px] text-slate-500">
                        Dev mode: requires server env `CORTEX_DEV_MODE=1` if remote is disabled in Settings.
                      </div>
                    )}
                  </div>

                  {onlineSkills && (
                    <div className="flex items-center gap-2 text-xs text-slate-400" ref={trainingMenuRef}>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.22em]">Training</span>
                      <div className="relative z-40">
                        <button
                          type="button"
                          ref={trainingButtonRef}
                          aria-haspopup="listbox"
                          aria-expanded={trainingMenuOpen}
                          onClick={() => setTrainingMenuOpen((open) => !open)}
                          className={cn(
                            "group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-ui",
                            "bg-white/5 text-slate-200 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                            "hover:border-cyan-400/50 hover:text-white focus-visible:outline-none",
                            trainingMenuOpen ? "border-cyan-400/60" : ""
                          )}
                        >
                          <span className="relative flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/90 shadow-[0_0_8px_rgba(34,211,238,0.55)]"></span>
                            {currentTraining.label}
                          </span>
                          <ChevronDown
                            size={14}
                            className={cn(
                              "transition-transform duration-200 text-slate-400 group-hover:text-cyan-200",
                              trainingMenuOpen ? "rotate-180 text-cyan-200" : ""
                            )}
                            aria-hidden="true"
                          />
                        </button>

                        <AnimatePresence>
                          {trainingMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={SPRING_FAST}
                              className="absolute right-0 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-950/90 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.8)] backdrop-blur-xl p-1.5 z-50"
                              role="listbox"
                              aria-label="Training"
                            >
                              <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"></div>
                              {trainingOptions.map((option, index) => (
                                <motion.button
                                  key={option.value}
                                  type="button"
                                  role="option"
                                  aria-selected={onlineSkillsTrainingMode === option.value}
                                  initial={{ opacity: 0, x: -4 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ ...SPRING_FAST, delay: index * 0.03 }}
                                  onClick={() => {
                                    setOnlineSkillsTrainingMode(option.value);
                                    setTrainingMenuOpen(false);
                                    trainingButtonRef.current?.focus();
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-ui flex items-center gap-2",
                                    onlineSkillsTrainingMode === option.value
                                      ? "bg-cyan-400/10 text-cyan-200"
                                      : "text-slate-200 hover:bg-white/5 hover:text-white"
                                  )}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/90 shadow-[0_0_6px_rgba(34,211,238,0.55)]"></span>
                                  <span>{option.label}</span>
                                </motion.button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-0">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  disabled={!goal}
                  data-testid="save-prompt-btn"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-semibold uppercase tracking-[0.2em] transition-ui border",
                    justSaved
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      : "bg-white/5 text-slate-300 border-white/10 hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-40"
                  )}
                  title="Save Prompt"
                >
                  <Star size={16} fill={justSaved ? "currentColor" : "none"} aria-hidden="true" />
                  Save Prompt
                </button>
                <button
                  type="button"
                  onClick={handleSpawn}
                  disabled={loading || !goal}
                  data-testid="generate-flight-plan"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-cyan-500/40 bg-cyan-500/20 text-slate-100 uppercase tracking-[0.2em] text-[11px] font-semibold transition-ui hover:bg-cyan-500/30 hover:text-white disabled:opacity-50"
                  title="Generate Flight Plan"
                >
                  {loading ? <RefreshCw size={18} className="animate-spin text-white" aria-hidden="true" /> : <ChevronRight size={18} className="text-white" aria-hidden="true" />}
                  Generate Flight Plan
                </button>
              </div>
              {queueEnabled && (
                <label className="flex items-center gap-2 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={runInBackground}
                    onChange={(e) => setRunInBackground(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                  />
                  Run in background queue
                </label>
              )}
            </div>

            {/* Status Timeline */}
            {spawnSteps.length > 0 && (
              <div className="mt-3 p-4 bg-white/[0.04] rounded-2xl border border-white/[0.08]">
                <SpawnTimeline steps={spawnSteps} />
              </div>
            )}
            {externalSkillsStatus && (
              <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="uppercase tracking-[0.22em] text-[10px] text-slate-500 font-semibold">
                    Last run external skills
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      externalSkillsStatus.tone === 'error' && "text-red-300",
                      externalSkillsStatus.tone === 'warn' && "text-amber-300",
                      externalSkillsStatus.tone === 'success' && "text-emerald-300",
                      externalSkillsStatus.tone === 'info' && "text-slate-200",
                      externalSkillsStatus.tone === 'muted' && "text-slate-500"
                    )}
                  >
                    {externalSkillsStatus.label}
                  </span>
                  {externalSkillsSummary && (
                    <span className="text-slate-500">{externalSkillsSummary}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Result Panel */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-3xl border border-purple-500/30 overflow-hidden shadow-2xl shadow-purple-900/20"
            >
              <div className="bg-purple-900/20 px-6 py-4 flex justify-between items-center border-b border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-green-500/20 rounded-full text-green-400"><CheckCircle2 size={16} aria-hidden="true" /></div>
                  <span className="font-semibold text-purple-200">Flight Plan Ready</span>
                </div>
                <button
                  onClick={handleCopy}
                  data-testid="copy-flight-plan"
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg transition-ui font-medium border flex items-center gap-2",
                    copied
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                  )}
                >
                  {copied ? <><Check size={14} aria-hidden="true" /> Copied!</> : 'Copy to Clipboard'}
                </button>
              </div>
              <div className="p-0 overflow-x-auto bg-slate-950/90 max-h-[500px] overflow-y-auto">
                <pre className="p-6 text-sm font-mono text-slate-300 whitespace-pre-wrap leading-loose" data-testid="flight-plan-output">{result}</pre>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {(savedPrompts.length > 0 || (sessions && sessions.length > 0)) && (
            <div className="glass-panel p-5 rounded-3xl space-y-6" data-testid="quick-access">
              <div className="flex items-center gap-2">
                <History size={16} className="text-cyan-400" aria-hidden="true" />
                <h3 className="font-bold text-slate-200">Quick Access</h3>
              </div>

              {savedPrompts.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-inner" data-testid="saved-prompts-section">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-amber-300 uppercase tracking-[0.3em]">Saved Prompts</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleClearAllPrompts}
                        className="text-[10px] font-medium text-slate-500 hover:text-red-400 transition-ui"
                        title="Clear all saved prompts"
                        aria-label="Clear all saved prompts"
                      >
                        Clear All
                      </button>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-900/70 px-2 py-0.5 rounded-full border border-slate-800">
                        {savedPrompts.length} total
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {savedPrompts.slice(0, 4).map((prompt) => (
                      <div
                        key={prompt.id}
                        className="group flex items-center gap-2 p-3 bg-slate-900/50 hover:bg-slate-800/60 rounded-xl transition-ui min-w-0"
                      >
                        <button
                          onClick={() => handleUsePrompt(prompt.query)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="text-sm font-medium text-slate-200 group-hover:text-white truncate">
                            {prompt.title}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {prompt.query.substring(0, 60)}{prompt.query.length > 60 ? '…' : ''}
                          </div>
                        </button>
                        <button
                          onClick={() => handleDeletePrompt(prompt.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-ui"
                          title="Delete"
                          aria-label="Delete saved prompt"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sessions && sessions.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-inner" data-testid="recent-sessions-section">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-[0.3em]">Recent Sessions</div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900/70 px-2 py-0.5 rounded-full border border-slate-800">
                      {sessions.length} total
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {sessions.slice(0, 4).map((session) => (
                      <button
                        key={session.id}
                        onClick={() => handleReuseSession(session.goal)}
                        className="w-full text-left bg-slate-900/50 hover:bg-slate-800/60 rounded-xl p-3 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-slate-200 text-sm truncate group-hover:text-cyan-400">
                              {session.goal}
                            </div>
                            <div className="text-slate-500 text-xs mt-1 flex items-center gap-2">
                              <Clock size={12} aria-hidden="true" />
                              {new Date(session.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-600 group-hover:text-cyan-400 mt-1" aria-hidden="true" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Prompt Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-prompt-title"
              data-testid="save-prompt-modal"
              className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6 shadow-2xl overscroll-contain"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-xl">
                  <Star size={20} className="text-amber-400" aria-hidden="true" />
                </div>
                <h3 id="save-prompt-title" className="text-lg font-bold text-white">Save Prompt</h3>
              </div>

              <p className="text-slate-400 text-sm mb-4">
                Give this prompt a name so you can easily find it later.
              </p>

              <label htmlFor="prompt-title" className="sr-only">Prompt name</label>
              <input
                id="prompt-title"
                name="promptTitle"
                type="text"
                data-testid="prompt-title-input"
                value={promptTitle}
                onChange={(e) => setPromptTitle(e.target.value)}
                placeholder="e.g., UI Test, Security Audit…"
                autoComplete="off"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus-visible:outline-none focus-visible:border-amber-500/50 mb-3"
              />

              <div className="p-3 bg-slate-800/50 rounded-xl mb-6">
                <p className="text-xs text-slate-500 mb-1">Prompt:</p>
                <p className="text-sm text-slate-300 line-clamp-2">{goal}</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveModal(false);
                    setPromptTitle('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-ui"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePrompt}
                  data-testid="confirm-save-prompt"
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-ui flex items-center justify-center gap-2"
                >
                  <Star size={16} aria-hidden="true" />
                  Save Prompt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
