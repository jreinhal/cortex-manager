/**
 * Datasets Store - persist evaluation datasets and items.
 */

const fs = require('fs');
const path = require('path');

const DATASETS_PATH = path.join(__dirname, '..', 'datasets.json');
const MAX_DATASETS = 200;

function loadDatasets() {
  if (!fs.existsSync(DATASETS_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(DATASETS_PATH, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Error loading datasets:', e.message);
    return [];
  }
}

function saveDatasets(datasets) {
  try {
    fs.writeFileSync(DATASETS_PATH, JSON.stringify(datasets, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving datasets:', e.message);
    return false;
  }
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDataset({ name, description }) {
  const datasets = loadDatasets();
  const dataset = {
    id: generateId('dataset'),
    name: name || 'Untitled dataset',
    description: description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString()
  };
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

function addDatasetItem(datasetId, { input, expected, tags, weight, expectedType, rubric }) {
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
    weight: normalizedWeight,
    tags: Array.isArray(tags) ? tags : [],
    createdAt: new Date().toISOString()
  };
  datasets[idx].items = Array.isArray(datasets[idx].items) ? datasets[idx].items : [];
  datasets[idx].items.unshift(item);
  datasets[idx].updatedAt = new Date().toISOString();
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
  datasets[idx].updatedAt = new Date().toISOString();
  saveDatasets(datasets);
  return true;
}

function importDataset(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const dataset = {
    id: generateId('dataset'),
    name: payload.name || 'Imported dataset',
    description: payload.description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: []
  };

  const items = Array.isArray(payload.items) ? payload.items : [];
  dataset.items = items.map((item) => ({
    id: generateId('item'),
    input: item.input || '',
    expected: item.expected || '',
    expectedType: item.expectedType || null,
    rubric: item.rubric || null,
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
