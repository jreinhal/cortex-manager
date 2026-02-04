/**
 * Datasets Store - persist evaluation datasets and items.
 */

const path = require('path');
const { readJsonFile, writeJsonAtomic } = require('./storage');

const DATASETS_PATH = path.join(__dirname, '..', 'datasets.json');
const MAX_DATASETS = 200;

function loadDatasets() {
  const data = readJsonFile(DATASETS_PATH, []);
  if (!Array.isArray(data)) return [];
  let needsSave = false;
  const normalized = data.map((dataset) => {
    const next = { ...dataset };
    if (!Number.isFinite(Number(next.version))) {
      const timestamp = next.updatedAt || next.createdAt || new Date().toISOString();
      next.version = 1;
      next.revisions = Array.isArray(next.revisions) ? next.revisions : [{ version: 1, updatedAt: timestamp, reason: 'migrate' }];
      needsSave = true;
    }
    return next;
  });
  if (needsSave) {
    saveDatasets(normalized);
  }
  return normalized;
}

function saveDatasets(datasets) {
  return writeJsonAtomic(DATASETS_PATH, datasets);
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function bumpDatasetVersion(dataset, reason) {
  const nextVersion = Number.isFinite(Number(dataset.version)) ? Number(dataset.version) + 1 : 2;
  const timestamp = new Date().toISOString();
  dataset.version = nextVersion;
  dataset.updatedAt = timestamp;
  dataset.revisions = Array.isArray(dataset.revisions) ? dataset.revisions : [];
  dataset.revisions.unshift({
    version: nextVersion,
    updatedAt: timestamp,
    reason: reason || 'update'
  });
  dataset.revisions = dataset.revisions.slice(0, 25);
}

function createDataset({ name, description, workspaceId = null, benchmarkType = 'response' }) {
  const datasets = loadDatasets();
  const timestamp = new Date().toISOString();
  const dataset = {
    id: generateId('dataset'),
    name: name || 'Untitled dataset',
    description: description || '',
    workspaceId: workspaceId || null,
    benchmarkType: benchmarkType || 'response',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    revisions: [{ version: 1, updatedAt: timestamp, reason: 'create' }],
    items: []
  };
  datasets.unshift(dataset);
  saveDatasets(datasets.slice(0, MAX_DATASETS));
  return dataset;
}

function updateDataset(id, updates) {
  const datasets = loadDatasets();
  const idx = datasets.findIndex((d) => d.id === id);
  if (idx === -1) return null;

  datasets[idx] = {
    ...datasets[idx],
    ...updates,
    benchmarkType: updates.benchmarkType || datasets[idx].benchmarkType || 'response'
  };
  bumpDatasetVersion(datasets[idx], 'metadata update');
  saveDatasets(datasets);
  return datasets[idx];
}

function deleteDataset(id) {
  const datasets = loadDatasets();
  const next = datasets.filter((d) => d.id !== id);
  if (next.length === datasets.length) return false;
  saveDatasets(next);
  return true;
}

function getDataset(id) {
  const datasets = loadDatasets();
  return datasets.find((d) => d.id === id) || null;
}

function addDatasetItem(datasetId, { input, expected, tags, weight, expectedType, rubric, expectedPaths }) {
  const datasets = loadDatasets();
  const idx = datasets.findIndex((d) => d.id === datasetId);
  if (idx === -1) return null;

  const normalizedWeight = Number.isFinite(Number(weight)) ? Number(weight) : 1;
  const item = {
    id: generateId('item'),
    input: input || '',
    expected: expected || '',
    expectedType: expectedType || null,
    rubric: rubric || null,
    expectedPaths: Array.isArray(expectedPaths) ? expectedPaths : [],
    weight: normalizedWeight,
    tags: Array.isArray(tags) ? tags : [],
    createdAt: new Date().toISOString()
  };
  datasets[idx].items = Array.isArray(datasets[idx].items) ? datasets[idx].items : [];
  datasets[idx].items.unshift(item);
  bumpDatasetVersion(datasets[idx], 'add item');
  saveDatasets(datasets);
  return item;
}

function removeDatasetItem(datasetId, itemId) {
  const datasets = loadDatasets();
  const idx = datasets.findIndex((d) => d.id === datasetId);
  if (idx === -1) return false;

  const items = Array.isArray(datasets[idx].items) ? datasets[idx].items : [];
  const nextItems = items.filter((item) => item.id !== itemId);
  if (nextItems.length === items.length) return false;
  datasets[idx].items = nextItems;
  bumpDatasetVersion(datasets[idx], 'remove item');
  saveDatasets(datasets);
  return true;
}

function importDataset(payload, workspaceId = null) {
  if (!payload || typeof payload !== 'object') return null;

  const timestamp = new Date().toISOString();
  const dataset = {
    id: generateId('dataset'),
    name: payload.name || 'Imported dataset',
    description: payload.description || '',
    workspaceId: workspaceId || payload.workspaceId || null,
    benchmarkType: payload.benchmarkType || 'response',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    revisions: [{ version: 1, updatedAt: timestamp, reason: 'import' }],
    items: []
  };

  const items = Array.isArray(payload.items) ? payload.items : [];
  dataset.items = items.map((item) => ({
    id: generateId('item'),
    input: item.input || '',
    expected: item.expected || '',
    expectedType: item.expectedType || null,
    rubric: item.rubric || null,
    expectedPaths: Array.isArray(item.expectedPaths) ? item.expectedPaths : [],
    weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : 1,
    tags: Array.isArray(item.tags) ? item.tags : [],
    createdAt: new Date().toISOString()
  }));

  const datasets = loadDatasets();
  datasets.unshift(dataset);
  saveDatasets(datasets.slice(0, MAX_DATASETS));
  return dataset;
}

module.exports = {
  DATASETS_PATH,
  loadDatasets,
  saveDatasets,
  createDataset,
  updateDataset,
  deleteDataset,
  getDataset,
  addDatasetItem,
  removeDatasetItem,
  importDataset
};
