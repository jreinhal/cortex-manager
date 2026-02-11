/**
 * CLI entrypoint for rebuilding the vector index.
 *
 * Intended for detached/background runs, e.g. after downloading external skills.
 */

const config = require('./config');
const vectorIndex = require('./vector-index');

async function main() {
  const cfg = config.getConfig();
  const reposRoot = process.env.REPOS_ROOT || cfg.reposRoot;
  const workspaceId = process.env.CORTEX_WORKSPACE_ID || null;

  const summary = await vectorIndex.rebuildIndex({ workspaceId, reposRoot });
  // Keep stdout minimal; detached runs may ignore stdio.
  console.log(JSON.stringify({ ok: true, summary }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }, null, 2));
  process.exitCode = 1;
});

