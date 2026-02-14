/**
 * Job Queue - persistent async processing for spawns and background tasks.
 */

const path = require('path');
const { spawn } = require('child_process');
const { readJsonFile, writeJsonAtomic } = require('./storage');
const config = require('./config');
const runsStore = require('./runs-store');
const vectorIndex = require('./vector-index');

const JOBS_PATH = path.join(__dirname, '..', 'jobs.json');
const MAX_JOBS = 400;

let processing = false;
const activeJobs = new Map();
const workerProcesses = new Map();

function getWorkerConfig() {
  const queueConfig = config.getConfig().queue || {};
  return {
    mode: queueConfig.workers?.mode || 'inline',
    min: Number(queueConfig.workers?.min ?? 1),
    max: Number(queueConfig.workers?.max ?? 3),
    scaleUpThreshold: Number(queueConfig.workers?.scaleUpThreshold ?? 3),
    scaleDownIdleMs: Number(queueConfig.workers?.scaleDownIdleMs ?? 60000),
    pollIntervalMs: Number(queueConfig.workers?.pollIntervalMs ?? 1500),
    heartbeatMs: Number(queueConfig.workers?.heartbeatMs ?? 4000),
    jobTimeoutMs: Number(queueConfig.workers?.jobTimeoutMs ?? 20 * 60 * 1000)
  };
}

function isInlineMode() {
  const mode = getWorkerConfig().mode;
  return mode === 'inline' || mode === 'hybrid';
}

function loadJobs() {
  const data = readJsonFile(JOBS_PATH, []);
  return Array.isArray(data) ? data : [];
}

function saveJobs(jobs) {
  const queueConfig = config.getConfig().queue || {};
  const retainCompleted = queueConfig.retainCompleted ?? 120;
  const maxJobs = queueConfig.maxJobs ?? MAX_JOBS;
  const completed = jobs.filter(job => ['completed', 'failed', 'cancelled'].includes(job.status));
  const active = jobs.filter(job => !['completed', 'failed', 'cancelled'].includes(job.status));
  const trimmedCompleted = completed.slice(0, retainCompleted);
  const combined = active.concat(trimmedCompleted).slice(0, maxJobs);
  writeJsonAtomic(JOBS_PATH, combined);
  return combined;
}

function listJobs() {
  return loadJobs();
}

function getJob(id) {
  return loadJobs().find(job => job.id === id) || null;
}

function updateJob(id, patch) {
  const jobs = loadJobs();
  const idx = jobs.findIndex(job => job.id === id);
  if (idx === -1) return null;
  jobs[idx] = { ...jobs[idx], ...patch, updatedAt: new Date().toISOString() };
  saveJobs(jobs);
  return jobs[idx];
}

function claimNextJob(workerId) {
  const jobs = loadJobs();
  const idx = jobs.findIndex(job => job.status === 'queued');
  if (idx === -1) return null;
  const now = new Date().toISOString();
  const claimed = {
    ...jobs[idx],
    status: 'running',
    startedAt: now,
    attempts: (jobs[idx].attempts || 0) + 1,
    lockedBy: workerId,
    lockedAt: now,
    heartbeatAt: now,
    workerPid: process.pid
  };
  jobs[idx] = claimed;
  saveJobs(jobs);
  return claimed;
}

function heartbeatJob(id, workerId) {
  const job = getJob(id);
  if (!job || job.lockedBy !== workerId) return null;
  return updateJob(id, { heartbeatAt: new Date().toISOString() });
}

function requeueStaleJobs() {
  const { jobTimeoutMs } = getWorkerConfig();
  const now = Date.now();
  const jobs = loadJobs();
  let touched = false;
  const next = jobs.map((job) => {
    if (job.status !== 'running') return job;
    const heartbeatAt = Date.parse(job.heartbeatAt || job.lockedAt || job.startedAt || 0);
    if (heartbeatAt && now - heartbeatAt > jobTimeoutMs) {
      touched = true;
      return {
        ...job,
        status: 'queued',
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
        workerPid: null
      };
    }
    return job;
  });
  if (touched) {
    saveJobs(next);
  }
}

function createJob({ type, payload, createdBy, workspaceId = null }) {
  const job = {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: createdBy || null,
    workspaceId: workspaceId || payload?.workspaceId || null,
    lockedBy: null,
    lockedAt: null,
    heartbeatAt: null,
    workerPid: null,
    attempts: 0,
    result: null,
    error: null,
    runId: null,
    outputPath: null,
    durationMs: null
  };
  const jobs = loadJobs();
  jobs.unshift(job);
  saveJobs(jobs);
  return job;
}

function enqueueJob({ type, payload, createdBy, workspaceId }) {
  const job = createJob({ type, payload, createdBy, workspaceId });
  scheduleProcessing();
  return job;
}

function cancelJob(id) {
  const active = activeJobs.get(id);
  if (active?.process) {
    active.cancelRequested = true;
    try {
      active.process.kill('SIGTERM');
    } catch {}
  }
  const updated = updateJob(id, { status: 'cancelled' });
  return updated;
}

function scheduleProcessing() {
  if (processing) return;
  processing = true;
  setImmediate(processQueue);
}

function processQueue() {
  const queueConfig = config.getConfig().queue || {};
  if (queueConfig.enabled === false || !isInlineMode()) {
    processing = false;
    return;
  }
  const concurrency = Math.max(1, queueConfig.concurrency || 1);
  const activeCount = activeJobs.size;
  if (activeCount >= concurrency) {
    processing = false;
    return;
  }

  const pending = loadJobs().some(job => job.status === 'queued');
  if (!pending) {
    processing = false;
    return;
  }

  const slots = concurrency - activeCount;
  for (let i = 0; i < slots; i += 1) {
    const claimed = claimNextJob('inline');
    if (!claimed) break;
    startJob(claimed, { workerId: 'inline' });
  }
  processing = false;
}

function parseOutputPath(stdout) {
  if (!stdout) return null;
  const match = stdout.match(/Saved to:\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function resolveRunId(outputPath) {
  if (!outputPath) return null;
  const runs = runsStore.loadRuns();
  const match = runs.find(run => run.outputPath === outputPath);
  return match ? match.id : null;
}

function startJob(job, options = {}) {
  if (!job) return;
  const workerId = options.workerId || job.lockedBy || 'inline';
  if (job.status !== 'running') {
    updateJob(job.id, {
      status: 'running',
      startedAt: new Date().toISOString(),
      attempts: (job.attempts || 0) + 1,
      lockedBy: workerId,
      lockedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      workerPid: process.pid
    });
  }
  const { heartbeatMs } = getWorkerConfig();
  const heartbeatTimer = setInterval(() => heartbeatJob(job.id, workerId), heartbeatMs);
  heartbeatTimer.unref();

  if (job.type === 'spawn') {
    const orchestratorPath = path.join(__dirname, 'orchestrator.js');
    const normalizedFormat = (job.payload?.format || 'universal').toLowerCase();
    const goal = job.payload?.goal || '';
    const workspaceReposRoot = job.payload?.reposRoot || config.getConfig().reposRoot;
    const workspaceOutputDir = job.payload?.outputDir || config.getConfig().outputDir;
    const workspaceId = job.workspaceId || job.payload?.workspaceId || null;
    const externalSkillsRequest = job.payload?.externalSkills || null;
    const externalSkillsEnv = {};
    if (externalSkillsRequest && typeof externalSkillsRequest === 'object') {
      if (typeof externalSkillsRequest.online === 'boolean') {
        externalSkillsEnv.CORTEX_ONLINE_SKILLS = externalSkillsRequest.online ? '1' : '0';
      }
      if (typeof externalSkillsRequest.trainingMode === 'string' && externalSkillsRequest.trainingMode.trim()) {
        externalSkillsEnv.CORTEX_ONLINE_SKILLS_TRAINING = externalSkillsRequest.trainingMode.trim();
      }
    }

    const child = spawn('node', [orchestratorPath, '--stdin', normalizedFormat], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        REPOS_ROOT: workspaceReposRoot,
        CORTEX_OUTPUT_DIR: workspaceOutputDir,
        CORTEX_WORKSPACE_ID: workspaceId,
        ...externalSkillsEnv
      }
    });
    const tracker = { process: child, cancelRequested: false };
    activeJobs.set(job.id, tracker);

    let stdout = '';
    let stderr = '';
    const startedAt = Date.now();

    try {
      child.stdin.end(goal);
    } catch (e) {
      stderr += `\n[stdin write error] ${e.message}`;
      try {
        child.stdin.end();
      } catch (_stdinEndError) {
        // no-op
      }
    }

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearInterval(heartbeatTimer);
      activeJobs.delete(job.id);
      const durationMs = Date.now() - startedAt;
      const outputPath = parseOutputPath(stdout + stderr);
      const runId = resolveRunId(outputPath);

      if (tracker.cancelRequested) {
        updateJob(job.id, {
          status: 'cancelled',
          durationMs,
          outputPath,
          runId,
          result: { stdout, stderr }
        });
      } else if (code === 0) {
        updateJob(job.id, {
          status: 'completed',
          durationMs,
          outputPath,
          runId,
          result: { stdout, stderr }
        });
      } else {
        updateJob(job.id, {
          status: 'failed',
          durationMs,
          outputPath,
          runId,
          error: `Exit code ${code}`,
          result: { stdout, stderr }
        });
      }
      scheduleProcessing();
    });

    child.on('error', (error) => {
      clearInterval(heartbeatTimer);
      activeJobs.delete(job.id);
      updateJob(job.id, {
        status: 'failed',
        error: error.message
      });
      scheduleProcessing();
    });
    return;
  }

  if (job.type === 'vector-index') {
    const startedAt = Date.now();
    Promise.resolve()
      .then(() => vectorIndex.rebuildIndex({
        workspaceId: job.workspaceId || job.payload?.workspaceId || null,
        reposRoot: job.payload?.reposRoot || null
      }))
      .then((summary) => {
        updateJob(job.id, {
          status: 'completed',
          durationMs: Date.now() - startedAt,
          result: summary
        });
      })
      .catch((error) => {
        updateJob(job.id, {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          error: error.message
        });
      })
      .finally(() => {
      clearInterval(heartbeatTimer);
      activeJobs.delete(job.id);
        scheduleProcessing();
      });
    activeJobs.set(job.id, { process: null, cancelRequested: false });
    return;
  }

  updateJob(job.id, { status: 'failed', error: 'Unknown job type' });
  scheduleProcessing();
}

function startWorker(options = {}) {
  const workerId = options.workerId || `worker-${process.pid}`;
  const workerConfig = getWorkerConfig();
  const concurrency = Math.max(1, options.concurrency || 1);
  const pollIntervalMs = options.pollIntervalMs || workerConfig.pollIntervalMs;
  const loop = () => {
    if (!isInlineMode() && workerConfig.mode !== 'local') return;
    requeueStaleJobs();
    while (activeJobs.size < concurrency) {
      const claimed = claimNextJob(workerId);
      if (!claimed) break;
      startJob(claimed, { workerId });
    }
  };
  const interval = setInterval(loop, pollIntervalMs);
  interval.unref();
  return () => clearInterval(interval);
}

let scalerInterval = null;
let lastQueueEmptyAt = null;

function spawnWorkerProcess() {
  const workerId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const workerPath = path.join(__dirname, 'worker.js');
  const child = spawn('node', [workerPath], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      CORTEX_WORKER_ID: workerId
    },
    stdio: 'ignore'
  });
  workerProcesses.set(workerId, { process: child, startedAt: Date.now() });
  child.on('exit', () => {
    workerProcesses.delete(workerId);
  });
}

function scaleWorkerPool() {
  const workerConfig = getWorkerConfig();
  if (workerConfig.mode !== 'local') return;
  const jobs = loadJobs();
  const queued = jobs.filter(job => job.status === 'queued').length;
  const running = jobs.filter(job => job.status === 'running').length;

  if (queued === 0 && running === 0) {
    if (!lastQueueEmptyAt) lastQueueEmptyAt = Date.now();
  } else {
    lastQueueEmptyAt = null;
  }

  const base = Math.max(1, workerConfig.min);
  const scaleFactor = workerConfig.scaleUpThreshold > 0
    ? Math.ceil(queued / workerConfig.scaleUpThreshold)
    : 0;
  const desired = Math.min(workerConfig.max, Math.max(base, scaleFactor || base));

  while (workerProcesses.size < desired) {
    spawnWorkerProcess();
  }

  if (workerProcesses.size > base && lastQueueEmptyAt && Date.now() - lastQueueEmptyAt > workerConfig.scaleDownIdleMs) {
    const excess = workerProcesses.size - base;
    const ids = Array.from(workerProcesses.keys()).slice(0, excess);
    ids.forEach((id) => {
      const worker = workerProcesses.get(id);
      if (worker?.process) {
        try {
          worker.process.kill('SIGTERM');
        } catch {}
      }
      workerProcesses.delete(id);
    });
  }
}

function ensureWorkerPool() {
  const workerConfig = getWorkerConfig();
  if (workerConfig.mode !== 'local') return;
  scaleWorkerPool();
  if (!scalerInterval) {
    scalerInterval = setInterval(scaleWorkerPool, 5000);
    scalerInterval.unref();
  }
}

function getQueueStats() {
  const jobs = loadJobs();
  const counts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});
  return {
    counts,
    queued: counts.queued || 0,
    running: counts.running || 0,
    workers: workerProcesses.size
  };
}

module.exports = {
  JOBS_PATH,
  listJobs,
  getJob,
  enqueueJob,
  cancelJob,
  processQueue,
  startWorker,
  ensureWorkerPool,
  getQueueStats
};
