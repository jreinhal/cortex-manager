const fs = require('fs');
const path = require('path');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  try {
    ensureDir(filePath);
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error.message);
    return false;
  }
}

function appendJsonLine(filePath, entry) {
  try {
    ensureDir(filePath);
    const line = `${JSON.stringify(entry)}\n`;
    fs.appendFileSync(filePath, line, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error appending ${filePath}:`, error.message);
    return false;
  }
}

module.exports = {
  readJsonFile,
  writeJsonAtomic,
  appendJsonLine
};
