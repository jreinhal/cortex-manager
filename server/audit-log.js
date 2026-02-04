const path = require('path');
const { appendJsonLine } = require('./storage');

const AUDIT_PATH = path.join(__dirname, '..', 'audit.log.jsonl');

function truncate(value, max = 500) {
  if (value === null || value === undefined) return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function buildContext(req) {
  if (!req) return {};
  return {
    ip: req.ip,
    userAgent: req.get ? req.get('user-agent') : undefined,
    user: req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : undefined,
    workspaceId: req.workspace?.id || req.workspaceId || undefined
  };
}

function recordAudit(event, metadata = {}, req = null) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...buildContext(req),
    metadata: Object.fromEntries(
      Object.entries(metadata || {}).map(([key, value]) => [key, truncate(value)])
    )
  };
  appendJsonLine(AUDIT_PATH, entry);
}

module.exports = {
  AUDIT_PATH,
  recordAudit
};
