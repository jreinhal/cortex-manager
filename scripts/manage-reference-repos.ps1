<#
.SYNOPSIS
    Manage reference repos - auto-setup scheduled tasks and track in documentation

.DESCRIPTION
    Scans D:\Projects\reference-repos for git repos, adds them to repos.json,
    and updates the agent documentation.

.PARAMETER Scan
    Scan for new repos and add them to the registry

.PARAMETER List
    List all tracked repos and their status

.PARAMETER Add
    Clone a new repo and add it to the registry (provide URL)

.PARAMETER Remove
    Remove a repo from the registry (provide repo name)

.EXAMPLE
    .\manage-reference-repos.ps1 -Scan
    .\manage-reference-repos.ps1 -Add "https://github.com/user/repo"
    .\manage-reference-repos.ps1 -List
#>

param(
    [switch]$Scan,
    [switch]$List,
    [string]$Add,
    [string]$Remove,
    [string]$ReposRoot = "D:\Projects\reference-repos"
)

$ErrorActionPreference = 'Stop'

$ReposDir = $ReposRoot
$DocsFile = Join-Path $ReposRoot "README.md"
$SystemDir = Join-Path $ReposRoot "_system"
if (-not (Test-Path $SystemDir)) { New-Item -ItemType Directory -Path $SystemDir -Force | Out-Null }

$RegistryFile = Join-Path $SystemDir "repos.json"
$MasterTaskName = "Update-Reference-Repos-Master"
$MasterScript = Join-Path $SystemDir "update-all-repos.ps1"

# Load Registry
function Get-Registry {
    if (Test-Path $RegistryFile) {
        return @(Get-Content -Path $RegistryFile | ConvertFrom-Json)
    }
    return @()
}

function Save-Registry {
    param($Data)
    $Data | ConvertTo-Json -Depth 5 | Out-File -FilePath $RegistryFile -Encoding UTF8
}

# Helper: Get repo name from path
function Get-RepoName {
    param([string]$Path)
    return (Split-Path $Path -Leaf)
}

# Helper: Check if path is a git repo
function Test-GitRepo {
    param([string]$Path)
    return (Test-Path (Join-Path $Path ".git"))
}

# Ensure Master Task Exists
function Initialize-MasterTask {
    $task = Get-ScheduledTask -TaskName $MasterTaskName -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-Host "Setting up Master Scheduled Task..." -ForegroundColor Yellow
        $action = New-ScheduledTaskAction -Execute "powershell" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$MasterScript`""
        $trigger = New-ScheduledTaskTrigger -Daily -At "9:00am"
        $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
        
        Register-ScheduledTask -TaskName $MasterTaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Auto-update all reference repos registered in repos.json" | Out-Null
        Write-Host "  Created Master Task: $MasterTaskName" -ForegroundColor Green
    }
}

# Helper: Add repo to registry
function Register-Repo {
    param([string]$RepoPath)
    
    $registry = Get-Registry
    $repoName = Get-RepoName $RepoPath
    
    # Check if already exists
    $existing = $registry | Where-Object { $_.Name -eq $repoName }
    
    if ($existing) {
        if ($existing.Path -ne $RepoPath) {
            Write-Host "  Repo moved: $repoName" -ForegroundColor Cyan
            Write-Host "    Old: $($existing.Path)" -ForegroundColor Gray
            Write-Host "    New: $RepoPath" -ForegroundColor Gray
             
            # Remove old entry and fall through to re-add
            $registry = @($registry | Where-Object { $_.Name -ne $repoName })
        }
        else {
            Write-Host "  Already tracked: $repoName" -ForegroundColor Gray
            return $false
        }
    }
    
    # Get default branch
    Push-Location $RepoPath
    $defaultBranch = git symbolic-ref refs/remotes/origin/HEAD 2>$null
    if ($defaultBranch) {
        $defaultBranch = $defaultBranch -replace 'refs/remotes/origin/', ''
    }
    else {
        $defaultBranch = 'main' 
    }
    Pop-Location
    
    # Add to list
    $newItem = @{
        Name    = $repoName
        Path    = $RepoPath
        Branch  = $defaultBranch
        Enabled = $true
    }
    
    $registry += $newItem
    Save-Registry $registry
    
    Write-Host "  Added to registry: $repoName (branch: $defaultBranch)" -ForegroundColor Green
    return $true
}

# Helper: Update documentation
function Update-Documentation {
    $registry = Get-Registry
    
    $content = @"
# Reference Repositories

Auto-managed by `manage-reference-repos.ps1`. Do not edit manually.

**Last Updated:** $(Get-Date -Format "yyyy-MM-dd HH:mm")

---

## Tracked Repositories

| Repository | Path | Branch | Enabled | Purpose |
|------------|------|--------|---------|---------|
"@

    foreach ($item in $registry) {
        Push-Location $item.Path
        $remote = git remote get-url origin 2>$null
        Pop-Location

        $status = if ($item.Enabled) { "✅ Yes" } else { "❌ No" }

        # Determine purpose based on directory location
        $parentDir = Split-Path (Split-Path $item.Path) -Leaf
        $purpose = switch ($parentDir) {
            "agents" { "Agent Engine" }
            "skills" { "Skill Bundle" }
            "knowledge" { "Knowledge Resource" }
            "tools" { "Tool / Utility" }
            "benchmarks" { "Benchmark Suite" }
            default {
                # Fallback to name-based classification
                switch -Wildcard ($item.Name) {
                    "*skill*" { "Claude Code skills" }
                    "*agent*" { "Agent patterns" }
                    "*awesome*" { "Curated resources" }
                    "*security*" { "Security tools" }
                    "*pentest*" { "Penetration testing" }
                    default { "Reference" }
                }
            }
        }

        $content += "`n| [$($item.Name)]($remote) | ``$($item.Path)`` | $($item.Branch) | $status | $purpose |"
    }

    $content += @"

---

## Schedule
**Batch Update Task:** ``$MasterTaskName``
- Runs Daily at **9:00 AM**
- Config: `D:\Projects\reference-repos\_system\repos.json`

## Management Commands

``````powershell
# Scan for new repos and add to registry
.\manage-reference-repos.ps1 -Scan

# Add a new repo
.\manage-reference-repos.ps1 -Add "https://github.com/user/repo"

# List all tracked repos
.\manage-reference-repos.ps1 -List

# Remove a repo from tracking
.\manage-reference-repos.ps1 -Remove "repo-name"
``````

*Auto-generated by manage-reference-repos.ps1*
"@

    $content | Out-File -FilePath $DocsFile -Encoding UTF8
    Write-Host "Updated documentation: $DocsFile" -ForegroundColor Cyan
}

# Main logic
Write-Host "=== Reference Repos Manager (Consolidated) ===" -ForegroundColor Cyan
Initialize-MasterTask
Write-Host ""

if ($List -or (-not $Scan -and -not $Add -and -not $Remove)) {
    Write-Host "Registry Content ($RegistryFile):" -ForegroundColor Yellow
    $registry = Get-Registry
    $registry | Format-Table Name, Branch, Enabled, Path -AutoSize
}

if ($Scan) {
    Write-Host "Scanning for repos (recursive)..." -ForegroundColor Yellow
    # Recurse Depth 2 to find repos inside agents/ or knowledge/ but not too deep
    $repos = Get-ChildItem -Path $ReposDir -Directory -Recurse -Depth 2 | Where-Object { Test-GitRepo $_.FullName }
    $newCount = 0
    
    foreach ($repo in $repos) {
        # Add to git safe directories
        git config --global --add safe.directory $repo.FullName 2>$null
        
        if (Register-Repo $repo.FullName) {
            $newCount++
        }
    }
    
    Update-Documentation
}

# Helper: Analyze repo content to determine category
function Measure-RepoContent {
    param([string]$Path)
    
    $scores = @{
        "agents"     = 0
        "skills"     = 0
        "knowledge"  = 0
        "tools"      = 0
        "benchmarks" = 0
    }

    # 1. Check Files
    if (Test-Path "$Path\Dockerfile") { $scores["agents"] += 3 }
    if (Test-Path "$Path\agent.py") { $scores["agents"] += 3 }
    if (Test-Path "$Path\setup.py") { $scores["tools"] += 2 }
    if (Test-Path "$Path\package.json") { $scores["tools"] += 1 }
    if (Test-Path "$Path\Cargo.toml") { $scores["tools"] += 2 }

    # 2. Check Directories
    if (Test-Path "$Path\prompts") { $scores["skills"] += 5 }
    if (Test-Path "$Path\instructions") { $scores["skills"] += 4 }
    if (Test-Path "$Path\evals") { $scores["benchmarks"] += 5 }
    if (Test-Path "$Path\benchmark") { $scores["benchmarks"] += 5 }
    if (Test-Path "$Path\papers") { $scores["knowledge"] += 4 }
    if (Test-Path "$Path\bin") { $scores["tools"] += 2 }
    if (Test-Path "$Path\cli") { $scores["tools"] += 3 }

    # 3. Check README Keywords
    $readmePath = Join-Path $Path "README.md"
    if (Test-Path $readmePath) {
        $content = Get-Content $readmePath -Raw -ErrorAction SilentlyContinue
        if ($content) {
            if ($content -match "autonomous agent") { $scores["agents"] += 2 }
            if ($content -match "prompt engineering") { $scores["skills"] += 2 }
            if ($content -match "benchmark result") { $scores["benchmarks"] += 2 }
            if ($content -match "cli tool") { $scores["tools"] += 2 }
            if ($content -match "collection of") { $scores["knowledge"] += 1 }
            if ($content -match "awesome-") { $scores["knowledge"] += 3 }
        }
    }

    # 4. Name Heuristics
    $repoName = Split-Path $Path -Leaf
    if ($repoName -match "^Awesome-") { $scores["knowledge"] += 10 }
    if ($repoName -match "skill") { $scores["skills"] += 2 }
    if ($repoName -match "bench") { $scores["benchmarks"] += 2 }

    # Determine Winner
    $winner = ($scores.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key
    
    # Validation/Safety threshold (optional, for now just trust the winner)
    # Default to knowledge if score is 0?
    if ($scores[$winner] -eq 0) { return "knowledge" }
    
    return $winner
}

if ($Add) {
    Write-Host "Cloning: $Add" -ForegroundColor Yellow
    $repoName = [System.IO.Path]::GetFileNameWithoutExtension($Add.TrimEnd('/').Split('/')[-1])
    
    # 1. Clone to Temp
    $tempDir = Join-Path $env:TEMP "ref-repo-staging-$repoName"
    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
    
    Write-Host "  Stage 1: Cloning to temp..." -ForegroundColor Gray
    git clone $Add $tempDir | Out-Null
    
    if (-not (Test-Path $tempDir)) {
        Write-Error "Failed to clone repository."
    }

    # 2. Analyze
    Write-Host "  Stage 2: Analyzing content..." -ForegroundColor Gray
    $category = Measure-RepoContent $tempDir
    Write-Host "  Detected Category: " -NoNewline
    Write-Host $category.ToUpper() -ForegroundColor Cyan

    # 3. Move to Final Destination
    $destParent = Join-Path $ReposDir $category
    if (-not (Test-Path $destParent)) { New-Item -ItemType Directory -Path $destParent | Out-Null }
    
    $destPath = Join-Path $destParent $repoName
    
    if (Test-Path $destPath) {
        Write-Host "  Repo already exists at: $destPath" -ForegroundColor Yellow
        Remove-Item $tempDir -Recurse -Force
    }
    else {
        Move-Item $tempDir $destPath
        Write-Host "  Moved to: $destPath" -ForegroundColor Green
    }
    
    git config --global --add safe.directory $destPath
    Register-Repo $destPath
    Update-Documentation
}

if ($Remove) {
    $registry = Get-Registry
    $target = $registry | Where-Object { $_.Name -eq $Remove }
    
    if ($target) {
        $registry = $registry | Where-Object { $_.Name -ne $Remove }
        Save-Registry $registry
        Write-Host "Removed $Remove from registry." -ForegroundColor Green
        Update-Documentation
    }
    else {
        Write-Host "Repo not found in registry: $Remove" -ForegroundColor Red
    }
}
