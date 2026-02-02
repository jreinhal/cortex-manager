/**
 * Runs Store - persist run traces + metrics for observability.
 */

const fs = require('fs');
const path = require('path');

const RUNS_PATH = path.join(__dirname, '..', 'runs.json');
const MAX_RUNS = 200;

function loadRuns() {
  if (!fs.existsSync(RUNS_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(RUNS_PATH, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Error loading runs:', e.message);
    return [];
  }
}

function saveRuns(runs) {
  try {
    fs.writeFileSync(RUNS_PATH, JSON.stringify(runs, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving runs:', e.message);
    return false;
  }
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
