<#
.SYNOPSIS
    Master update script for all reference repositories and agent skills.

.DESCRIPTION
    1. Reads D:\Projects\reference-repos\repos.json and pulls enabled repos.
    2. Syncs 'antigravity-awesome-skills' to Claude, Gemini, and Codex folders.

.EXAMPLE
    .\update-all-repos.ps1
#>

$ErrorActionPreference = 'Stop'
$LogFile = "$env:TEMP\update-reference-repos.log"
$RepoRegistry = "D:\Projects\reference-repos\_system\repos.json"
$SkillSourceRepo = "D:\Projects\reference-repos\skills\antigravity-awesome-skills"
$ManagerScript = "D:\Projects\reference-repos\_system\manage-reference-repos.ps1"

# 0. AUTO-DISCOVER NEW REPOS
if (Test-Path $ManagerScript) {
    Write-Host "Auto-scanning for new repositories..." -ForegroundColor Cyan
    & $ManagerScript -Scan | Out-Null
}

# --- HELPER FUNCTIONS ---

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] $Message"
    Write-Host $Message -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $logLine
}

function Sync-Skills {
    param(
        [string]$RepoPath,
        [string]$DestPath,
        [string]$BackupRoot = "D:\skills-backups",
        [string]$Name = "Unknown"
    )

    Write-Log "  Syncing $Name Skills from $RepoPath to $DestPath" "Cyan"
    
    if (-not (Test-Path $RepoPath)) {
        Write-Log "    Error: Source repo not found" "Red"
        return
    }
    
    if (-not (Test-Path $DestPath)) {
        New-Item -ItemType Directory -Force -Path $DestPath | Out-Null
    }
    
    # 1. Identify New/Modified
    $upstreamSkills = Get-ChildItem -Path "$RepoPath\skills" -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
    $localSkills = Get-ChildItem -Path "$DestPath\skills" -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
    
    if (-not $upstreamSkills) {
        # Fallback default
        $upstreamSkills = Get-ChildItem -Path $RepoPath -Directory | Where-Object { $_.Name -ne ".git" } | Select-Object -ExpandProperty Name
        $localSkills = Get-ChildItem -Path $DestPath -Directory | Select-Object -ExpandProperty Name
    }

    $newSkills = $upstreamSkills | Where-Object { $_ -notin $localSkills }
    $existingSkills = $upstreamSkills | Where-Object { $_ -in $localSkills }
    
    $modifiedSkills = @()
    foreach ($skill in $existingSkills) {
        $upstreamFile = "$RepoPath\skills\$skill\SKILL.md"
        $localFile = "$DestPath\skills\$skill\SKILL.md"
        
        if ((Test-Path $upstreamFile) -and (Test-Path $localFile)) {
            $uHash = (Get-FileHash $upstreamFile).Hash
            $lHash = (Get-FileHash $localFile).Hash
            if ($uHash -ne $lHash) { $modifiedSkills += $skill }
        }
    }
    
    if (($newSkills.Count -eq 0) -and ($modifiedSkills.Count -eq 0)) {
        Write-Log "    Up to date." "Green"
        return
    }

    # 2. Backup Modified
    if ($modifiedSkills.Count -gt 0) {
        $backupPath = "$BackupRoot\$Name\$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
        
        foreach ($skill in $modifiedSkills) {
            Copy-Item -Path "$DestPath\skills\$skill" -Destination "$backupPath\$skill" -Recurse
        }
        Write-Log "    Backed up modified skills to: $backupPath" "Gray"
    }

    # 3. Apply Changes
    foreach ($skill in $newSkills) {
        Copy-Item -Path "$RepoPath\skills\$skill" -Destination "$DestPath\skills\$skill" -Recurse -Force
        Write-Log "    + Added: $skill" "Green"
    }
    foreach ($skill in $modifiedSkills) {
        Copy-Item -Path "$RepoPath\skills\$skill" -Destination "$DestPath\skills\$skill" -Recurse -Force
        Write-Log "    ~ Updated: $skill" "Yellow"
    }

    # Sync Root Files
    $rootFiles = @("README.md", "CATALOG.md", "skills_index.json")
    foreach ($file in $rootFiles) {
        if (Test-Path "$RepoPath\$file") {
            Copy-Item -Path "$RepoPath\$file" -Destination "$DestPath\$file" -Force
        }
    }
}

# --- MAIN LOGIC ---

Write-Log "=== Starting Daily Updates ===" "Cyan"

# A. UPDATE REPOS
if (Test-Path $RepoRegistry) {
    $repos = Get-Content -Path $RepoRegistry | ConvertFrom-Json
    foreach ($repo in $repos) {
        if ($repo.Enabled) {
            Write-Log "Updating Repo: $($repo.Name)..." "Yellow"
            if (Test-Path $repo.Path) {
                Push-Location $repo.Path
                try {
                    $output = git pull origin $($repo.Branch) 2>&1
                    Write-Log "  Result: $output" "Green"
                }
                catch {
                    Write-Log "  Error: $_" "Red"
                }
                finally {
                    Pop-Location
                }
            }
        }
    }
}

# B. DEPLOY SKILLS
Write-Log "=== Deploying Skills ===" "Magenta"

Sync-Skills -RepoPath $SkillSourceRepo -DestPath "D:\claude-skills" -Name "Claude"
Sync-Skills -RepoPath $SkillSourceRepo -DestPath "D:\gemini-skills" -Name "Gemini"
Sync-Skills -RepoPath $SkillSourceRepo -DestPath "D:\codex-skills"  -Name "Codex"

Write-Log "=== All Tasks Complete ===" "Cyan"
