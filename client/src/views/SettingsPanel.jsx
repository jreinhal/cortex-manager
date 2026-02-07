import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Check, RefreshCw } from 'lucide-react';

export function SettingsPanel({
  config,
  onSave,
  uiTheme = 'system',
  onThemeChange,
  authStatus,
  authUser,
  users = [],
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  vectorStatus,
  onRebuildVector,
  workspaces = [],
  activeWorkspace,
  onCreateWorkspace,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onSetDefaultWorkspace,
  apiFetch,
  cn,
  defaultRbacRoles,
  manualUrl,
  transition
}) {
  // config is the full API response: { config: { reposRoot, ... }, system, isFirstRun }
  const [reposRoot, setReposRoot] = useState(config?.config?.reposRoot || '');
  const [llmEndpoint, setLlmEndpoint] = useState(config?.config?.llm?.endpoint || '');
  const [llmFallbackEndpoint, setLlmFallbackEndpoint] = useState(config?.config?.llm?.fallbackEndpoint || '');
  const [llmAllowRemote, setLlmAllowRemote] = useState(config?.config?.llm?.allowRemote ?? false);
  const [uiDensity, setUiDensity] = useState(config?.config?.ui?.density || 'comfortable');
  const [authEnabled, setAuthEnabled] = useState(config?.config?.auth?.enabled ?? false);
  const [authTtl, setAuthTtl] = useState(config?.config?.auth?.tokenTtlHours ?? 12);
  const [authBootstrapAllowed, setAuthBootstrapAllowed] = useState(config?.config?.auth?.bootstrapAllowed ?? true);
  const [rbacEnabled, setRbacEnabled] = useState(config?.config?.auth?.rbac?.enabled ?? true);
  const [rbacRolesJson, setRbacRolesJson] = useState(() => (
    JSON.stringify(config?.config?.auth?.rbac?.roles || defaultRbacRoles, null, 2)
  ));
  const [rbacError, setRbacError] = useState('');
  const [ssoEnabled, setSsoEnabled] = useState(config?.config?.auth?.sso?.enabled ?? false);
  const [ssoHeaderUser, setSsoHeaderUser] = useState(config?.config?.auth?.sso?.headerUser || 'x-cortex-user');
  const [ssoHeaderRole, setSsoHeaderRole] = useState(config?.config?.auth?.sso?.headerRole || 'x-cortex-role');
  const [ssoHeaderWorkspace, setSsoHeaderWorkspace] = useState(config?.config?.auth?.sso?.headerWorkspace || 'x-cortex-workspace');
  const [ssoAutoProvision, setSsoAutoProvision] = useState(config?.config?.auth?.sso?.autoProvision ?? true);
  const [scimEnabled, setScimEnabled] = useState(config?.config?.auth?.scim?.enabled ?? false);
  const [scimToken, setScimToken] = useState('');
  const [queueEnabled, setQueueEnabled] = useState(config?.config?.queue?.enabled ?? true);
  const [queueConcurrency, setQueueConcurrency] = useState(config?.config?.queue?.concurrency ?? 2);
  const [queueMaxJobs, setQueueMaxJobs] = useState(config?.config?.queue?.maxJobs ?? 200);
  const [queueRetainCompleted, setQueueRetainCompleted] = useState(config?.config?.queue?.retainCompleted ?? 120);
  const [workerMode, setWorkerMode] = useState(config?.config?.queue?.workers?.mode || 'inline');
  const [workerMin, setWorkerMin] = useState(config?.config?.queue?.workers?.min ?? 1);
  const [workerMax, setWorkerMax] = useState(config?.config?.queue?.workers?.max ?? 3);
  const [workerScaleThreshold, setWorkerScaleThreshold] = useState(config?.config?.queue?.workers?.scaleUpThreshold ?? 3);
  const [workerScaleDownIdle, setWorkerScaleDownIdle] = useState(config?.config?.queue?.workers?.scaleDownIdleMs ?? 60000);
  const [workerPollInterval, setWorkerPollInterval] = useState(config?.config?.queue?.workers?.pollIntervalMs ?? 1500);
  const [workerHeartbeatMs, setWorkerHeartbeatMs] = useState(config?.config?.queue?.workers?.heartbeatMs ?? 4000);
  const [workerJobTimeoutMs, setWorkerJobTimeoutMs] = useState(config?.config?.queue?.workers?.jobTimeoutMs ?? 1200000);
  const [vectorEnabled, setVectorEnabled] = useState(config?.config?.vectorIndex?.enabled ?? true);
  const [vectorChunkSize, setVectorChunkSize] = useState(config?.config?.vectorIndex?.chunkSize ?? 900);
  const [vectorChunkOverlap, setVectorChunkOverlap] = useState(config?.config?.vectorIndex?.chunkOverlap ?? 120);
  const [vectorMaxFiles, setVectorMaxFiles] = useState(config?.config?.vectorIndex?.maxFiles ?? 2000);
  const [vectorMaxChars, setVectorMaxChars] = useState(config?.config?.vectorIndex?.maxCharsPerFile ?? 20000);
  const [vectorAutoRebuild, setVectorAutoRebuild] = useState(config?.config?.vectorIndex?.autoRebuild ?? false);
  const [vectorMinScore, setVectorMinScore] = useState(config?.config?.vectorIndex?.minScore ?? 0.08);
  const [vectorMode, setVectorMode] = useState(config?.config?.vectorIndex?.mode || 'hash');
  const [embeddingEnabled, setEmbeddingEnabled] = useState(config?.config?.vectorIndex?.embedding?.enabled ?? false);
  const [embeddingEndpoint, setEmbeddingEndpoint] = useState(config?.config?.vectorIndex?.embedding?.endpoint || '');
  const [embeddingModel, setEmbeddingModel] = useState(config?.config?.vectorIndex?.embedding?.model || '');
  const [embeddingDimensions, setEmbeddingDimensions] = useState(config?.config?.vectorIndex?.embedding?.dimensions ?? 768);
  const [embeddingBatchSize, setEmbeddingBatchSize] = useState(config?.config?.vectorIndex?.embedding?.batchSize ?? 16);
  const [embeddingTimeoutMs, setEmbeddingTimeoutMs] = useState(config?.config?.vectorIndex?.embedding?.timeoutMs ?? 12000);
  const [embeddingAllowRemote, setEmbeddingAllowRemote] = useState(config?.config?.vectorIndex?.embedding?.allowRemote ?? false);
  const [externalSkillsEnabled, setExternalSkillsEnabled] = useState(config?.config?.externalSkills?.enabled ?? false);
  const [externalSkillsAllowRemote, setExternalSkillsAllowRemote] = useState(config?.config?.externalSkills?.allowRemote ?? false);
  const [externalSkillsMode, setExternalSkillsMode] = useState(config?.config?.externalSkills?.mode || 'off');
  const [externalSkillsMaxSkills, setExternalSkillsMaxSkills] = useState(config?.config?.externalSkills?.maxSkills ?? 4);
  const [externalSkillsInstallConcurrency, setExternalSkillsInstallConcurrency] = useState(config?.config?.externalSkills?.installConcurrency ?? 2);
  const [externalSkillsTrainingMode, setExternalSkillsTrainingMode] = useState(config?.config?.externalSkills?.training?.mode || 'blocking');
  const [externalSkillsQueryAssistMode, setExternalSkillsQueryAssistMode] = useState(config?.config?.externalSkills?.queryAssist?.mode || 'fallback');
  const [externalSkillsProvidersJson, setExternalSkillsProvidersJson] = useState(() => (
    JSON.stringify(config?.config?.externalSkills?.providers || [], null, 2)
  ));
  const [externalSkillsError, setExternalSkillsError] = useState('');
  const [externalSkillsUpdates, setExternalSkillsUpdates] = useState(null);
  const [externalSkillsUpdatesLoading, setExternalSkillsUpdatesLoading] = useState(false);
  const [alertCost, setAlertCost] = useState(config?.config?.observability?.alertCost ?? 5);
  const [alertTokens, setAlertTokens] = useState(config?.config?.observability?.alertTokens ?? 50000);
  const [alertDuration, setAlertDuration] = useState(config?.config?.observability?.alertDurationMs ?? 30000);
  const [llmTest, setLlmTest] = useState({ status: 'idle', results: [] });
  const [loading, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const reposRootInputRef = useRef(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [newUserWorkspace, setNewUserWorkspace] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceReposRoot, setWorkspaceReposRoot] = useState('');
  const [workspaceOutputDir, setWorkspaceOutputDir] = useState('');
  const [workspaceCreateStructure, setWorkspaceCreateStructure] = useState(true);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState(null);
  const defaultWorkspaceId = config?.config?.workspaces?.defaultId;
  const resolvedManualUrl = manualUrl || '/manual/index.html';

  const handleSave = async () => {
    // Guard against empty submissions
    if (!reposRoot || !reposRoot.trim()) {
      setError('Repository root path cannot be empty');
      reposRootInputRef.current?.focus();
      return;
    }
    setError('');
    setExternalSkillsError('');
    setSaving(true);
    try {
      let parsedRbacRoles = config?.config?.auth?.rbac?.roles || defaultRbacRoles;
      if (rbacRolesJson && rbacRolesJson.trim().length > 0) {
        try {
          parsedRbacRoles = JSON.parse(rbacRolesJson);
          setRbacError('');
        } catch (e) {
          setRbacError('RBAC policy must be valid JSON.');
          setSaving(false);
          return;
        }
      }

      const baseConfig = config?.config?.llm || {};
      const llm = {
        ...baseConfig,
        endpoint: llmEndpoint.trim(),
        fallbackEndpoint: llmFallbackEndpoint.trim() || null,
        allowRemote: llmAllowRemote
      };
      const ui = {
        ...(config?.config?.ui || {}),
        density: uiDensity,
        theme: uiTheme || 'system'
      };
      const authConfig = {
        ...(config?.config?.auth || {}),
        enabled: authEnabled,
        tokenTtlHours: Number(authTtl) || 12,
        bootstrapAllowed: authBootstrapAllowed,
        rbac: {
          ...(config?.config?.auth?.rbac || {}),
          enabled: rbacEnabled,
          roles: parsedRbacRoles
        },
        sso: {
          ...(config?.config?.auth?.sso || {}),
          enabled: ssoEnabled,
          headerUser: ssoHeaderUser.trim() || 'x-cortex-user',
          headerRole: ssoHeaderRole.trim() || 'x-cortex-role',
          headerWorkspace: ssoHeaderWorkspace.trim() || 'x-cortex-workspace',
          autoProvision: ssoAutoProvision
        },
        scim: {
          ...(config?.config?.auth?.scim || {}),
          enabled: scimEnabled
        }
      };
      if (scimToken.trim()) {
        authConfig.scim.token = scimToken.trim();
      }
      const queue = {
        ...(config?.config?.queue || {}),
        enabled: queueEnabled,
        concurrency: Number(queueConcurrency) || 1,
        maxJobs: Number(queueMaxJobs) || 200,
        retainCompleted: Number(queueRetainCompleted) || 120,
        workers: {
          ...(config?.config?.queue?.workers || {}),
          mode: workerMode,
          min: Number(workerMin) || 1,
          max: Number(workerMax) || 1,
          scaleUpThreshold: Number(workerScaleThreshold) || 1,
          scaleDownIdleMs: Number(workerScaleDownIdle) || 60000,
          pollIntervalMs: Number(workerPollInterval) || 1500,
          heartbeatMs: Number(workerHeartbeatMs) || 4000,
          jobTimeoutMs: Number(workerJobTimeoutMs) || 1200000
        }
      };
      const vectorIndex = {
        ...(config?.config?.vectorIndex || {}),
        enabled: vectorEnabled,
        chunkSize: Number(vectorChunkSize) || 900,
        chunkOverlap: Number(vectorChunkOverlap) || 120,
        maxFiles: Number(vectorMaxFiles) || 2000,
        maxCharsPerFile: Number(vectorMaxChars) || 20000,
        autoRebuild: vectorAutoRebuild,
        minScore: Number(vectorMinScore) || 0.08,
        mode: vectorMode,
        embedding: {
          ...(config?.config?.vectorIndex?.embedding || {}),
          enabled: vectorMode === 'embedding' ? true : embeddingEnabled,
          endpoint: embeddingEndpoint.trim(),
          model: embeddingModel.trim(),
          dimensions: Number(embeddingDimensions) || 768,
          batchSize: Number(embeddingBatchSize) || 16,
          timeoutMs: Number(embeddingTimeoutMs) || 12000,
          allowRemote: embeddingAllowRemote
        }
      };
      const observability = {
        ...(config?.config?.observability || {}),
        alertCost: Number(alertCost) || 0,
        alertTokens: Number(alertTokens) || 0,
        alertDurationMs: Number(alertDuration) || 0
      };

      let parsedExternalProviders = config?.config?.externalSkills?.providers || [];
      if (externalSkillsProvidersJson && externalSkillsProvidersJson.trim().length > 0) {
        try {
          const parsed = JSON.parse(externalSkillsProvidersJson);
          if (!Array.isArray(parsed)) {
            setExternalSkillsError('External providers must be a JSON array.');
            setSaving(false);
            return;
          }
          parsedExternalProviders = parsed;
        } catch (e) {
          setExternalSkillsError('External providers must be valid JSON.');
          setSaving(false);
          return;
        }
      } else {
        parsedExternalProviders = [];
      }

      const externalSkills = {
        ...(config?.config?.externalSkills || {}),
        enabled: externalSkillsEnabled,
        allowRemote: externalSkillsAllowRemote,
        mode: externalSkillsMode,
        maxSkills: Number(externalSkillsMaxSkills) || 4,
        installConcurrency: Number(externalSkillsInstallConcurrency) || 2,
        training: {
          ...(config?.config?.externalSkills?.training || {}),
          mode: externalSkillsTrainingMode
        },
        queryAssist: {
          ...(config?.config?.externalSkills?.queryAssist || {}),
          mode: externalSkillsQueryAssistMode
        },
        providers: parsedExternalProviders
      };
      const res = await apiFetch(`/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reposRoot: reposRoot.trim(), llm, ui, auth: authConfig, queue, vectorIndex, observability, externalSkills })
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          onSave(data.config);
        }, 1000);
      } else {
        setError(data.error || 'Failed to save settings. Check the path and try again.');
        reposRootInputRef.current?.focus();
      }
    } catch (e) {
      console.error('Save failed:', e);
      setError('Failed to save settings. Check the connection and try again.');
      reposRootInputRef.current?.focus();
    }
    setSaving(false);
  };

  const isRemoteEndpoint = (value) => {
    if (!value) return false;
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      return !['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(host);
    } catch (e) {
      return false;
    }
  };

  const remotePrimaryBlocked = llmEndpoint && !llmAllowRemote && isRemoteEndpoint(llmEndpoint);
  const remoteFallbackBlocked = llmFallbackEndpoint && !llmAllowRemote && isRemoteEndpoint(llmFallbackEndpoint);
  const remoteBlocked = remotePrimaryBlocked || remoteFallbackBlocked;

  const handleTestLlm = async () => {
    const endpoints = [llmEndpoint.trim(), llmFallbackEndpoint.trim()].filter(Boolean);
    if (endpoints.length === 0) {
      setLlmTest({ status: 'error', results: [{ endpoint: '', reachable: false, error: 'Add an endpoint to test.' }] });
      return;
    }
    if (remoteBlocked) {
      setLlmTest({
        status: 'error',
        results: [{ endpoint: llmEndpoint.trim(), reachable: false, error: 'Remote endpoints are disabled.' }]
      });
      return;
    }

    setLlmTest({ status: 'testing', results: [] });
    const results = [];
    for (const endpoint of endpoints) {
      try {
        const res = await apiFetch(`/llm/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint })
        });
        const data = await res.json();
        results.push({
          endpoint,
          reachable: data.reachable === true,
          status: data.status,
          error: data.error
        });
      } catch (e) {
        results.push({ endpoint, reachable: false, error: e.message });
      }
    }
    setLlmTest({ status: 'done', results });
  };

  const handleScanExternalSkillUpdates = async () => {
    setExternalSkillsUpdatesLoading(true);
    setExternalSkillsUpdates(null);
    setExternalSkillsError('');
    try {
      const res = await apiFetch(`/external-skills/scan-updates`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setExternalSkillsError(data.error || 'Failed to scan for updates.');
      } else {
        if (data.error) {
          setExternalSkillsError(data.error);
        }
        setExternalSkillsUpdates(data);
      }
    } catch (e) {
      setExternalSkillsError('Failed to scan for updates.');
    }
    setExternalSkillsUpdatesLoading(false);
  };

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={transition}
      className="w-full max-w-5xl"
    >
      <div className="glass-panel rounded-3xl p-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/40 px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Documentation</div>
            <div className="text-sm text-slate-200">Open the HTML user manual for setup, workflows, and troubleshooting.</div>
          </div>
          <a
            href={resolvedManualUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-700/60 bg-slate-800/60 text-sm font-semibold text-slate-200 hover:text-white transition-ui"
          >
            <BookOpen size={16} aria-hidden="true" />
            User Manual
          </a>
        </div>
        {/* Repos Root */}
        <div>
          <label htmlFor="settings-repos-root" className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            Repository Root Directory
          </label>
          <div className="flex gap-3 rounded-2xl">
            <input
              id="settings-repos-root"
              name="settingsReposRoot"
              type="text"
              data-testid="settings-repos-root"
              value={reposRoot}
              onChange={(e) => setReposRoot(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              ref={reposRootInputRef}
              className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50 font-mono text-sm"
            />
            <button
              data-testid="settings-save"
              onClick={handleSave}
              disabled={loading || saved}
              className={cn(
                "px-6 py-4 rounded-2xl font-bold transition-ui flex items-center gap-2",
                saved
                  ? "bg-emerald-500 text-white"
                  : "bg-cyan-500 hover:bg-cyan-400 text-white"
              )}
            >
              {saved ? <Check size={20} aria-hidden="true" /> : loading ? <RefreshCw size={20} className="animate-spin" aria-hidden="true" /> : null}
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-2">
            This is where CORTEX looks for Agents, Skills, Knowledge, and Tools
          </p>
          {error && (
            <p className="text-red-400 text-sm mt-2" role="alert" data-testid="settings-error">{error}</p>
          )}
        </div>

        {/* LLM Endpoints */}
        <div>
          <label htmlFor="settings-llm-endpoint" className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            LLM Endpoint
          </label>
          <div className="flex flex-col gap-3">
            <input
              id="settings-llm-endpoint"
              name="settingsLlmEndpoint"
              type="text"
              value={llmEndpoint}
              onChange={(e) => setLlmEndpoint(e.target.value)}
              placeholder="http://localhost:8080/v1/chat/completions"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className={cn(
                "w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50 font-mono text-sm",
                remotePrimaryBlocked ? "border-amber-500/50" : ""
              )}
            />

            <input
              id="settings-llm-fallback"
              name="settingsLlmFallback"
              type="text"
              value={llmFallbackEndpoint}
              onChange={(e) => setLlmFallbackEndpoint(e.target.value)}
              placeholder="Fallback endpoint (optional)"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className={cn(
                "w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-slate-200 focus-visible:outline-none focus-visible:border-cyan-500/50 font-mono text-sm",
                remoteFallbackBlocked ? "border-amber-500/50" : ""
              )}
            />

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={llmAllowRemote}
                onChange={(e) => setLlmAllowRemote(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
              />
              Allow remote LLM endpoints
            </label>
          </div>
          {remoteBlocked && (
            <div className="mt-3 text-xs text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-xl px-3 py-2">
              Remote endpoints are disabled. Enable 'Allow remote LLM endpoints' to use non-local URLs.
            </div>
          )}
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={handleTestLlm}
              disabled={llmTest.status === 'testing'}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold transition-ui",
                llmTest.status === 'testing'
                  ? "bg-slate-700 text-slate-300"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200"
              )}
            >
              {llmTest.status === 'testing' ? 'Testing…' : 'Test Connection'}
            </button>
            <span className="text-xs text-slate-500">Pings the configured endpoint(s).</span>
          </div>

          {llmTest.results.length > 0 && (
            <div className="mt-3 space-y-2 text-xs">
              {llmTest.results.map((result) => (
                <div key={result.endpoint} className={cn(
                  "rounded-lg border px-3 py-2",
                  result.reachable ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300"
                )}>
                  <div className="font-mono">{result.endpoint || 'Unknown endpoint'}</div>
                  <div>
                    {result.reachable
                      ? `Reachable (HTTP ${result.status ?? 'n/a'})`
                      : `Unreachable${result.error ? `: ${result.error}` : ''}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500 mt-2">
            Set a primary endpoint and optional fallback for automatic failover.
          </p>
        </div>

        {/* Interface */}
        <div>
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            Interface Density
          </label>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-1">
            {['comfortable', 'dense'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setUiDensity(mode)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-semibold transition-ui",
                  uiDensity === mode
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {mode === 'comfortable' ? 'Comfortable' : 'Dense'}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Dense mode increases data density for power users.
          </p>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            Appearance Mode
          </label>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-1">
            {['system', 'dark', 'light'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onThemeChange?.(mode)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-semibold transition-ui",
                  (uiTheme || 'system') === mode
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            System follows your OS theme. Light mode is optimized for long sessions.
          </p>
        </div>

        {/* Security & Access */}
        <div>
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            Security & Access
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={authEnabled}
                onChange={(e) => setAuthEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
              />
              Enable authentication
            </label>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Token TTL (hours)</div>
                <input
                  type="number"
                  min="1"
                  value={authTtl}
                  onChange={(e) => setAuthTtl(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                />
              </div>
              <div className="flex items-center gap-3 mt-5">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={authBootstrapAllowed}
                    onChange={(e) => setAuthBootstrapAllowed(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                  />
                  Allow bootstrap
                </label>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4 space-y-3">
              <div className="text-xs text-slate-500 uppercase tracking-widest">SSO (Trusted Headers)</div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={ssoEnabled}
                  onChange={(e) => setSsoEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                />
                Enable SSO header trust
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={ssoHeaderUser}
                  onChange={(e) => setSsoHeaderUser(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-200 font-mono"
                  placeholder="x-cortex-user"
                />
                <input
                  type="text"
                  value={ssoHeaderRole}
                  onChange={(e) => setSsoHeaderRole(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-200 font-mono"
                  placeholder="x-cortex-role"
                />
                <input
                  type="text"
                  value={ssoHeaderWorkspace}
                  onChange={(e) => setSsoHeaderWorkspace(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-200 font-mono"
                  placeholder="x-cortex-workspace"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={ssoAutoProvision}
                  onChange={(e) => setSsoAutoProvision(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                />
                Auto-provision SSO users
              </label>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4 space-y-3">
              <div className="text-xs text-slate-500 uppercase tracking-widest">RBAC Policy</div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={rbacEnabled}
                  onChange={(e) => setRbacEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                />
                Enable resource-level RBAC
              </label>
              <textarea
                value={rbacRolesJson}
                onChange={(e) => {
                  setRbacRolesJson(e.target.value);
                  setRbacError('');
                }}
                rows={8}
                spellCheck={false}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-200 font-mono"
              />
              {rbacError && (
                <div className="text-[11px] text-red-300 border border-red-500/30 bg-red-500/10 rounded-xl px-3 py-2">
                  {rbacError}
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                Define allowed actions per role. Use "*" to grant all actions on a resource.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4 space-y-3">
              <div className="text-xs text-slate-500 uppercase tracking-widest">SCIM-lite Provisioning</div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={scimEnabled}
                  onChange={(e) => setScimEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                />
                Enable SCIM provisioning endpoints
              </label>
              <input
                type="text"
                value={scimToken}
                onChange={(e) => setScimToken(e.target.value)}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-200 font-mono"
                placeholder="Provisioning token (leave blank to keep current)"
              />
              <p className="text-[11px] text-slate-500">
                SCIM endpoints require this token in <span className="font-mono">Authorization: Bearer</span>.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Enable authentication before onboarding additional users. Bootstrap creates the first admin.
          </p>
        </div>

        {/* Workspaces */}
        {authUser?.role === 'admin' && (
          <div>
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
              Workspaces
            </label>
            <div className="space-y-3">
              {workspaces.length === 0 && (
                <div className="text-xs text-slate-500">No workspaces configured yet.</div>
              )}
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/40 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      {workspace.name || workspace.id}
                      {workspace.id === defaultWorkspaceId && (
                        <span className="tag-chip tag-chip-muted text-[10px]">Default</span>
                      )}
                      {activeWorkspace?.id === workspace.id && (
                        <span className="tag-chip text-[10px]">Active</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">{workspace.reposRoot}</div>
                    {workspace.outputDir && (
                      <div className="text-[11px] text-slate-600 font-mono">Output: {workspace.outputDir}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {workspace.id !== defaultWorkspaceId && (
                      <button
                        type="button"
                        onClick={() => onSetDefaultWorkspace?.(workspace.id)}
                        className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                      >
                        Make default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEditWorkspace(workspace)}
                      className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                    >
                      Edit
                    </button>
                    {workspace.id !== defaultWorkspaceId && (
                      <button
                        type="button"
                        onClick={() => onDeleteWorkspace?.(workspace.id)}
                        className="px-3 py-1 rounded-xl bg-red-500/10 text-red-300 hover:text-red-200 border border-red-500/30 text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4 space-y-3">
              <div className="text-xs text-slate-500 uppercase tracking-widest">
                {editingWorkspaceId ? 'Edit Workspace' : 'Create Workspace'}
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                  placeholder="Workspace name"
                />
                <input
                  type="text"
                  value={workspaceReposRoot}
                  onChange={(e) => setWorkspaceReposRoot(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200 font-mono"
                  placeholder="Repos root"
                />
                <input
                  type="text"
                  value={workspaceOutputDir}
                  onChange={(e) => setWorkspaceOutputDir(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200 font-mono"
                  placeholder="Output directory (optional)"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={workspaceCreateStructure}
                  onChange={(e) => setWorkspaceCreateStructure(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                />
                Create standard directory structure
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveWorkspace}
                  className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold"
                >
                  {editingWorkspaceId ? 'Save changes' : 'Create workspace'}
                </button>
                {editingWorkspaceId && (
                  <button
                    type="button"
                    onClick={resetWorkspaceForm}
                    className="px-4 py-2 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-300 text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Queue & Workers */}
        <div>
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            Queue & Workers
          </label>
          <div className="grid sm:grid-cols-4 gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 col-span-2">
              <input
                type="checkbox"
                checked={queueEnabled}
                onChange={(e) => setQueueEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
              />
              Enable background queue
            </label>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Worker mode</div>
              <select
                value={workerMode}
                onChange={(e) => setWorkerMode(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              >
                <option value="inline">Inline</option>
                <option value="local">Local workers</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Concurrency</div>
              <input
                type="number"
                min="1"
                value={queueConcurrency}
                onChange={(e) => setQueueConcurrency(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Retain completed</div>
              <input
                type="number"
                min="10"
                value={queueRetainCompleted}
                onChange={(e) => setQueueRetainCompleted(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Max jobs</div>
              <input
                type="number"
                min="50"
                value={queueMaxJobs}
                onChange={(e) => setQueueMaxJobs(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Min workers</div>
              <input
                type="number"
                min="1"
                value={workerMin}
                onChange={(e) => setWorkerMin(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Max workers</div>
              <input
                type="number"
                min="1"
                value={workerMax}
                onChange={(e) => setWorkerMax(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Scale threshold</div>
              <input
                type="number"
                min="1"
                value={workerScaleThreshold}
                onChange={(e) => setWorkerScaleThreshold(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Idle scale-down (ms)</div>
              <input
                type="number"
                min="1000"
                value={workerScaleDownIdle}
                onChange={(e) => setWorkerScaleDownIdle(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Poll interval (ms)</div>
              <input
                type="number"
                min="500"
                value={workerPollInterval}
                onChange={(e) => setWorkerPollInterval(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Heartbeat (ms)</div>
              <input
                type="number"
                min="1000"
                value={workerHeartbeatMs}
                onChange={(e) => setWorkerHeartbeatMs(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Job timeout (ms)</div>
              <input
                type="number"
                min="10000"
                value={workerJobTimeoutMs}
                onChange={(e) => setWorkerJobTimeoutMs(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Vector Index */}
        <div>
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            Semantic Vector Index
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-3">
              <input
                type="checkbox"
                checked={vectorEnabled}
                onChange={(e) => setVectorEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
              />
              Enable semantic index
            </label>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Mode</div>
              <select
                value={vectorMode}
                onChange={(e) => setVectorMode(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              >
                <option value="hash">Local Hash</option>
                <option value="embedding">Embeddings</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Chunk size</div>
              <input
                type="number"
                min="200"
                value={vectorChunkSize}
                onChange={(e) => setVectorChunkSize(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Overlap</div>
              <input
                type="number"
                min="50"
                value={vectorChunkOverlap}
                onChange={(e) => setVectorChunkOverlap(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Max files</div>
              <input
                type="number"
                min="100"
                value={vectorMaxFiles}
                onChange={(e) => setVectorMaxFiles(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Max chars/file</div>
              <input
                type="number"
                min="5000"
                value={vectorMaxChars}
                onChange={(e) => setVectorMaxChars(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Min score</div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={vectorMinScore}
                onChange={(e) => setVectorMinScore(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-3">
              <input
                type="checkbox"
                checked={vectorAutoRebuild}
                onChange={(e) => setVectorAutoRebuild(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
              />
              Auto-rebuild when missing
            </label>
            {vectorMode === 'embedding' && (
              <div className="sm:col-span-3 grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={embeddingEndpoint}
                  onChange={(e) => setEmbeddingEndpoint(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200 font-mono"
                  placeholder="Embedding endpoint (OpenAI-compatible)"
                />
                <input
                  type="text"
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200 font-mono"
                  placeholder="Embedding model"
                />
                <input
                  type="number"
                  min="64"
                  value={embeddingDimensions}
                  onChange={(e) => setEmbeddingDimensions(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                  placeholder="Dimensions"
                />
                <input
                  type="number"
                  min="1"
                  value={embeddingBatchSize}
                  onChange={(e) => setEmbeddingBatchSize(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                  placeholder="Batch size"
                />
                <input
                  type="number"
                  min="1000"
                  value={embeddingTimeoutMs}
                  onChange={(e) => setEmbeddingTimeoutMs(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                  placeholder="Timeout (ms)"
                />
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={embeddingAllowRemote}
                    onChange={(e) => setEmbeddingAllowRemote(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                  />
                  Allow remote embedding endpoint
                </label>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>Status: {vectorStatus?.docCount ? `${vectorStatus.docCount} docs` : 'No index built'}</span>
            {vectorStatus?.builtAt && <span>Last build {new Date(vectorStatus.builtAt).toLocaleString()}</span>}
            <button
              type="button"
              onClick={onRebuildVector}
              className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
            >
              Rebuild index
            </button>
          </div>
        </div>

        {/* External Skills */}
        <div>
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            External Skills (Online Providers)
          </label>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/30 p-4 space-y-4">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={externalSkillsEnabled}
                  onChange={(e) => setExternalSkillsEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                />
                Enable online skill providers
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={externalSkillsAllowRemote}
                  onChange={(e) => setExternalSkillsAllowRemote(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                />
                Allow remote downloads (network)
              </label>
              <div className="text-xs text-slate-500">
                Skills persist under <span className="font-mono">skills/</span> inside your Repository Root. Per-spawn retrieval is controlled by the 'Search online for skills' toggle.
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Mode</div>
                <select
                  value={externalSkillsMode}
                  onChange={(e) => setExternalSkillsMode(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                >
                  <option value="off">Off</option>
                  <option value="explicit">Explicit (goal slugs)</option>
                  <option value="auto">Auto (search)</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Max skills/spawn</div>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={externalSkillsMaxSkills}
                  onChange={(e) => setExternalSkillsMaxSkills(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                />
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Install concurrency</div>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={externalSkillsInstallConcurrency}
                  onChange={(e) => setExternalSkillsInstallConcurrency(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                />
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Training</div>
                <select
                  value={externalSkillsTrainingMode}
                  onChange={(e) => setExternalSkillsTrainingMode(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                >
                  <option value="blocking">Blocking</option>
                  <option value="background">Background</option>
                  <option value="off">Off</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Query assist</div>
                <select
                  value={externalSkillsQueryAssistMode}
                  onChange={(e) => setExternalSkillsQueryAssistMode(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                >
                  <option value="off">Off</option>
                  <option value="fallback">Fallback</option>
                  <option value="always">Always</option>
                </select>
              </div>
              <div className="sm:col-span-3 text-xs text-slate-500">
                Provider types are strict adapters (no arbitrary scraping). Supported types: <span className="font-mono">clawhub_v1</span>, <span className="font-mono">index_json_v1</span>.
                Explicit mode syntax: <span className="font-mono">clawhub: slack, jira</span> (provider id + slugs).
              </div>

              <div className="sm:col-span-3">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Providers (JSON)</div>
                <textarea
                  value={externalSkillsProvidersJson}
                  onChange={(e) => setExternalSkillsProvidersJson(e.target.value)}
                  rows={10}
                  spellCheck="false"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-3 text-xs text-slate-200 font-mono focus-visible:outline-none focus-visible:border-cyan-500/50"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    Scan uses the saved provider list. Save Settings after edits.
                  </div>
                  <button
                    type="button"
                    onClick={handleScanExternalSkillUpdates}
                    disabled={externalSkillsUpdatesLoading}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-ui",
                      externalSkillsUpdatesLoading
                        ? "bg-slate-900/60 border-slate-800 text-slate-400"
                        : "bg-slate-800/60 border-slate-700/60 text-slate-200 hover:bg-slate-700/60"
                    )}
                  >
                    <RefreshCw size={14} className={externalSkillsUpdatesLoading ? "animate-spin" : ""} aria-hidden="true" />
                    Scan for updates
                  </button>
                </div>

                {externalSkillsError && (
                  <p className="text-red-400 text-sm mt-3" role="alert">{externalSkillsError}</p>
                )}

                {externalSkillsUpdates?.updates && (
                  <div className="mt-3 rounded-2xl border border-slate-800/70 bg-slate-950/35 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="text-xs uppercase tracking-widest text-slate-500">Update scan</div>
                      <div className="text-xs text-slate-500">
                        {externalSkillsUpdates.installed?.length ?? 0} installed, {externalSkillsUpdates.updates?.filter((u) => u.updateAvailable).length ?? 0} updates
                      </div>
                    </div>

                    {externalSkillsUpdates.updates.filter((u) => u.updateAvailable).length === 0 ? (
                      <div className="text-xs text-slate-400">No updates detected.</div>
                    ) : (
                      <div className="space-y-1 text-xs text-slate-300">
                        {externalSkillsUpdates.updates
                          .filter((u) => u.updateAvailable)
                          .slice(0, 24)
                          .map((u) => (
                            <div
                              key={`${u.providerId}:${u.slug}`}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2"
                            >
                              <div className="font-mono">{u.providerId}:{u.slug}</div>
                              <div className="text-slate-400 font-mono">
                                {`${u.installedVersion || 'unknown'} -> ${u.latestVersion || 'unknown'}`}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Observability Alerts */}
        <div>
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
            Observability Alerts
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Cost alert (USD)</div>
              <input
                type="number"
                step="0.1"
                min="0"
                value={alertCost}
                onChange={(e) => setAlertCost(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Token alert</div>
              <input
                type="number"
                step="100"
                min="0"
                value={alertTokens}
                onChange={(e) => setAlertTokens(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Duration alert (ms)</div>
              <input
                type="number"
                step="1000"
                min="0"
                value={alertDuration}
                onChange={(e) => setAlertDuration(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* User Management */}
        {authStatus?.enabled && authUser?.role === 'admin' && (
          <div>
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 block">
              User Management
            </label>
            <div className="space-y-3">
              <div className="grid sm:grid-cols-5 gap-3">
                <input
                  type="text"
                  placeholder="Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={newUserWorkspace}
                  onChange={(e) => setNewUserWorkspace(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-200"
                >
                  <option value="">Workspace (default)</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name || workspace.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!newUsername || !newPassword) return;
                    onCreateUser?.({
                      username: newUsername,
                      password: newPassword,
                      role: newRole,
                      workspaceId: newUserWorkspace || null
                    });
                    setNewUsername('');
                    setNewPassword('');
                    setNewRole('viewer');
                    setNewUserWorkspace('');
                  }}
                  className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold"
                >
                  Add user
                </button>
              </div>
              {users.length === 0 ? (
                <div className="text-xs text-slate-500">No users found.</div>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex flex-wrap items-center gap-3 bg-slate-900/50 border border-slate-800/60 rounded-2xl px-4 py-2">
                      <div className="flex-1 min-w-[180px]">
                        <div className="text-sm text-slate-200">{user.username}</div>
                        <div className="text-[11px] text-slate-500">
                          Workspace: {workspaces.find((ws) => ws.id === user.workspaceId)?.name || (user.workspaceId ? user.workspaceId : 'Default')}
                        </div>
                      </div>
                      <select
                        value={user.role}
                        onChange={(e) => onUpdateUser?.(user.id, { role: e.target.value })}
                        className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-1 text-xs text-slate-200"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <select
                        value={user.workspaceId || ''}
                        onChange={(e) => onUpdateUser?.(user.id, { workspaceId: e.target.value || null })}
                        className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-1 text-xs text-slate-200"
                      >
                        <option value="">Default</option>
                        {workspaces.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.name || workspace.id}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={user.disabled}
                          onChange={(e) => onUpdateUser?.(user.id, { disabled: e.target.checked })}
                          className="h-3 w-3 rounded border-slate-600 bg-slate-900/60 text-cyan-400 focus:ring-cyan-500/30"
                        />
                        Disabled
                      </label>
                      <button
                        type="button"
                        onClick={() => onDeleteUser?.(user.id)}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ==========================================
// Spawn Status Timeline Component
// ==========================================
