# safe_cleanup.ps1 — Delete Safe-tier reclaimable files only
# Generated from corrected classifier (scan-engine/src/categories.rs)
# Safe = .tmp, node_modules, .cache, thumbnails, __pycache__, target/,
#        appdata\local\temp, windows\temp, inetcache, thumbcache
# EXCLUDES: installed apps, AI models, VMs, downloads, user data

param(
    [switch]$DryRun = $false,
    [string]$TargetUser = "C:\Users\Aomega Imaging"
)

$ErrorActionPreference = "Continue"

# ---- Logging setup ----
$logDir = "E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\scripts\utility\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = Join-Path $logDir "safe_cleanup_$timestamp.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $line = "[$ts] [$Level] $Message"
    Add-Content -Path $logFile -Value $line -Encoding UTF8
    switch ($Level) {
        "ERROR"   { Write-Host $line -ForegroundColor Red }
        "WARN"    { Write-Host $line -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $line -ForegroundColor Green }
        "PROGRESS"{ Write-Host $line -ForegroundColor Cyan }
        default   { Write-Host $line }
    }
}

Write-Log "=== safe_cleanup.ps1 started ==="
Write-Log "Mode: $(if ($DryRun) { 'DRY-RUN' } else { 'LIVE DELETE' })"
Write-Log "Target: $TargetUser"
Write-Log "Log file: $logFile"

# Path-match rules from classify_reclaimability (Safe tier only)
$dirTreePatterns = @(
    'node_modules',
    '__pycache__',
    'target',
    '.cache',
    'thumbcache',
    'thumbnails'
)

$filePatterns = @(
    '\.tmp$'
)

$pathContainsPatterns = @(
    'appdata\local\temp',
    'windows\temp',
    'inetcache'
)

# ---- Discovery phase ----
Write-Log "=== Discovery phase: scanning $TargetUser ==="

$targets = @{ }
$scanStart = Get-Date
$scannedFiles = 0
$lastProgressAt = Get-Date

$allItems = Get-ChildItem -Path $TargetUser -Recurse -Force -ErrorAction SilentlyContinue
$totalItems = $allItems.Count
Write-Log "Total items to classify: $totalItems"

foreach ($item in $allItems) {
    $scannedFiles++
    $path = $item.FullName.ToLower()
    $isSafe = $false

    # Progress update every 2 seconds
    if (((Get-Date) - $lastProgressAt).TotalSeconds -ge 2) {
        $pct = [math]::Round(($scannedFiles / $totalItems) * 100, 1)
        $elapsed = (Get-Date) - $scanStart
        $rate = if ($elapsed.TotalSeconds -gt 0) { [math]::Round($scannedFiles / $elapsed.TotalSeconds, 0) } else { 0 }
        Write-Log "Scanning: $scannedFiles / $totalItems ($pct%) — $rate files/sec — safe dirs so far: $($targets.Count)" "PROGRESS"
        $lastProgressAt = Get-Date
    }

    foreach ($pattern in $dirTreePatterns) {
        $escaped = [regex]::Escape($pattern)
        if ($path -match "(^|[\/\\])$escaped([\/\\]|$)") {
            $isSafe = $true
            break
        }
    }

    if (-not $isSafe -and -not $item.PSIsContainer) {
        foreach ($pat in $filePatterns) {
            if ($item.Name -match $pat) {
                $isSafe = $true
                break
            }
        }
    }

    if (-not $isSafe) {
        foreach ($pat in $pathContainsPatterns) {
            if ($path.Contains($pat)) {
                $isSafe = $true
                break
            }
        }
    }

    if ($isSafe) {
        $dir = Split-Path $item.FullName -Parent
        if (-not $targets.ContainsKey($dir)) {
            $targets[$dir] = @{ files = 0; bytes = 0; paths = [System.Collections.ArrayList]::new() }
        }
        $targets[$dir].files++
        $targets[$dir].bytes += $item.Length
        [void]$targets[$dir].paths.Add($item.FullName)
    }
}

$scanElapsed = (Get-Date) - $scanStart
$totalBytes = ($targets.Values | Measure-Object -Property bytes -Sum).Sum
$totalFiles = ($targets.Values | Measure-Object -Property files -Sum).Sum

Write-Log "=== Discovery complete ==="
Write-Log "Scan duration: $([math]::Round($scanElapsed.TotalSeconds, 1))s"
Write-Log "Safe-tier directories: $($targets.Count)"
Write-Log "Safe-tier files: $totalFiles"
Write-Log "Safe-tier total size: $([math]::Round($totalBytes / 1GB, 2)) GB ($totalBytes bytes)"

# Show top directories
Write-Log "--- Top 30 directories by size ---"
$targets.GetEnumerator() | Sort-Object { $_.Value.bytes } -Descending | Select-Object -First 30 | ForEach-Object {
    $sz = [math]::Round($_.Value.bytes / 1MB, 2)
    Write-Log "  $sz MB  $($_.Value.files) files  $($_.Key)"
}

if ($DryRun) {
    Write-Log "DRY RUN — no files deleted. Exiting." "SUCCESS"
    Write-Host ""
    Write-Host "Log saved to: $logFile" -ForegroundColor Cyan
    return
}

# ---- Deletion phase ----
Write-Log "=== Deletion phase started ==="

$deletedFiles = 0
$deletedBytes = 0
$failed = 0
$failures = [System.Collections.ArrayList]::new()

# Build deduplicated removal roots
$topDirs = [System.Collections.ArrayList]::new()
foreach ($entry in $targets.GetEnumerator()) {
    [void]$topDirs.Add($entry.Key)
}
$topDirs.Sort()

$removalRoots = [System.Collections.ArrayList]::new()
foreach ($d in $topDirs) {
    $covered = $false
    foreach ($root in $removalRoots) {
        if ($d.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
            $covered = $true
            break
        }
    }
    if (-not $covered) {
        [void]$removalRoots.Add($d)
    }
}

$totalRoots = $removalRoots.Count
Write-Log "Deduplicated removal roots: $totalRoots (from $($targets.Count) safe dirs)"

$deleteStart = Get-Date
$rootIndex = 0
$lastDeleteProgressAt = Get-Date

foreach ($root in $removalRoots) {
    $rootIndex++
    $pct = [math]::Round(($rootIndex / $totalRoots) * 100, 1)

    # Progress update every 3 seconds
    if (((Get-Date) - $lastDeleteProgressAt).TotalSeconds -ge 3) {
        $elapsed = (Get-Date) - $deleteStart
        $rate = if ($elapsed.TotalSeconds -gt 0) { [math]::Round($deletedBytes / $elapsed.TotalSeconds / 1MB, 1) } else { 0 }
        $filesRate = if ($elapsed.TotalSeconds -gt 0) { [math]::Round($deletedFiles / $elapsed.TotalSeconds, 0) } else { 0 }
        $currentSz = [math]::Round(($targets[$root]?.bytes ?? 0) / 1MB, 1)
        Write-Log "Deleting: $rootIndex / $totalRoots ($pct%) — $([math]::Round($deletedBytes/1MB,0)) MB freed — $rate MB/s — $filesRate files/s" "PROGRESS"
        $lastDeleteProgressAt = Get-Date
    }

    if (Test-Path $root) {
        try {
            $dirSize = (Get-ChildItem $root -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            $dirFiles = (Get-ChildItem $root -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object).Count
            $dirSzMB = [math]::Round($dirSize / 1MB, 1)

            Write-Log "REMOVE: $root ($dirSzMB MB, $dirFiles files)"

            Remove-Item -Path $root -Recurse -Force -ErrorAction Stop

            $deletedFiles += $dirFiles
            $deletedBytes += $dirSize
            Write-Log "OK: Removed $root ($dirSzMB MB)" "SUCCESS"
        } catch {
            $failed++
            $errMsg = $_.Exception.Message
            [void]$failures.Add([PSCustomObject]@{ path = $root; error = $errMsg })
            Write-Log "FAILED: $root — $errMsg" "ERROR"
        }
    } else {
        Write-Log "SKIP: $root (already gone)" "WARN"
    }
}

$deleteElapsed = (Get-Date) - $deleteStart

# ---- Summary ----
Write-Log "=== Deletion phase complete ==="
Write-Log "Delete duration: $([math]::Round($deleteElapsed.TotalSeconds, 1))s"
Write-Log "Files deleted: $deletedFiles"
Write-Log "Bytes freed: $([math]::Round($deletedBytes / 1GB, 2)) GB ($deletedBytes bytes)"
Write-Log "Directories failed: $failed"
Write-Log "Average throughput: $([math]::Round($deletedBytes / $deleteElapsed.TotalSeconds / 1MB, 1)) MB/s"

if ($failed -gt 0) {
    Write-Log "--- Failure details ---"
    foreach ($f in $failures) {
        Write-Log "  FAIL: $($f.path) — $($f.error)" "ERROR"
    }
}

Write-Log "=== safe_cleanup.ps1 finished ===" "SUCCESS"

Write-Host ""
Write-Host "Log saved to: $logFile" -ForegroundColor Cyan
