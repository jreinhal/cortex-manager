/**
 * Evaluations Store - persist evaluation results.
 */

const fs = require('fs');
const path = require('path');

const EVALUATIONS_PATH = path.join(__dirname, '..', 'evaluations.json');
const MAX_EVALUATIONS = 300;

function loadEvaluations() {
  if (!fs.existsSync(EVALUATIONS_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(EVALUATIONS_PATH, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Error loading evaluations:', e.message);
    return [];
  }
}

function saveEvaluations(evaluations) {
  try {
    fs.writeFileSync(EVALUATIONS_PATH, JSON.stringify(evaluations, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving evaluations:', e.message);
    return false;
  }
}

function recordEvaluation(evaluation) {
  const evaluations = loadEvaluations();
  evaluations.unshift(evaluation);
  const trimmed = evaluations.slice(0, MAX_EVALUATIONS);
  saveEvaluations(trimmed);
  return evaluation;
}

function getEvaluation(id) {
  const evaluations = loadEvaluations();
  return evaluations.find((e) => e.id === id) || null;
}

module.exports = {
  EVALUATIONS_PATH,
  loadEvaluations,
  saveEvaluations,
  recordEvaluation,
  getEvaluation
};
