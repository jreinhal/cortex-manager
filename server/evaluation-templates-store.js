/**
 * Evaluation Templates Store - persistent rubric templates.
 */

const path = require('path');
const { readJsonFile, writeJsonAtomic } = require('./storage');
const { DEFAULT_TEMPLATES } = require('./evaluation-templates');

const TEMPLATES_PATH = path.join(__dirname, '..', 'evaluation_templates.json');
const MAX_TEMPLATES = 200;

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTemplate(input, base = {}) {
  return {
    id: input.id || base.id || generateId('template'),
    name: input.name || base.name || 'Untitled template',
    description: input.description || base.description || '',
    rubric: input.rubric || base.rubric || '',
    expectedType: input.expectedType || base.expectedType || 'llm',
    createdAt: input.createdAt || base.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || base.updatedAt || new Date().toISOString()
  };
}

function seedTemplates() {
  const timestamp = new Date().toISOString();
  const seeded = DEFAULT_TEMPLATES.map((template) => ({
    ...template,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  writeJsonAtomic(TEMPLATES_PATH, seeded);
  return seeded;
}

function loadTemplates() {
  const data = readJsonFile(TEMPLATES_PATH, null);
  if (!Array.isArray(data) || data.length === 0) {
    return seedTemplates();
  }
  let needsSave = false;
  const normalized = data.map((template) => {
    const normalizedTemplate = normalizeTemplate(template || {}, template || {});
    if (
      normalizedTemplate.createdAt !== template?.createdAt ||
      normalizedTemplate.updatedAt !== template?.updatedAt ||
      normalizedTemplate.expectedType !== template?.expectedType
    ) {
      needsSave = true;
    }
    return normalizedTemplate;
  });
  if (needsSave) {
    saveTemplates(normalized);
  }
  return normalized;
}

function saveTemplates(templates) {
  const trimmed = templates.slice(0, MAX_TEMPLATES);
  writeJsonAtomic(TEMPLATES_PATH, trimmed);
  return trimmed;
}

function createTemplate(payload) {
  const templates = loadTemplates();
  const template = normalizeTemplate(payload || {});
  templates.unshift(template);
  saveTemplates(templates);
  return template;
}

function updateTemplate(id, updates) {
  const templates = loadTemplates();
  const idx = templates.findIndex((template) => template.id === id);
  if (idx === -1) return null;
  const updated = normalizeTemplate(
    {
      ...templates[idx],
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    },
    templates[idx]
  );
  templates[idx] = updated;
  saveTemplates(templates);
  return updated;
}

function deleteTemplate(id) {
  const templates = loadTemplates();
  const next = templates.filter((template) => template.id !== id);
  if (next.length === templates.length) return false;
  saveTemplates(next);
  return true;
}

function importTemplates(payload) {
  const incoming = Array.isArray(payload) ? payload : payload ? [payload] : [];
  if (incoming.length === 0) return [];
  const templates = loadTemplates();
  const created = [];
  incoming.forEach((item) => {
    const template = normalizeTemplate(item || {});
    templates.unshift(template);
    created.push(template);
  });
  saveTemplates(templates);
  return created;
}

module.exports = {
  TEMPLATES_PATH,
  loadTemplates,
  saveTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  importTemplates
};
