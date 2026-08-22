# safe_cleanup_fast.ps1 — Delete Safe-tier reclaimable files
# Uses existing Rust scan JSON (no filesystem re-walk)
# Safe = .tmp, node_modules, .cache, thumbnails, __pycache__, target/,
#        appdata\local\temp, windows\temp, inetcache, thumbcache

param(
    [switch]$DryRun = $false,
    [string]$ScanJson = "E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\scan_engine_output.json"
)

$ErrorActionPreference = "Continue"

# ---- Logging ----
$logDir = "E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\scripts\utility\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$script:logFile = Join-Path $logDir "safe_cleanup_fast_$timestamp.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $line = "[$ts] [$Level] $Message"
    Add-Content -Path $script:logFile -Value $line -Encoding UTF8
    switch ($Level) {
        "ERROR"   { Write-Host $line -ForegroundColor Red }
        "WARN"    { Write-Host $line -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $line -ForegroundColor Green }
        "PROGRESS"{ Write-Host $line -ForegroundColor Cyan }
        default   { Write-Host $line }
    }
}

Write-Log "=== safe_cleanup_fast.ps1 started ==="
Write-Log "Mode: $(if ($DryRun) { 'DRY-RUN' } else { 'LIVE DELETE' })"
Write-Log "Scan JSON: $ScanJson"
Write-Log "Log: $logFile"

if (-not (Test-Path $ScanJson)) {
    Write-Log "Scan JSON not found: $ScanJson" "ERROR"
    Write-Log "Run: cargo run --release --bin space-analyzer-cli -- scan --path 'C:\Users\Aomega Imaging' --format json --include-hidden --deep --top 250 --files > $ScanJson" "ERROR"
    exit 1
}

# ---- Classification rules ----
$dirTreePatterns = @('node_modules', '__pycache__', 'target', '.cache', 'thumbcache', 'thumbnails')
$fileExtPatterns = @('\.tmp$')
$pathContainsPatterns = @('appdata\local\temp', 'windows\temp', 'inetcache')

# Protected paths: NEVER classify anything under these as safe, and refuse to
# recursively delete any directory at or below them. These hold irreplaceable
# user data (AI models, SSH keys, credentials) that looks deletable but isn't.
$protectedSegments = @('.ollama', '.ssh', '.gnupg', '.aws', '.azure', '.kube', '.docker')

function Test-ProtectedPath {
    param([string]$Path)
    $l = $Path.ToLower()
    foreach ($seg in $protectedSegments) {
        $escaped = [regex]::Escape($seg)
        if ($l -match "(^|[\/\\])$escaped([\/\\]|$)") { return $true }
    }
    return $false
}

function Test-SafePath {
    param([string]$Path)
    # Protected paths always win, whatever else matches.
    if (Test-ProtectedPath $Path) { return $false }
    $l = $Path.ToLower()
    # Strip \\?\ extended-length path prefix for consistent matching
    if ($l.StartsWith("\\?\")) { $l = $l.Substring(4) }

    foreach ($pattern in $dirTreePatterns) {
        $escaped = [regex]::Escape($pattern)
        if ($l -match "(^|[\/\\])$escaped([\/\\]|$)") { return $true }
    }

    foreach ($pat in $fileExtPatterns) {
        if ($Path -match $pat) { return $true }
    }

    foreach ($pat in $pathContainsPatterns) {
        if ($l.Contains($pat)) { return $true }
    }

    return $false
}

function Strip-PathPrefix {
    param([string]$Path)
    if ($Path.StartsWith("\\?\")) { return $Path.Substring(4) }
    return $Path
}

# ---- Parse JSON ----
Write-Log "=== Parsing scan JSON ==="
$parseStart = Get-Date

# Find the start of the JSON object (skip any warning lines)
$raw = [System.IO.File]::ReadAllText($ScanJson, [System.Text.Encoding]::UTF8)
$jsonStart = $raw.IndexOf('{')
if ($jsonStart -lt 0) {
    Write-Log "No JSON object found in $ScanJson" "ERROR"
    exit 1
}
$jsonStr = $raw.Substring($jsonStart)

# Parse with Newtonsoft-style depth — use System.Text.Json via PowerShell 7+
$json = $jsonStr | ConvertFrom-Json -AsHashTable
$allFiles = $json['scanned_files']

$parseElapsed = (Get-Date) - $parseStart
Write-Log "Parsed $($allFiles.Count) files in $([math]::Round($parseElapsed.TotalSeconds,1))s"

# ---- Classify ----
Write-Log "=== Classifying files ==="
$classStart = Get-Date

$safeFiles = [System.Collections.ArrayList]::new()
$safeBytes = [long]0
$totalFiles = $allFiles.Count
$processed = 0
$lastProgress = Get-Date

foreach ($entry in $allFiles.GetEnumerator()) {
    $path = $entry.Key
    $size = $entry.Value[0]

    $processed++
    if (((Get-Date) - $lastProgress).TotalSeconds -ge 2) {
        $pct = [math]::Round(($processed / $totalFiles) * 100, 1)
        Write-Log "Classifying: $processed / $totalFiles ($pct%) — safe so far: $($safeFiles.Count)" "PROGRESS"
        $lastProgress = Get-Date
    }

    if (Test-SafePath $path) {
        $cleanDir = Strip-PathPrefix ($path | Split-Path -Parent)
        [void]$safeFiles.Add([PSCustomObject]@{ path = $path; size = $size; dir = $cleanDir })
        $safeBytes += $size
    }
}

$classElapsed = (Get-Date) - $classStart
Write-Log "Classification complete: $($safeFiles.Count) safe files, $([math]::Round($safeBytes / 1GB, 2)) GB"
Write-Log "Classification rate: $([math]::Round($totalFiles / $classElapsed.TotalSeconds, 0)) files/sec"

# ---- Group by directory (dedup nested) ----
Write-Log "=== Building deduplicated removal list ==="
$dirGroups = @{}
foreach ($f in $safeFiles) {
    if (-not $dirGroups.ContainsKey($f.dir)) {
        $dirGroups[$f.dir] = @{ files = 0; bytes = [long]0 }
    }
    $dirGroups[$f.dir].files++
    $dirGroups[$f.dir].bytes += $f.bytes
}

# Sort and deduplicate nested dirs — O(n log n) single pass
# After sorting, a child always comes after its parent, so we only
# need to check against the last kept root (not all previous roots).
$topDirs = $dirGroups.Keys | Sort-Object
$removalRoots = [System.Collections.ArrayList]::new()
$lastRoot = ""
foreach ($d in $topDirs) {
    if ($lastRoot -ne "" -and ($d.StartsWith($lastRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or $d.Equals($lastRoot, [StringComparison]::OrdinalIgnoreCase))) {
        continue
    }
    [void]$removalRoots.Add($d)
    $lastRoot = $d
}

Write-Log "Removal roots: $($removalRoots.Count) (from $($dirGroups.Count) safe dirs)"

# ---- Per-root expectations (verify-before-delete guard) ----
# A removal root is deleted with -Recurse, so ANY unclassified file inside it
# would be destroyed too. Record exactly what we expect under each root so the
# deletion phase can verify and fall back to per-file deletion on mismatch.
$dirToRoot = @{}
$rootExpected = @{}
$rootFiles = @{}
$lastRoot = ""
foreach ($d in $topDirs) {
    if ($lastRoot -ne "" -and ($d.StartsWith($lastRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or $d.Equals($lastRoot, [StringComparison]::OrdinalIgnoreCase))) {
        $dirToRoot[$d] = $lastRoot
    } else {
        $dirToRoot[$d] = $d
        $lastRoot = $d
    }
}
foreach ($f in $safeFiles) {
    $r = $dirToRoot[$f.dir]
    if (-not $r) { continue }
    if (-not $rootExpected[$r]) { $rootExpected[$r] = @{ files = 0; bytes = [long]0 } }
    $rootExpected[$r].files++
    $rootExpected[$r].bytes += $f.size
    if (-not $rootFiles[$r]) { $rootFiles[$r] = [System.Collections.ArrayList]::new() }
    [void]$rootFiles[$r].Add($f.path)
}

# Show top 30
$dirGroups.GetEnumerator() | Sort-Object { $_.Value.bytes } -Descending | Select-Object -First 30 | ForEach-Object {
    $sz = [math]::Round($_.Value.bytes / 1MB, 2)
    Write-Log "  $sz MB  $($_.Value.files) files  $($_.Key)"
}

if ($DryRun) {
    Write-Log "DRY RUN — no files deleted." "SUCCESS"
    Write-Host "`nLog: $logFile" -ForegroundColor Cyan
    return
}

# ---- Deletion ----
Write-Log "=== Deletion phase started ==="
$deleteStart = Get-Date
$deletedFiles = [long]0
$deletedBytes = [long]0
$failed = 0
$failures = [System.Collections.ArrayList]::new()
$rootIndex = 0
$lastDeleteProgress = Get-Date

foreach ($root in $removalRoots) {
    # Defense in depth: never recursively delete anything protected, even if
    # classification somehow let it through.
    if (Test-ProtectedPath $root) {
        Write-Log "SKIP (protected): $root" "WARN"
        continue
    }
    $rootIndex++
    $pct = [math]::Round(($rootIndex / $removalRoots.Count) * 100, 1)

    if (((Get-Date) - $lastDeleteProgress).TotalSeconds -ge 3) {
        $elapsed = (Get-Date) - $deleteStart
        $mbRate = if ($elapsed.TotalSeconds -gt 0) { [math]::Round($deletedBytes / $elapsed.TotalSeconds / 1MB, 1) } else { 0 }
        $fileRate = if ($elapsed.TotalSeconds -gt 0) { [math]::Round($deletedFiles / $elapsed.TotalSeconds, 0) } else { 0 }
        Write-Log "Deleting: $rootIndex / $($removalRoots.Count) ($pct%) — $([math]::Round($deletedBytes/1MB,0)) MB freed — $mbRate MB/s — $fileRate files/s" "PROGRESS"
        $lastDeleteProgress = Get-Date
    }

    if (Test-Path $root) {
        try {
            # Fast count and size via enumeration
            $dirFiles = [long]0
            $dirBytes = [long]0
            Get-ChildItem -Path $root -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                $dirFiles++
                $dirBytes += $_.Length
            }

            # ---- Verify-before-delete guard ----
            # If the directory contains more data than we classified (e.g. one
            # stray .tmp next to gigabytes of real data), do NOT delete it
            # recursively. Delete only the individually classified files.
            $expected = $rootExpected[$root]
            $expFiles = if ($expected) { [int]$expected.files } else { 0 }
            $expBytes = if ($expected) { [long]$expected.bytes } else { [long]0 }
            $sizeSlack = [long]1MB + [long]($expBytes * 0.05)
            if ($dirFiles -gt ($expFiles + 5) -or $dirBytes -gt ($expBytes + $sizeSlack)) {
                Write-Log ("GUARD: {0} holds unclassified data (found {1} files/{2} MB, classified {3}/{4} MB) — deleting classified files only" -f `
                    $root, $dirFiles, [math]::Round($dirBytes/1MB,1), $expFiles, [math]::Round($expBytes/1MB,1)) "WARN"
                $keptBytes = [long]0
                $keptCount = 0
                foreach ($p in $rootFiles[$root]) {
                    if (Test-Path -LiteralPath $p) {
                        try {
                            $sz = (Get-Item -LiteralPath $p -Force).Length
                            Remove-Item -LiteralPath $p -Force -ErrorAction Stop
                            $keptBytes += $sz
                            $keptCount++
                        } catch { }
                    }
                }
                $deletedFiles += $keptCount
                $deletedBytes += $keptBytes
                Write-Log "OK (per-file): $root ($([math]::Round($keptBytes/1MB,1)) MB, $keptCount files)" "SUCCESS"
                continue
            }

            Remove-Item -Path $root -Recurse -Force -ErrorAction Stop

            $deletedFiles += $dirFiles
            $deletedBytes += $dirBytes
            Write-Log "OK: $root ($([math]::Round($dirBytes/1MB,1)) MB, $dirFiles files)" "SUCCESS"
        } catch {
            $failed++
            [void]$failures.Add([PSCustomObject]@{ path = $root; error = $_.Exception.Message })
            Write-Log "FAILED: $root — $($_.Exception.Message)" "ERROR"
        }
    } else {
        Write-Log "SKIP: $root (gone)" "WARN"
    }
}

$deleteElapsed = (Get-Date) - $deleteStart

# ---- Summary ----
Write-Log "=== Deletion complete ==="
Write-Log "Duration: $([math]::Round($deleteElapsed.TotalSeconds,1))s"
Write-Log "Files deleted: $deletedFiles"
Write-Log "Bytes freed: $([math]::Round($deletedBytes / 1GB, 2)) GB ($deletedBytes)"
Write-Log "Failed: $failed"
if ($deleteElapsed.TotalSeconds -gt 0) {
    Write-Log "Throughput: $([math]::Round($deletedBytes / $deleteElapsed.TotalSeconds / 1MB, 1)) MB/s"
}
if ($failed -gt 0) {
    Write-Log "--- Failures ---"
    foreach ($f in $failures) {
        Write-Log "  FAIL: $($f.path) — $($f.error)" "ERROR"
    }
}
Write-Log "=== safe_cleanup_fast.ps1 finished ===" "SUCCESS"
Write-Host "`nLog: $logFile" -ForegroundColor Cyan
