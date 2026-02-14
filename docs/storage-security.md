# Storage, Security, and Encryption at Rest

CORTEX is local-first and stores data on disk. This guide explains where data is stored, how to control storage locations, and how to enable encryption at rest using OS tools.

## Local storage locations
Default locations are relative to the project root unless configured otherwise.

| File | Purpose | Default location |
| --- | --- | --- |
| `config.json` | Core configuration | Project root |
| `saved_prompts.json` | Saved prompts | Project root |
| `runs.json` | Run history and traces | Project root |
| `jobs.json` | Background job queue | Project root |
| `datasets.json` | Evaluation datasets | Project root |
| `evaluations.json` | Evaluation results | Project root |
| `evaluation_templates.json` | Rubric templates | Project root |
| `audit.log.jsonl` | Audit trail | Project root |
| `spawned_agents/` | Generated flight plans | Project root |
| `vector_index.json` | Semantic index metadata | Project root |

## Storage controls
You can change storage locations using:
- Settings > Workspaces
- Environment variables: `REPOS_ROOT`, `CORTEX_OUTPUT_DIR`
- Manual edits in `config.json`

Use per-workspace `reposRoot` and `outputDir` to isolate data between teams.

## Encryption at rest
CORTEX does not encrypt files itself. Use OS-level encryption for disks or folders:
- Windows: BitLocker or an encrypted VHD/VHDX volume
- macOS: FileVault
- Linux: LUKS or an encrypted volume

Recommended approach:
1. Create or enable an encrypted volume.
2. Store the CORTEX project directory and `reference-repos` on that volume.
3. Keep backups on encrypted media.

## Access control and auditability
- Enable authentication and RBAC in Settings for multi-user control.
- Use the Audit Trail to export security-relevant events.

## Data retention
Audit logs and runs are stored locally. If you need retention limits, schedule a periodic cleanup for older entries or move archives to secure storage.
