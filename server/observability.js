/**
 * Observability helpers - summarize run + evaluation usage.
 */

const runsStore = require('./runs-store');
const evaluationsStore = require('./evaluations-store');
const { getConfig } = require('./config');

function sumUsage(items, selector) {
  return items.reduce((sum, item) => sum + (selector(item) || 0), 0);
}

function matchesWorkspace(record, workspaceId, defaultId) {
  if (!workspaceId) return true;
  if (!record?.workspaceId) return workspaceId === defaultId;
  return record.workspaceId === workspaceId;
}

function summarizeObservability(workspaceId = null) {
  const config = getConfig();
  const defaultId = config.workspaces?.defaultId || 'default';
  const runs = runsStore.loadRuns().filter((run) => matchesWorkspace(run, workspaceId, defaultId));
  const evaluations = evaluationsStore.loadEvaluations()
    .filter((ev) => matchesWorkspace(ev, workspaceId, defaultId));
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const recentRuns = runs.filter((run) => {
    const ts = Date.parse(run.timestamp || run.createdAt || 0);
    return ts >= thirtyDaysAgo;
  });
  const recentEvals = evaluations.filter((ev) => {
    const ts = Date.parse(ev.createdAt || 0);
    return ts >= thirtyDaysAgo;
  });

  return {
    runs: {
      total: runs.length,
      last30Days: recentRuns.length,
      totalTokens: sumUsage(runs, (run) => run?.usage?.tokensEstimated || run?.metrics?.tokensEstimated),
      totalCost: sumUsage(runs, (run) => run?.usage?.costEstimated || run?.metrics?.costEstimated),
      avgDurationMs: runs.length > 0
        ? Math.round(runs.reduce((sum, run) => sum + (run.durationMs || 0), 0) / runs.length)
        : 0
    },
    evaluations: {
      total: evaluations.length,
      last30Days: recentEvals.length,
      totalTokens: sumUsage(evaluations, (ev) => ev?.usage?.tokensEstimated),
      totalCost: sumUsage(evaluations, (ev) => ev?.usage?.costEstimated)
    }
  };
}

module.exports = {
  summarizeObservability
};
