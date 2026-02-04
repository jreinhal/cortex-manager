/**
 * Workspace utilities for multi-tenant routing.
 */

const { getConfig, updateConfig, createDirectoryStructure, getDefaultReposRoot, getDefaultOutputDir } = require('./config');

const DEFAULT_WORKSPACE_ID = 'default';

function listWorkspaces() {
  const config = getConfig();
  return Array.isArray(config.workspaces?.items) ? config.workspaces.items : [];
}

function getDefaultWorkspace() {
  const config = getConfig();
  const defaultId = config.workspaces?.defaultId || DEFAULT_WORKSPACE_ID;
  const workspaces = listWorkspaces();
  return workspaces.find((ws) => ws.id === defaultId) || workspaces[0] || {
    id: defaultId,
    name: 'Default Workspace',
    reposRoot: config.reposRoot || getDefaultReposRoot(),
    outputDir: config.outputDir || getDefaultOutputDir()
  };
}

function getWorkspaceById(id) {
  if (!id) return null;
  return listWorkspaces().find((ws) => ws.id === id) || null;
}

function isDefaultWorkspace(id) {
  const config = getConfig();
  const defaultId = config.workspaces?.defaultId || DEFAULT_WORKSPACE_ID;
  return id === defaultId || (!id && defaultId === DEFAULT_WORKSPACE_ID);
}

function resolveWorkspaceId(req) {
  const config = getConfig();
  const defaultId = config.workspaces?.defaultId || DEFAULT_WORKSPACE_ID;
  const headerId = req?.headers ? (req.headers['x-workspace-id'] || req.headers['x-cortex-workspace']) : null;
  const queryId = req?.query?.workspaceId || req?.query?.workspace || null;
  const bodyId = req?.body?.workspaceId || null;
  const requested = headerId || queryId || bodyId;

  const userWorkspace = req?.user?.workspaceId || null;
  const isAdmin = req?.user?.role === 'admin';
  if (requested && getWorkspaceById(requested)) {
    if (isAdmin || requested === userWorkspace) {
      return requested;
    }
  }
  return userWorkspace && getWorkspaceById(userWorkspace) ? userWorkspace : defaultId;
}

function resolveWorkspace(req) {
  const workspaceId = resolveWorkspaceId(req);
  return getWorkspaceById(workspaceId) || getDefaultWorkspace();
}

function upsertWorkspace(payload = {}) {
  const config = getConfig();
  const items = Array.isArray(config.workspaces?.items) ? [...config.workspaces.items] : [];
  const id = payload.id || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const idx = items.findIndex((ws) => ws.id === id);
  const workspace = {
    id,
    name: payload.name || payload.id || 'Workspace',
    reposRoot: payload.reposRoot || getDefaultReposRoot(),
    outputDir: payload.outputDir || getDefaultOutputDir(),
    createdAt: payload.createdAt || new Date().toISOString()
  };
  if (idx === -1) {
    items.push(workspace);
  } else {
    items[idx] = { ...items[idx], ...workspace };
  }

  const updated = updateConfig({
    workspaces: {
      ...config.workspaces,
      items
    }
  });

  if (payload.createStructure) {
    createDirectoryStructure(workspace.reposRoot);
  }

  return updated?.workspaces?.items?.find((ws) => ws.id === id) || workspace;
}

function removeWorkspace(id) {
  const config = getConfig();
  const items = Array.isArray(config.workspaces?.items) ? [...config.workspaces.items] : [];
  const defaultId = config.workspaces?.defaultId || DEFAULT_WORKSPACE_ID;
  if (id === defaultId) {
    return { success: false, error: 'Cannot delete the default workspace.' };
  }
  const next = items.filter((ws) => ws.id !== id);
  if (next.length === items.length) {
    return { success: false, error: 'Workspace not found.' };
  }
  updateConfig({
    workspaces: {
      ...config.workspaces,
      items: next
    }
  });
  return { success: true };
}

module.exports = {
  DEFAULT_WORKSPACE_ID,
  listWorkspaces,
  getDefaultWorkspace,
  getWorkspaceById,
  resolveWorkspaceId,
  resolveWorkspace,
  upsertWorkspace,
  removeWorkspace,
  isDefaultWorkspace
};
