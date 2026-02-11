/**
 * ClawHub Integration
 *
 * Provides lightweight primitives to:
 * - Search ClawHub registry for relevant skills
 * - Download skill bundles (zip)
 * - Install bundles into the local repos root so CORTEX retrieval can use them
 *
 * Notes:
 * - ClawHub is an external skill registry. Pulling from it is remote/network I/O.
 * - Skill bundles are treated as untrusted input. We protect against zip-slip.
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { writeJsonAtomic } = require('./storage');

const DEFAULT_REGISTRY_BASE = 'https://auth.clawdhub.com/api/v1';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_ZIP_BYTES = 15 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set([
  // Executables and scripts that users might run by accident
  '.exe', '.dll', '.so', '.dylib', '.bin', '.cmd', '.bat', '.ps1', '.sh',
  // Archives nested inside archives are often used for smuggling
  '.zip', '.7z', '.rar', '.gz', '.tgz', '.bz2', '.xz',
  // Large-ish binary formats
  '.apk', '.jar', '.msi'
]);

function sanitizeSlug(slug) {
  const value = (slug ?? '').toString().trim();
  if (!value) {
    throw new Error('ClawHub slug is required');
  }
  const normalized = value.toLowerCase();
  // Conservative: keep to filesystem-safe slugs (ClawHub uses kebab-case in practice).
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    throw new Error(`Invalid ClawHub slug: ${slug}`);
  }
  return normalized;
}

function isPathWithin(root, target) {
  if (!root || !target) return false;
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (process.platform === 'win32') {
    const rootLower = resolvedRoot.toLowerCase();
    const targetLower = resolvedTarget.toLowerCase();
    return targetLower === rootLower || targetLower.startsWith(`${rootLower}${path.sep}`);
  }
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function buildUrl(registryBase, pathname, params = {}) {
  const base = (registryBase || DEFAULT_REGISTRY_BASE).replace(/\/+$/, '');
  const url = new URL(`${base}${pathname.startsWith('/') ? '' : '/'}${pathname}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetchWithTimeout(url, options);
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.length > 400 ? `${text.slice(0, 400)}...` : text;
    throw new Error(`ClawHub request failed (${res.status}): ${snippet || res.statusText}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`ClawHub returned invalid JSON (${url}): ${e.message}`);
  }
}

async function fetchZipBuffer(url, { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_ZIP_BYTES } = {}) {
  const res = await fetchWithTimeout(url, { timeoutMs });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ClawHub download failed (${res.status}): ${text || res.statusText}`);
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error(`ClawHub zip too large (${contentLength} bytes, limit ${maxBytes})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > maxBytes) {
    throw new Error(`ClawHub zip too large (${buffer.byteLength} bytes, limit ${maxBytes})`);
  }
  return buffer;
}

function safeExtractZip(zipBuffer, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });

  const zip = new AdmZip(zipBuffer);
  const extracted = [];
  for (const entry of zip.getEntries()) {
    const rawName = (entry.entryName || '').replace(/\\/g, '/');
    if (!rawName) continue;

    // Block zip-slip + absolute paths.
    if (rawName.startsWith('/') || rawName.startsWith('\\') || rawName.includes('..')) {
      throw new Error(`Unsafe zip entry path: ${rawName}`);
    }

    if (entry.isDirectory) {
      const dirPath = path.resolve(destinationDir, rawName);
      if (!isPathWithin(destinationDir, dirPath)) {
        throw new Error(`Unsafe zip directory path: ${rawName}`);
      }
      fs.mkdirSync(dirPath, { recursive: true });
      continue;
    }

    const ext = path.extname(rawName).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      continue; // Skip potentially dangerous/binary payloads.
    }

    const outPath = path.resolve(destinationDir, rawName);
    if (!isPathWithin(destinationDir, outPath)) {
      throw new Error(`Unsafe zip output path: ${rawName}`);
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, entry.getData());
    extracted.push(outPath);
  }
  return extracted;
}

function listFilesRecursive(rootDir) {
  const results = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function getInstalledMeta(installDir) {
  const metaPath = path.join(installDir, '_meta.json');
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withFileLock(lockPath, options, fn) {
  const timeoutMs = Number.isFinite(Number(options?.timeoutMs)) ? Number(options.timeoutMs) : 30000;
  const staleMs = Number.isFinite(Number(options?.staleMs)) ? Number(options.staleMs) : 10 * 60 * 1000;
  const pollMs = Number.isFinite(Number(options?.pollMs)) ? Number(options.pollMs) : 200;

  const startedAt = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try {
        fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      } finally {
        fs.closeSync(fd);
      }
      break;
    } catch (e) {
      if (e?.code !== 'EEXIST') throw e;

      // Opportunistically clear stale locks.
      try {
        const stat = fs.statSync(lockPath);
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs > staleMs) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        // If stat fails, retry acquisition normally.
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out waiting for ClawHub install lock (${path.basename(lockPath)})`);
      }
      await sleep(pollMs + Math.floor(Math.random() * pollMs));
    }
  }

  try {
    return await fn();
  } finally {
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {
      // ignore unlock failures
    }
  }
}

async function searchSkills(query, options = {}) {
  const q = (query ?? '').toString().trim();
  if (!q) return [];

  const {
    registryBase = DEFAULT_REGISTRY_BASE,
    limit = 5,
    minScore = 0.35,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = options;

  const url = buildUrl(registryBase, '/search', { q });
  const data = await fetchJson(url, { timeoutMs });
  const results = Array.isArray(data?.results) ? data.results : [];
  return results
    .filter((r) => r && typeof r.slug === 'string')
    .filter((r) => (typeof r.score === 'number' ? r.score : 0) >= minScore)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, Math.max(0, Math.min(50, limit)));
}

async function getSkill(slug, options = {}) {
  const safeSlug = sanitizeSlug(slug);
  const {
    registryBase = DEFAULT_REGISTRY_BASE,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = options;

  const url = buildUrl(registryBase, `/skills/${encodeURIComponent(safeSlug)}`);
  return fetchJson(url, { timeoutMs });
}

async function installSkill(slug, installOptions = {}) {
  const safeSlug = sanitizeSlug(slug);
  const {
    reposRoot,
    providerDirName = '_clawhub',
    providerId = 'clawhub',
    version = null,
    registryBase = DEFAULT_REGISTRY_BASE,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxZipBytes = DEFAULT_MAX_ZIP_BYTES,
    overwrite = true
  } = installOptions;

  if (!reposRoot) throw new Error('reposRoot is required');

  const skillsRoot = path.join(reposRoot, 'skills');
  const baseDir = path.join(skillsRoot, providerDirName);
  if (!isPathWithin(skillsRoot, baseDir)) {
    throw new Error('Refusing to install outside skills directory');
  }
  fs.mkdirSync(baseDir, { recursive: true });

  const destDir = path.join(baseDir, safeSlug);
  if (!isPathWithin(baseDir, destDir)) {
    throw new Error('Refusing to install outside provider directory');
  }

  const lockPath = path.join(baseDir, `.${safeSlug}.install.lock`);

  return withFileLock(lockPath, { timeoutMs: Math.max(2000, timeoutMs || DEFAULT_TIMEOUT_MS) }, async () => {
    const existing = getInstalledMeta(destDir);
    // Deterministic: if version is unspecified, treat existing installs as pinned (do not auto-update on spawn).
    if (existing && (!version || existing.version === version)) {
      return {
        installed: false,
        alreadyInstalled: true,
        slug: safeSlug,
        version: existing.version || null,
        dir: destDir
      };
    }

    let resolvedVersion = version;
    if (!resolvedVersion) {
      const skillData = await getSkill(safeSlug, { registryBase, timeoutMs });
      resolvedVersion = skillData?.latestVersion?.version ||
        skillData?.skill?.tags?.latest ||
        null;
    }

    const downloadUrl = buildUrl(registryBase, '/download', {
      slug: safeSlug,
      version: resolvedVersion
    });

    const zipBuffer = await fetchZipBuffer(downloadUrl, { timeoutMs, maxBytes: maxZipBytes });

    const stagingDir = path.join(baseDir, `.${safeSlug}.staging-${Date.now()}`);
    fs.mkdirSync(stagingDir, { recursive: true });

    try {
      safeExtractZip(zipBuffer, stagingDir);

      const skillFile = path.join(stagingDir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) {
        throw new Error('Downloaded bundle did not contain SKILL.md');
      }

      const meta = {
        providerId: (providerId || 'clawhub').toString(),
        providerType: 'clawhub_v1',
        slug: safeSlug,
        version: resolvedVersion || null,
        registryBase,
        downloadUrl,
        installedAt: new Date().toISOString()
      };
      try {
        writeJsonAtomic(path.join(stagingDir, '_meta.json'), meta);
      } catch {
        // Non-fatal; installs can still proceed without metadata.
      }

      if (overwrite && fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }

      fs.renameSync(stagingDir, destDir);

      return {
        installed: true,
        alreadyInstalled: false,
        slug: safeSlug,
        version: resolvedVersion,
        dir: destDir,
        files: listFilesRecursive(destDir).map((filePath) => path.relative(destDir, filePath))
      };
    } catch (e) {
      try {
        if (fs.existsSync(stagingDir)) {
          fs.rmSync(stagingDir, { recursive: true, force: true });
        }
      } catch {
        // ignore cleanup failures
      }
      throw e;
    }
  });
}

module.exports = {
  DEFAULT_REGISTRY_BASE,
  sanitizeSlug,
  searchSkills,
  getSkill,
  installSkill,
  getInstalledMeta
};
