/**
 * Runs Store - persist run traces + metrics for observability.
 */

const path = require('path');
const { readJsonFile, writeJsonAtomic } = require('./storage');

const RUNS_PATH = path.join(__dirname, '..', 'runs.json');
const MAX_RUNS = 200;

function loadRuns() {
  const data = readJsonFile(RUNS_PATH, []);
  return Array.isArray(data) ? data : [];
}

function saveRuns(runs) {
  return writeJsonAtomic(RUNS_PATH, runs);
}

function recordRun(run) {
  const runs = loadRuns();
  runs.unshift(run);
  const trimmed = runs.slice(0, MAX_RUNS);
  saveRuns(trimmed);
  return run;
}

function getRun(id) {
  const runs = loadRuns();
  return runs.find((run) => run.id === id) || null;
}

module.exports = {
  RUNS_PATH,
  loadRuns,
  saveRuns,
  recordRun,
  getRun
};
