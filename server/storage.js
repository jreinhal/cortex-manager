const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function ensureDirAsync(filePath) {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });
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

async function readJsonFileAsync(filePath, fallback) {
  try {
    const data = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
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

async function writeJsonAtomicAsync(filePath, data) {
  try {
    await ensureDirAsync(filePath);
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    await fsp.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    await fsp.rename(tmpPath, filePath);
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

async function appendJsonLineAsync(filePath, entry) {
  try {
    await ensureDirAsync(filePath);
    const line = `${JSON.stringify(entry)}\n`;
    await fsp.appendFile(filePath, line, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error appending ${filePath}:`, error.message);
    return false;
  }
}

module.exports = {
  readJsonFile,
  readJsonFileAsync,
  writeJsonAtomic,
  writeJsonAtomicAsync,
  appendJsonLine,
  appendJsonLineAsync,
};
