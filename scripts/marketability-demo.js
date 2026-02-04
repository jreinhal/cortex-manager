#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const valueArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  if (match) return match.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
    return args[index + 1];
  }
  return fallback;
};

const port = valueArg('port', process.env.DEMO_PORT || '3001');
const apiBase = process.env.DEMO_API_BASE || `http://localhost:${port}/api`;
const outputPath = valueArg('out', path.join(__dirname, '..', 'docs', 'marketability-demo-report.md'));
const startServer = flag('start-server');
const doScan = flag('scan');
const doSpawn = flag('spawn');
const doEval = flag('eval');

const headers = { 'Content-Type': 'application/json' };
if (process.env.DEMO_TOKEN) {
  headers.Authorization = `Bearer ${process.env.DEMO_TOKEN}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(endpoint, options = {}) {
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { ok: response.ok, status: response.status, data };
}

async function waitForServer(maxAttempts = 40) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await request('/status');
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await sleep(1000);
  }
  return false;
}

function formatJson(value) {
  if (value === null || value === undefined) return 'n/a';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function main() {
  let serverProcess = null;
  const report = [];
  const checks = [];
  const warnings = [];

  report.push('# Marketability Demo Report');
  report.push('');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`API Base: ${apiBase}`);
  report.push(`Flags: scan=${doScan} spawn=${doSpawn} eval=${doEval} start-server=${startServer}`);
  report.push('');

  if (startServer) {
    const serverPath = path.join(__dirname, '..', 'server', 'index.js');
    serverProcess = spawn('node', [serverPath], {
      env: { ...process.env, PORT: port },
      stdio: 'ignore'
    });

    const ready = await waitForServer();
    if (!ready) {
      warnings.push('Server did not become ready in time. API calls may fail.');
    }
  }

  let statusRes;
  try {
    statusRes = await request('/status');
  } catch (error) {
    statusRes = { ok: false, status: 'ERR', data: error.message };
  }
  checks.push(`- Status: ${statusRes.ok ? 'ok' : `fail (${statusRes.status})`}`);

  let configRes;
  try {
    configRes = await request('/config');
  } catch (error) {
    configRes = { ok: false, status: 'ERR', data: error.message };
  }
  checks.push(`- Config read: ${configRes.ok ? 'ok' : `fail (${configRes.status})`}`);

  let analyticsRes;
  try {
    analyticsRes = await request('/analytics');
  } catch (error) {
    analyticsRes = { ok: false, status: 'ERR', data: error.message };
  }
  checks.push(`- Analytics: ${analyticsRes.ok ? 'ok' : `fail (${analyticsRes.status})`}`);

  let reposRes;
  try {
    reposRes = await request('/repos');
  } catch (error) {
    reposRes = { ok: false, status: 'ERR', data: error.message };
  }
  checks.push(`- Repo registry: ${reposRes.ok ? 'ok' : `fail (${reposRes.status})`}`);

  let categoriesRes;
  try {
    categoriesRes = await request('/categories');
  } catch (error) {
    categoriesRes = { ok: false, status: 'ERR', data: error.message };
  }
  checks.push(`- Repo categories: ${categoriesRes.ok ? 'ok' : `fail (${categoriesRes.status})`}`);

  let sizesRes;
  try {
    sizesRes = await request('/category-sizes');
  } catch (error) {
    sizesRes = { ok: false, status: 'ERR', data: error.message };
  }
  checks.push(`- Repo sizes: ${sizesRes.ok ? 'ok' : `fail (${sizesRes.status})`}`);

  let runsRes;
  try {
    runsRes = await request('/runs');
  } catch (error) {
    runsRes = { ok: false, status: 'ERR', data: error.message };
  }
  checks.push(`- Runs: ${runsRes.ok ? 'ok' : `fail (${runsRes.status})`}`);

  let observabilityRes;
  try {
    observabilityRes = await request('/observability/summary');
  } catch (error) {
    observabilityRes = { ok: false, status: 'ERR', data: error.message };
  }
  checks.push(`- Observability summary: ${observabilityRes.ok ? 'ok' : `fail (${observabilityRes.status})`}`);

  let scanRes = null;
  if (doScan) {
    try {
      scanRes = await request('/scan', { method: 'POST', body: JSON.stringify({}) });
    } catch (error) {
      scanRes = { ok: false, status: 'ERR', data: error.message };
    }
    checks.push(`- Repo scan: ${scanRes.ok ? 'ok' : `fail (${scanRes.status})`}`);
  }

  let spawnRes = null;
  let spawnJob = null;
  if (doSpawn) {
    try {
      spawnRes = await request('/spawn', {
        method: 'POST',
        body: JSON.stringify({
          goal: '[DEMO] Marketability walkthrough spawn',
          format: 'universal',
          async: true
        })
      });
    } catch (error) {
      spawnRes = { ok: false, status: 'ERR', data: error.message };
    }
    checks.push(`- Spawn (queued): ${spawnRes.ok ? 'ok' : `fail (${spawnRes.status})`}`);
    if (spawnRes.ok && spawnRes.data && spawnRes.data.job) {
      spawnJob = spawnRes.data.job;
    }
  }

  let jobStatus = null;
  if (spawnJob) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await sleep(2000);
      const jobRes = await request(`/jobs/${spawnJob.id}`);
      if (!jobRes.ok) {
        jobStatus = jobRes;
        break;
      }
      const status = jobRes.data?.status;
      if (['completed', 'failed', 'cancelled'].includes(status)) {
        jobStatus = jobRes;
        break;
      }
    }
    if (jobStatus) {
      checks.push(`- Spawn job status: ${jobStatus.ok ? jobStatus.data.status : `fail (${jobStatus.status})`}`);
    } else {
      warnings.push('Spawn job did not reach a terminal state within the timeout window.');
    }
  }

  let evalRes = null;
  if (doEval) {
    try {
      const datasetRes = await request('/datasets', {
        method: 'POST',
        body: JSON.stringify({
          name: `Marketability Demo ${new Date().toISOString()}`,
          description: 'Auto-generated dataset for marketability demo.',
          benchmarkType: 'retrieval'
        })
      });
      if (!datasetRes.ok) {
        evalRes = { ok: false, status: datasetRes.status, data: datasetRes.data };
      } else {
        const datasetId = datasetRes.data.dataset?.id;
        await request(`/datasets/${datasetId}/items`, {
          method: 'POST',
          body: JSON.stringify({
            input: 'Locate AGENTS.md in the knowledge skills repository',
            expectedPaths: []
          })
        });
        evalRes = await request('/evaluations', {
          method: 'POST',
          body: JSON.stringify({
            datasetId,
            name: 'Marketability Demo Retrieval Evaluation'
          })
        });
      }
    } catch (error) {
      evalRes = { ok: false, status: 'ERR', data: error.message };
    }
    checks.push(`- Evaluation run: ${evalRes.ok ? 'ok' : `fail (${evalRes.status})`}`);
  }

  report.push('## Health Checks');
  report.push('');
  report.push(...checks);
  report.push('');

  if (statusRes?.ok) {
    report.push('## Status');
    report.push('');
    report.push('```json');
    report.push(formatJson(statusRes.data));
    report.push('```');
    report.push('');
  }

  if (configRes?.ok) {
    const configSnapshot = configRes.data?.config || {};
    const llm = configSnapshot.llm || {};
    report.push('## Config Snapshot');
    report.push('');
    report.push(`- Theme: ${configSnapshot.theme || 'unknown'}`);
    report.push(`- LLM Provider: ${llm.provider || 'unknown'}`);
    report.push(`- LLM Model: ${llm.model || 'unknown'}`);
    report.push(`- LLM Endpoint: ${llm.endpoint || 'unknown'}`);
    report.push('');
  }

  if (analyticsRes?.ok) {
    report.push('## Analytics');
    report.push('');
    report.push(`- Total spawns: ${analyticsRes.data?.totalSpawns ?? 'n/a'}`);
    report.push(`- Recent spawns: ${analyticsRes.data?.recentSpawns?.length ?? 0}`);
    report.push('');
  }

  if (reposRes?.ok) {
    report.push('## Repository Coverage');
    report.push('');
    report.push(`- Registered repositories: ${Array.isArray(reposRes.data) ? reposRes.data.length : 'n/a'}`);
    report.push('');
  }

  if (categoriesRes?.ok) {
    report.push('## Repository Categories');
    report.push('');
    report.push('```json');
    report.push(formatJson(categoriesRes.data));
    report.push('```');
    report.push('');
  }

  if (sizesRes?.ok) {
    report.push('## Repository Sizes');
    report.push('');
    report.push('```json');
    report.push(formatJson(sizesRes.data));
    report.push('```');
    report.push('');
  }

  if (runsRes?.ok) {
    report.push('## Runs Snapshot');
    report.push('');
    report.push(`- Total runs: ${Array.isArray(runsRes.data) ? runsRes.data.length : 'n/a'}`);
    if (Array.isArray(runsRes.data) && runsRes.data.length > 0) {
      report.push(`- Latest run: ${runsRes.data[0]?.goal || 'unknown'}`);
    }
    report.push('');
  }

  if (observabilityRes?.ok) {
    report.push('## Observability Summary');
    report.push('');
    report.push('```json');
    report.push(formatJson(observabilityRes.data));
    report.push('```');
    report.push('');
  }

  if (scanRes) {
    report.push('## Scan Result');
    report.push('');
    report.push('```json');
    report.push(formatJson(scanRes.data));
    report.push('```');
    report.push('');
  }

  if (spawnRes) {
    report.push('## Spawn Result');
    report.push('');
    report.push('```json');
    report.push(formatJson(spawnRes.data));
    report.push('```');
    report.push('');
  }

  if (jobStatus) {
    report.push('## Spawn Job Status');
    report.push('');
    report.push('```json');
    report.push(formatJson(jobStatus.data));
    report.push('```');
    report.push('');
  }

  if (evalRes) {
    report.push('## Evaluation Result');
    report.push('');
    report.push('```json');
    report.push(formatJson(evalRes.data));
    report.push('```');
    report.push('');
  }

  if (warnings.length > 0) {
    report.push('## Warnings');
    report.push('');
    warnings.forEach((warning) => report.push(`- ${warning}`));
    report.push('');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, report.join('\n'), 'utf8');

  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }

  console.log(`Report written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
