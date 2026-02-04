/**
 * Local user store for authentication.
 */

const path = require('path');
const crypto = require('crypto');
const { readJsonFile, writeJsonAtomic } = require('./storage');

const USERS_PATH = path.join(__dirname, '..', 'users.json');
const MAX_USERS = 200;

function generateId() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashPassword(password, salt) {
  const saltValue = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, saltValue, 120000, 64, 'sha512').toString('hex');
  return { salt: saltValue, hash };
}

function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

function loadUsers() {
  const data = readJsonFile(USERS_PATH, []);
  return Array.isArray(data) ? data : [];
}

function saveUsers(users) {
  const trimmed = users.slice(0, MAX_USERS);
  writeJsonAtomic(USERS_PATH, trimmed);
  return trimmed;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, ...safe } = user;
  return safe;
}

function findByUsername(username) {
  const users = loadUsers();
  return users.find((user) => user.username.toLowerCase() === username.toLowerCase()) || null;
}

function findById(id) {
  const users = loadUsers();
  return users.find((user) => user.id === id) || null;
}

function countAdmins() {
  const users = loadUsers();
  return users.filter((user) => user.role === 'admin' && !user.disabled).length;
}

function createUser({ username, password, role = 'viewer', workspaceId = null, external = false, provider = null }) {
  if (!username || (!password && !external)) return null;
  const users = loadUsers();
  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    return null;
  }
  const { salt, hash } = external ? { salt: null, hash: null } : hashPassword(password);
  const user = {
    id: generateId(),
    username,
    role,
    workspaceId: workspaceId || null,
    passwordSalt: salt,
    passwordHash: hash,
    external: Boolean(external),
    provider: provider || null,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    disabled: false
  };
  users.unshift(user);
  saveUsers(users);
  return sanitizeUser(user);
}

function updateUser(id, updates) {
  const users = loadUsers();
  const idx = users.findIndex((user) => user.id === id);
  if (idx === -1) return null;
  const target = users[idx];
  const next = {
    ...target,
    username: updates.username || target.username,
    role: updates.role || target.role,
    disabled: typeof updates.disabled === 'boolean' ? updates.disabled : target.disabled,
    workspaceId: updates.workspaceId !== undefined ? updates.workspaceId : target.workspaceId
  };
  if (updates.password) {
    const { salt, hash } = hashPassword(updates.password);
    next.passwordSalt = salt;
    next.passwordHash = hash;
    next.external = false;
    next.provider = null;
  }
  users[idx] = next;
  saveUsers(users);
  return sanitizeUser(next);
}

function deleteUser(id) {
  const users = loadUsers();
  const next = users.filter((user) => user.id !== id);
  if (next.length === users.length) return false;
  saveUsers(next);
  return true;
}

function recordLogin(id) {
  const users = loadUsers();
  const idx = users.findIndex((user) => user.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], lastLoginAt: new Date().toISOString() };
  saveUsers(users);
  return sanitizeUser(users[idx]);
}

function listUsers() {
  return loadUsers().map(sanitizeUser);
}

function hasUsers() {
  return loadUsers().length > 0;
}

function verifyLogin(username, password) {
  const user = findByUsername(username);
  if (!user || user.disabled || user.external) return null;
  const ok = verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!ok) return null;
  return sanitizeUser(user);
}

function upsertExternalUser({ username, role = 'viewer', workspaceId = null, provider = 'sso' }) {
  if (!username) return null;
  const users = loadUsers();
  const idx = users.findIndex((user) => user.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) {
    const user = {
      id: generateId(),
      username,
      role,
      workspaceId,
      passwordSalt: null,
      passwordHash: null,
      external: true,
      provider,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      disabled: false
    };
    users.unshift(user);
    saveUsers(users);
    return sanitizeUser(user);
  }
  const existing = users[idx];
  const updated = {
    ...existing,
    role: role || existing.role,
    workspaceId: workspaceId !== undefined ? workspaceId : existing.workspaceId,
    external: true,
    provider,
    lastLoginAt: new Date().toISOString()
  };
  users[idx] = updated;
  saveUsers(users);
  return sanitizeUser(updated);
}

module.exports = {
  USERS_PATH,
  loadUsers,
  saveUsers,
  listUsers,
  hasUsers,
  countAdmins,
  createUser,
  updateUser,
  deleteUser,
  recordLogin,
  verifyLogin,
  findById,
  findByUsername,
  hashPassword,
  verifyPassword,
  sanitizeUser,
  upsertExternalUser
};
