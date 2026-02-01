const MAX_LOGS = 200;
const logs = [];

function addLog(message, level = 'info') {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    level,
    message
  };

  logs.unshift(entry);
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS;
  }

  return entry;
}

function getLogs() {
  return logs;
}

module.exports = {
  addLog,
  getLogs,
  MAX_LOGS
};
