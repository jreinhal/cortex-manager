/**
 * Evaluations Store - persist evaluation results.
 */

const path = require('path');
const { readJsonFile, writeJsonAtomic } = require('./storage');

const EVALUATIONS_PATH = path.join(__dirname, '..', 'evaluations.json');
const MAX_EVALUATIONS = 300;

function loadEvaluations() {
  const data = readJsonFile(EVALUATIONS_PATH, []);
  return Array.isArray(data) ? data : [];
}

function saveEvaluations(evaluations) {
  return writeJsonAtomic(EVALUATIONS_PATH, evaluations);
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
