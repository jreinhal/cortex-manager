/**
 * Auth helpers: token issuance, middleware, and role checks.
 */

const crypto = require('crypto');
const { getConfig } = require('./config');
const authStore = require('./auth-store');

const ROLE_RANK = {
  viewer: 1,
  editor: 2,
  admin: 3
};

const OPEN_PATHS = new Set([
  '/api/auth/status',
  '/api/auth/login',
  '/api/auth/bootstrap'
]);

function normalizeActionList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => item.toString());
  if (typeof value === 'string') return [value];
  return [];
}

function actionAllowed(allowed, action) {
  const actions = normalizeActionList(allowed);
  return actions.includes('*') || actions.includes(action);
}

function permissionAllowed(policy, resource, action) {
  if (!policy || typeof policy !== 'object') return false;
  if (actionAllowed(policy['*'], action)) return true;
  if (actionAllowed(policy[resource], action)) return true;
  return false;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = padded.length % 4 === 0 ? 0 : 4 - (padded.length % 4);
  const normalized = padded + '='.repeat(padLength);
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function signTokenPayload(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerEnc = base64UrlEncode(JSON.stringify(header));
  const payloadEnc = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerEnc}.${payloadEnc}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerEnc, payloadEnc, signature] = parts;
  const data = `${headerEnc}.${payloadEnc}`;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  if (expected !== signature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadEnc));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function issueToken(user) {
  const config = getConfig();
  const ttlHours = config.auth?.tokenTtlHours ?? 12;
  const issuedAt = Date.now();
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    workspaceId: user.workspaceId || null,
    iat: issuedAt,
    exp: issuedAt + ttlHours * 60 * 60 * 1000
  };
  return signTokenPayload(payload, config.auth.secret);
}

function getUserFromRequest(req) {
  const config = getConfig();
  if (!config.auth?.enabled) {
    return { id: 'local', username: 'local', role: 'admin', workspaceId: null };
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token, config.auth.secret);
  if (!payload) return null;
  const user = authStore.findById(payload.sub);
  if (!user || user.disabled) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    workspaceId: user.workspaceId || null
  };
}

function normalizeRole(role, fallback = 'viewer') {
  const allowed = new Set(['viewer', 'editor', 'admin']);
  if (!role) return fallback;
  const value = role.toString().toLowerCase();
  return allowed.has(value) ? value : fallback;
}

function getSsoUserFromRequest(req) {
  const config = getConfig();
  const sso = config.auth?.sso || {};
  if (!sso.enabled) return null;

  if (sso.mode === 'header') {
    const headerUser = sso.headerUser || 'x-cortex-user';
    const headerRole = sso.headerRole || 'x-cortex-role';
    const headerWorkspace = sso.headerWorkspace || 'x-cortex-workspace';
    const username = req.headers[headerUser] || req.headers['x-forwarded-user'];
    if (!username) return null;
    const role = normalizeRole(req.headers[headerRole], sso.defaultRole || 'viewer');
    const workspaceId = req.headers[headerWorkspace] || null;
    if (sso.autoProvision === false) {
      const existing = authStore.findByUsername(username);
      return existing ? { ...existing, workspaceId: existing.workspaceId || workspaceId } : null;
    }
    const provisioned = authStore.upsertExternalUser({
      username,
      role,
      workspaceId,
      provider: 'sso'
    });
    return provisioned ? { ...provisioned, workspaceId: provisioned.workspaceId || workspaceId } : null;
  }

  return null;
}

function middleware(req, res, next) {
  const config = getConfig();
  if (!config.auth?.enabled) {
    req.user = { id: 'local', username: 'local', role: 'admin', workspaceId: null };
    return next();
  }
  if (req.method === 'OPTIONS') {
    return next();
  }
  if (OPEN_PATHS.has(req.path)) {
    return next();
  }

  const ssoUser = getSsoUserFromRequest(req);
  if (ssoUser) {
    req.user = ssoUser;
    return next();
  }

  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  return next();
}

function requireRole(requiredRole) {
  return (req, res, next) => {
    const config = getConfig();
    if (!config.auth?.enabled) return next();
    const user = req.user || getSsoUserFromRequest(req) || getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const userRank = ROLE_RANK[user.role] || 0;
    const requiredRank = ROLE_RANK[requiredRole] || 0;
    if (userRank < requiredRank) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    return next();
  };
}

function hasPermission(user, resource, action, config) {
  if (!user) return false;
  const rbac = config?.auth?.rbac || {};
  const roles = rbac.roles || {};
  const policy = roles[user.role];
  if (!policy) return false;
  return permissionAllowed(policy, resource, action);
}

function requirePermission(resource, action, fallbackRole = null) {
  return (req, res, next) => {
    const config = getConfig();
    if (!config.auth?.enabled) return next();

    const user = req.user || getSsoUserFromRequest(req) || getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const rbacEnabled = config.auth?.rbac?.enabled !== false;
    if (!rbacEnabled) {
      if (!fallbackRole) {
        req.user = user;
        return next();
      }
      const userRank = ROLE_RANK[user.role] || 0;
      const requiredRank = ROLE_RANK[fallbackRole] || 0;
      if (userRank < requiredRank) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.user = user;
      return next();
    }

    if (user.role === 'admin' && config.auth?.rbac?.allowAdminBypass !== false) {
      req.user = user;
      return next();
    }

    if (!hasPermission(user, resource, action, config)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    return next();
  };
}

module.exports = {
  issueToken,
  verifyToken,
  middleware,
  requireRole,
  getUserFromRequest,
  requirePermission,
  hasPermission
};
