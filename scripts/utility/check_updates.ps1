#Requires -Version 7
<#
.SYNOPSIS
    Comprehensive update checker: portable apps, winget, and code dependencies.
.DESCRIPTION
    Checks for updates across three sources:
    1. Portable apps - compares installed versions against GitHub API, Mozilla
    2. Winget - checks Windows Package Manager for available updates
    3. Code dependencies - scans package.json, requirements.txt, Cargo.toml on E: drive
.PARAMETER OutputFormat
    Output format: 'table' (default), 'json', or 'csv'
.PARAMETER DependencyPaths
    Additional directories to scan for code dependencies
.PARAMETER SkipPortable
    Skip portable app online version checks
.PARAMETER SkipWinget
    Skip winget check
.PARAMETER SkipDependencies
    Skip dependency scanning
.EXAMPLE
    pwsh .\check_updates.ps1
    pwsh .\check_updates.ps1 -SkipDependencies
    pwsh .\check_updates.ps1 -DependencyPaths "E:\MyProjects"
#>
param(
    [ValidateSet('table', 'json', 'csv')]
    [string]$OutputFormat = 'table',

    [string[]]$ScanPaths = @(),

    [string[]]$DependencyPaths = @(),

    [switch]$SkipPortable,

    [switch]$SkipWinget,

    [switch]$SkipDependencies,

    [switch]$ExportHtml,

    [switch]$Dashboard
)

$ErrorActionPreference = 'Continue'

# ── Version Comparison ────────────────────────────────────────

function Compare-Versions {
    param([string]$Current, [string]$Latest)
    if (-not $Current -or -not $Latest) { return 'unknown' }
    if ($Current -eq $Latest) { return 'current' }
    $c = $Current -replace '[^0-9.]', '' -replace '\.$', ''
    $l = $Latest -replace '[^0-9.]', '' -replace '\.$', ''
    if (-not $c -or -not $l) { return 'unknown' }
    try {
        $cp = @($c -split '\.' | ForEach-Object { [int]$_ })
        $lp = @($l -split '\.' | ForEach-Object { [int]$_ })
        while ($cp.Count -lt $lp.Count) { $cp += 0 }
        while ($lp.Count -lt $cp.Count) { $lp += 0 }
        for ($i = 0; $i -lt $cp.Count; $i++) {
            if ($cp[$i] -lt $lp[$i]) { return 'outdated' }
            if ($cp[$i] -gt $lp[$i]) { return 'newer' }
        }
        return 'current'
    } catch { return 'unknown' }
}

# ── HTTP Helper (PowerShell 7) ──────────────────────────────

function Invoke-SafeApi {
    param([string]$Url)
    try {
        return Invoke-RestMethod -Uri $Url -TimeoutSec 20 -UserAgent 'SpaceAnalyzer/1.0' -ErrorAction Stop
    } catch {
        return $null
    }
}

# ── Version APIs ──────────────────────────────────────────────

function Get-GitHubLatestRelease {
    param([string]$Owner, [string]$Repo)
    $r = Invoke-SafeApi -Url "https://api.github.com/repos/$Owner/$Repo/releases/latest"
    if ($r) { return $r.tag_name -replace '^v', '' }
    return $null
}

function Get-FirefoxLatestVersion {
    $r = Invoke-SafeApi -Url 'https://product-details.mozilla.org/1.0/firefox_versions.json'
    if ($r) { return $r.LATEST_FIREFOX_VERSION }
    return $null
}

function Get-NpmLatestVersion {
    param([string]$Name)
    $r = Invoke-SafeApi -Url "https://registry.npmjs.org/$Name/latest"
    if ($r) { return $r.version }
    return $null
}

function Get-PyPiLatestVersion {
    param([string]$Name)
    $r = Invoke-SafeApi -Url "https://pypi.org/pypi/$Name/json"
    if ($r) { return $r.info.version }
    return $null
}

function Get-CratesLatestVersion {
    param([string]$Name)
    $r = Invoke-SafeApi -Url "https://crates.io/api/v1/crates/$Name"
    if ($r) { return $r.crate.max_version }
    return $null
}

# ── Portable Apps ─────────────────────────────────────────────

$PortableApps = @(
    @{ Name='7-Zip'; Exe='7z.exe'; GitHub='ip7z/7zip'; WingetId='7zip.7zip' }
    @{ Name='Notepad++'; Exe='notepad++.exe'; GitHub='notepad-plus-plus/notepad-plus-plus'; WingetId='Notepad++.Notepad++' }
    @{ Name='VS Code'; Exe='Code.exe'; GitHub='microsoft/vscode'; WingetId='Microsoft.VisualStudioCode' }
    @{ Name='OBS Studio'; Exe='obs64.exe'; GitHub='obsproject/obs-studio'; WingetId='OBSProject.OBSStudio' }
    @{ Name='Git'; Exe='git.exe'; GitHub='git-for-windows/git'; WingetId='Git.Git' }
    @{ Name='Node.js'; Exe='node.exe'; GitHub='nodejs/node'; WingetId='OpenJS.NodeJS.LTS' }
    @{ Name='Python'; Exe='python.exe'; GitHub='python/cpython'; WingetId='Python.Python.3.12' }
    @{ Name='Blender'; Exe='blender.exe'; GitHub='blender/blender'; WingetId='BlenderFoundation.Blender' }
    @{ Name='WinSCP'; Exe='WinSCP.exe'; GitHub='winscp/winscp'; WingetId='WinSCP.WinSCP' }
    @{ Name='mpv'; Exe='mpv.exe'; GitHub='mpv-player/mpv'; WingetId='mpv-player.mpv-CI.MSVC' }
    @{ Name='KeePassXC'; Exe='KeePassXC.exe'; GitHub='keepassxreboot/keepassxc'; WingetId='KeePassXCTeam.KeePassXC' }
    @{ Name='Firefox'; Exe='firefox.exe'; GitHub=$null; WingetId='Mozilla.Firefox' }
)

function Find-PortableApp {
    param([string]$ExeName)
    $drives = @()
    if (Test-Path 'C:\') { $drives += 'C:\' }
    if (Test-Path 'D:\') { $drives += 'D:\' }
    foreach ($d in $drives) {
        foreach ($dir in @('Program Files','Program Files (x86)','Tools','Portable','Apps','Software')) {
            $p = Join-Path $d $dir
            if (Test-Path $p) {
                $f = Get-ChildItem -Path $p -Filter $ExeName -Recurse -Depth 3 -ErrorAction SilentlyContinue |
                    Where-Object { $_.FullName -notmatch '(WindowsApps|\\$Recycle|Recovery|System Volume)' } |
                    Select-Object -First 1
                if ($f) { return $f.FullName }
            }
        }
    }
    return $null
}

function Get-PortableAppsOnline {
    Write-Host "`n[*] Checking portable apps against online sources..." -ForegroundColor Cyan
    $results = @()
    $i = 0
    foreach ($app in $PortableApps) {
        $i++
        Write-Progress -Activity "Portable apps" -Status "$i/$($PortableApps.Count) - $($app.Name)" -PercentComplete (($i / $PortableApps.Count) * 100)
        $path = Find-PortableApp -ExeName $app.Exe
        if (-not $path) { continue }
        try {
            $ver = (Get-Item $path).VersionInfo
            $installed = if ($ver.ProductVersion -and $ver.ProductVersion -ne '0.0.0.0') { $ver.ProductVersion } elseif ($ver.FileVersion -and $ver.FileVersion -ne '0.0.0.0') { $ver.FileVersion } else { $null }
        } catch { $installed = $null }
        if (-not $installed) { continue }

        $latest = $null
        if ($app.GitHub) {
            $parts = $app.GitHub -split '/'
            $latest = Get-GitHubLatestRelease -Owner $parts[0] -Repo $parts[1]
        } elseif ($app.Name -eq 'Firefox') {
            $latest = Get-FirefoxLatestVersion
        }

        $status = if ($latest) { Compare-Versions -Current $installed -Latest $latest } else { 'unknown' }
        $results += [PSCustomObject]@{
            Name=$app.Name; Installed=$installed;
            Available=if ($latest) { $latest } else { 'check manually' };
            Status=$status; Path=$path; WingetId=$app.WingetId; Method='portable-online'
        }
    }
    Write-Progress -Activity "Portable apps" -Completed
    Write-Host "  Checked $($results.Count) portable apps with online verification" -ForegroundColor Green
    return $results
}

# ── Winget ────────────────────────────────────────────────────

function Get-WingetUpgrades {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { return @() }
    Write-Host "`n[*] Checking winget for updates..." -ForegroundColor Cyan
    $output = winget upgrade --accept-source-agreements 2>&1 | Out-String
    $upgrades = @()
    foreach ($line in ($output -split "`n")) {
        if ($line -match '^\s*$' -or $line -match '^-+' -or $line -match 'Name\s+Id') { continue }
        if ($line -match '^\s*(.+?)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(\S+)\s*$') {
            $upgrades += [PSCustomObject]@{
                Name=$Matches[1].Trim(); Id=$Matches[2].Trim();
                Installed=$Matches[3].Trim(); Available=$Matches[4].Trim();
                Source=$Matches[5].Trim(); Method='winget'; Status='outdated'
            }
        }
    }
    Write-Host "  Found $($upgrades.Count) updates available" -ForegroundColor Green
    return $upgrades
}

# ── Dependencies ──────────────────────────────────────────────

function Get-NpmDeps {
    param([string]$Path)
    $results = @()
    try {
        $pkg = Get-Content $Path -Raw | ConvertFrom-Json -AsHashtable
        $name = $pkg['name']
        $dir = Split-Path $Path
        $deps = @{}
        if ($pkg['dependencies']) { $pkg['dependencies'].GetEnumerator() | ForEach-Object { $deps[$_.Key] = $_.Value } }
        if ($pkg['devDependencies']) { $pkg['devDependencies'].GetEnumerator() | ForEach-Object { $deps[$_.Key] = $_.Value } }
        $i = 0
        foreach ($d in $deps.GetEnumerator()) {
            $i++
            if ($i -gt 10) { break }
            $ver = $d.Value -replace '[\^~>=<]', ''
            $latest = Get-NpmLatestVersion -Name $d.Key
            $results += [PSCustomObject]@{
                Project=$name; Name=$d.Key; Installed=$ver;
                Available=if ($latest) { $latest } else { 'check' };
                Status=(Compare-Versions -Current $ver -Latest $latest);
                Path=$dir; Method='npm'
            }
        }
    } catch {}
    return $results
}

function Get-PipDeps {
    param([string]$Path)
    $results = @()
    try {
        $dir = Split-Path $Path
        $projName = Split-Path $dir -Leaf
        $lines = Get-Content $Path -ErrorAction SilentlyContinue | Where-Object { $_ -match '^[a-zA-Z]' -and $_ -notmatch '^(#|-)' }
        $i = 0
        foreach ($line in $lines) {
            $i++
            if ($i -gt 10) { break }
            if ($line -match '^([a-zA-Z0-9_.-]+)\s*([><=!~]+)?\s*([0-9.]+)') {
                $latest = Get-PyPiLatestVersion -Name $Matches[1]
                $results += [PSCustomObject]@{
                    Project=$projName; Name=$Matches[1]; Installed=$Matches[3];
                    Available=if ($latest) { $latest } else { 'check' };
                    Status=(Compare-Versions -Current $Matches[3] -Latest $latest);
                    Path=$dir; Method='pip'
                }
            }
        }
    } catch {}
    return $results
}

function Get-CargoDeps {
    param([string]$Path)
    $results = @()
    try {
        $content = Get-Content $Path -Raw
        $dir = Split-Path $Path
        $projName = 'unknown'
        if ($content -match '(?m)^\s*name\s*=\s*"([^"]+)"') { $projName = $Matches[1] }

        Write-Host "      [cargo] $projName" -ForegroundColor DarkGray
        $inDeps = $false
        $i = 0
        $lines = Get-Content $Path
        for ($j = 0; $j -lt $lines.Count; $j++) {
            $line = $lines[$j]
            if ($line -match '^\[dependencies') { $inDeps = $true; continue }
            if ($line -match '^\[' -and $inDeps) { $inDeps = $false; continue }
            if ($inDeps) {
                $ver = $null; $crateName = $null
                if ($line -match '^\s*([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"') {
                    $crateName = $Matches[1]; $ver = $Matches[2]
                } elseif ($line -match '^\s*([a-zA-Z0-9_-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)"') {
                    $crateName = $Matches[1]; $ver = $Matches[2]
                }
                if ($crateName -and $ver) {
                    $i++
                    if ($i -gt 10) { break }
                    Write-Host "        checking $crateName ($ver)..." -ForegroundColor DarkGray
                    $latest = Get-CratesLatestVersion -Name $crateName
                    Write-Host "        -> $latest" -ForegroundColor DarkGray
                    Start-Sleep -Milliseconds 200
                    $status = Compare-Versions -Current $ver -Latest $latest
                    $results += [PSCustomObject]@{
                        Project=$projName; Name=$crateName; Installed=$ver;
                        Available=if ($latest) { $latest } else { 'check' };
                        Status=$status;
                        Path=$dir; Method='cargo'
                    }
                }
            }
        }
    } catch {}
    return $results
}

function Get-AllDeps {
    param([string[]]$BasePaths)
    Write-Host "`n[*] Scanning code dependencies..." -ForegroundColor Cyan
    $all = @()

    foreach ($base in $BasePaths) {
        if (-not (Test-Path $base)) { continue }
        Write-Host "  Scanning $base..." -ForegroundColor Gray

        Write-Host "    Listing directories..." -ForegroundColor DarkGray
        # Scan each known project directory individually (avoids massive target/ dir)
        $projDirs = @(Get-ChildItem -Path $base -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notmatch '^(target|\.git|node_modules|dist|build|__pycache__|archive|loop_feedback|macro_logs|releases|build-artifacts|\.kilo|\.cline|\.devin|\.opencode|\.openclaw|\.playwright|\.cargo|\.mypy_cache|\.ruff_cache|\.pytest_cache|\.smz)$' })
        Write-Host "    Found $($projDirs.Count) project dirs" -ForegroundColor DarkGray

        foreach ($projDir in $projDirs) {
            Write-Host "    [$($projDir.Name)]" -ForegroundColor DarkGray
            # Direct deps in project root
            $f = Join-Path $projDir.FullName 'package.json'
            if (Test-Path $f) { $all += Get-NpmDeps -Path $f }
            $f = Join-Path $projDir.FullName 'requirements.txt'
            if (Test-Path $f) { $all += Get-PipDeps -Path $f }
            $f = Join-Path $projDir.FullName 'Cargo.toml'
            if (Test-Path $f) { $all += Get-CargoDeps -Path $f }

            # Scan immediate subdirectories (1 level deep)
            $subDirs = @(Get-ChildItem -Path $projDir.FullName -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notmatch '^(target|\.git|node_modules|dist|build|__pycache__|archive|loop_feedback|macro_logs|\.kilo|\.cline|\.devin|\.opencode|\.openclaw|\.cargo)$' })
            foreach ($sub in $subDirs) {
                $f = Join-Path $sub.FullName 'package.json'
                if (Test-Path $f) { $all += Get-NpmDeps -Path $f }
                $f = Join-Path $sub.FullName 'requirements.txt'
                if (Test-Path $f) { $all += Get-PipDeps -Path $f }
                $f = Join-Path $sub.FullName 'Cargo.toml'
                if (Test-Path $f) { $all += Get-CargoDeps -Path $f }

                # One more level
                $sub2 = Get-ChildItem -Path $sub.FullName -Directory -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -notmatch '^(target|\.git|node_modules|dist|build|__pycache__|archive)$' }
                foreach ($s2 in $sub2) {
                    $f = Join-Path $s2.FullName 'package.json'
                    if (Test-Path $f) { $all += Get-NpmDeps -Path $f }
                    $f = Join-Path $s2.FullName 'requirements.txt'
                    if (Test-Path $f) { $all += Get-PipDeps -Path $f }
                    $f = Join-Path $s2.FullName 'Cargo.toml'
                    if (Test-Path $f) { $all += Get-CargoDeps -Path $f }

                    # One more level
                    $sub3 = Get-ChildItem -Path $s2.FullName -Directory -ErrorAction SilentlyContinue |
                        Where-Object { $_.Name -notmatch '^(target|\.git|node_modules|dist|build|__pycache__|archive)$' }
                    foreach ($s3 in $sub3) {
                        $f = Join-Path $s3.FullName 'package.json'
                        if (Test-Path $f) { $all += Get-NpmDeps -Path $f }
                        $f = Join-Path $s3.FullName 'requirements.txt'
                        if (Test-Path $f) { $all += Get-PipDeps -Path $f }
                        $f = Join-Path $s3.FullName 'Cargo.toml'
                        if (Test-Path $f) { $all += Get-CargoDeps -Path $f }
                    }
                }
            }
        }
    }

    $seen = @{}
    $deduped = @()
    foreach ($r in $all) {
        $key = "$($r.Project)|$($r.Name)"
        if (-not $seen.ContainsKey($key)) { $seen[$key] = $true; $deduped += $r }
    }
    return $deduped
}

# ── Reports ───────────────────────────────────────────────────

function Get-CompatLevel {
    param([string]$Installed, [string]$Available)
    if (-not $Installed -or -not $Available) { return 'unknown' }
    $c = $Installed -replace '[^0-9.]', '' -replace '\.$', ''
    $l = $Available -replace '[^0-9.]', '' -replace '\.$', ''
    if (-not $c -or -not $l) { return 'unknown' }
    try {
        $cp = @($c -split '\.' | ForEach-Object { [int]$_ })
        $lp = @($l -split '\.' | ForEach-Object { [int]$_ })
        while ($cp.Count -lt 3) { $cp += 0 }
        while ($lp.Count -lt 3) { $lp += 0 }
        if ($lp[0] -gt $cp[0]) { return 'major' }
        if ($lp[1] -gt $cp[1]) { return 'minor' }
        if ($lp[2] -gt $cp[2]) { return 'patch' }
        return 'current'
    } catch { return 'unknown' }
}

function Get-UpdateCommand {
    param([string]$Method, [string]$Name, [string]$ProjectPath, [string]$Available)
    switch ($Method) {
        'npm' {
            $cd = if ($ProjectPath) { "cd `"$ProjectPath`" && " } else { "" }
            $cd = $cd.TrimEnd()
            if ($Available) { return "$cd npm install $Name@$Available" }
            return "$cd npm install $Name"
        }
        'pip' {
            if ($Available) { return "pip install --upgrade $Name==$Available" }
            return "pip install --upgrade $Name"
        }
        'cargo' {
            if ($Available) { return "cargo update -p $Name --precise $Available" }
            return "cargo update -p $Name"
        }
        'winget' {
            return "winget upgrade --id $Name --force"
        }
        default { return "# No auto-update for $Name" }
    }
}

function Show-Dashboard {
    param([array]$PortableResults, [array]$WingetResults, [array]$DepResults, [switch]$ExportHtml)

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

    $portableData = @()
    if ($PortableResults) {
        foreach ($r in $PortableResults) {
            $portableData += @{
                Name = $r.Name; Installed = $r.Installed; Available = $r.Available
                Status = $r.Status; Method = 'portable'; Project = 'Portable Apps'; Path = $null
                Compat = (Get-CompatLevel -Installed $r.Installed -Available $r.Available)
                Cmd = (Get-UpdateCommand -Method 'winget' -Name $r.WingetId -Available $r.Available)
            }
        }
    }
    $wingetData = @()
    if ($WingetResults) {
        foreach ($r in $WingetResults) {
            $wingetData += @{
                Name = $r.Name; Installed = $r.Installed; Available = $r.Available
                Status = 'outdated'; Method = 'winget'; Project = 'System Packages'; Path = $null
                Compat = (Get-CompatLevel -Installed $r.Installed -Available $r.Available)
                Cmd = (Get-UpdateCommand -Method 'winget' -Name $r.Name -Available $r.Available)
            }
        }
    }
    $depData = @()
    if ($DepResults) {
        foreach ($r in $DepResults) {
            $depData += @{
                Name = $r.Name; Installed = $r.Installed; Available = $r.Available
                Status = $r.Status; Method = $r.Method; Project = $r.Project; Path = $r.Path
                Compat = (Get-CompatLevel -Installed $r.Installed -Available $r.Available)
                Cmd = (Get-UpdateCommand -Method $r.Method -Name $r.Name -ProjectPath $r.Path -Available $r.Available)
            }
        }
    }

    $allData = $portableData + $wingetData + $depData
    $jsonData = $allData | ConvertTo-Json -Compress -Depth 5

    $htmlTemplate = @'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Update Dashboard</title>
<style>
:root { --bg:#0d1117; --s:#161b22; --b:#30363d; --t:#e6edf3; --tm:#8b949e; --tb:#f0f6fc; --r:#f85149; --o:#d29922; --g:#3fb950; --bl:#58a6ff; --p:#bc8cff; --c:#39d2c0; --pk:#f778ba; }
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--t);line-height:1.5}
.wrap{max-width:1200px;margin:0 auto;padding:20px 24px}

/* Header */
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.hdr h1{font-size:20px;font-weight:600;color:var(--tb)}
.hdr .ts{color:var(--tm);font-size:12px}

/* Stats row */
.stats{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.st{background:var(--s);border:1px solid var(--b);border-radius:10px;padding:14px 20px;flex:1;min-width:140px;text-align:center}
.st .n{font-size:28px;font-weight:700}.st .l{font-size:11px;color:var(--tm);text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.st.tot .n{color:var(--bl)}.st.out .n{color:var(--o)}.st.ok .n{color:var(--g)}.st.proj .n{color:var(--c)}

/* Charts row */
.charts{display:flex;gap:16px;margin-bottom:20px}
.cbox{background:var(--s);border:1px solid var(--b);border-radius:10px;padding:16px;flex:1}
.cbox h3{font-size:11px;color:var(--tm);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
.bar-r{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.bar-l{min-width:100px;font-size:12px;color:var(--tm);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-t{flex:1;height:18px;background:var(--bg);border-radius:4px;overflow:hidden}
.bar-f{height:100%;border-radius:4px;display:flex;align-items:center;padding-left:6px;font-size:10px;font-weight:600;color:#fff}
.bar-c{font-size:11px;color:var(--tm);min-width:28px;text-align:right}
.donut{display:flex;align-items:center;gap:20px}
.donut svg{flex-shrink:0}
.leg{display:flex;flex-direction:column;gap:6px}
.leg-i{display:flex;align-items:center;gap:6px;font-size:12px}
.leg-d{width:8px;height:8px;border-radius:50%}

/* Controls */
.ctrl{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.sbox{flex:1;min-width:200px;padding:8px 14px;background:var(--s);border:1px solid var(--b);border-radius:6px;color:var(--t);font-size:13px;outline:none}
.sbox:focus{border-color:var(--bl)}
.fbtn{padding:6px 14px;background:var(--s);border:1px solid var(--b);border-radius:6px;color:var(--tm);font-size:12px;cursor:pointer;transition:all .15s}
.fbtn:hover{border-color:var(--bl);color:var(--t)}
.fbtn.on{background:var(--bl);border-color:var(--bl);color:#fff}
.gen-btn{padding:8px 16px;background:var(--g);border:none;border-radius:6px;color:#000;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}
.gen-btn:hover{opacity:.85}

/* Project accordion */
.acc{background:var(--s);border:1px solid var(--b);border-radius:10px;margin-bottom:10px;overflow:hidden}
.acc-h{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;user-select:none;transition:background .15s}
.acc-h:hover{background:rgba(88,166,255,.04)}
.acc-h .arrow{color:var(--tm);font-size:12px;transition:transform .2s;width:14px;text-align:center}
.acc.open .arrow{transform:rotate(90deg)}
.acc-h .pname{font-weight:600;font-size:14px;flex:1}
.acc-h .pstats{display:flex;gap:12px;font-size:12px;color:var(--tm)}
.acc-h .pstats span{display:flex;align-items:center;gap:4px}
.acc-h .pmeth{display:flex;gap:4px}
.badge{display:inline-block;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600}
.badge.npm{background:rgba(63,185,80,.12);color:var(--g)}
.badge.pip{background:rgba(88,166,255,.12);color:var(--bl)}
.badge.cargo{background:rgba(210,153,34,.12);color:var(--o)}
.badge.portable{background:rgba(188,140,255,.12);color:var(--p)}
.badge.winget{background:rgba(247,120,186,.12);color:var(--pk)}
.acc-b{display:none;border-top:1px solid var(--b)}
.acc.open .acc-b{display:block}

/* Dep rows */
.dep{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid rgba(48,54,61,.5);font-size:13px}
.dep:last-child{border-bottom:none}
.dep .dname{font-weight:500;min-width:160px}
.dep .dver{color:var(--tm);min-width:80px;font-family:'SF Mono',Consolas,monospace;font-size:12px}
.dep .darrow{color:var(--tm);font-size:11px}
.dep .dnew{font-family:'SF Mono',Consolas,monospace;font-size:12px}
.dep .dcompat{margin-left:auto;display:flex;align-items:center;gap:8px}
.compat{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase}
.compat.major{background:rgba(248,81,73,.12);color:var(--r)}
.compat.minor{background:rgba(210,153,34,.12);color:var(--o)}
.compat.patch{background:rgba(63,185,80,.12);color:var(--g)}
.compat.current{background:rgba(63,185,80,.08);color:var(--g)}
.compat.unknown{background:rgba(139,148,158,.12);color:var(--tm)}
.upd-btn{padding:4px 10px;background:rgba(63,185,80,.1);border:1px solid rgba(63,185,80,.3);border-radius:4px;color:var(--g);font-size:11px;cursor:pointer;white-space:nowrap;transition:all .15s}
.upd-btn:hover{background:var(--g);color:#000}
.upd-btn.copied{background:var(--bl);border-color:var(--bl);color:#fff}
.upd-btn.run{background:rgba(63,185,80,.2);border-color:var(--g);color:var(--g)}
.upd-btn.run:hover{background:var(--g);color:#000}
.upd-btn.running{background:var(--o);border-color:var(--o);color:#000;cursor:wait}
.upd-btn.ok{background:var(--g);border-color:var(--g);color:#000}
.upd-btn.fail{background:var(--r);border-color:var(--r);color:#fff}
.server-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px}
.server-dot.on{background:var(--g);box-shadow:0 0 6px var(--g)}
.server-dot.off{background:var(--r)}
.bulk-bar{background:var(--s);border:1px solid var(--b);border-radius:8px;padding:10px 16px;margin-bottom:16px;display:none;align-items:center;gap:12px;font-size:13px}
.bulk-bar.show{display:flex}
.bulk-bar .spinner{width:14px;height:14px;border:2px solid var(--b);border-top-color:var(--bl);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.bulk-bar .progress{flex:1;height:4px;background:var(--bg);border-radius:2px;overflow:hidden}
.bulk-bar .progress-fill{height:100%;background:var(--bl);border-radius:2px;transition:width .3s}
.log-box{background:var(--bg);border:1px solid var(--b);border-radius:6px;padding:8px 12px;margin-top:8px;max-height:120px;overflow-y:auto;font-family:'SF Mono',Consolas,monospace;font-size:11px;color:var(--tm);line-height:1.6;display:none}
.log-box.show{display:block}
.log-ok{color:var(--g)}.log-err{color:var(--r)}

/* Toast */
.toast{position:fixed;bottom:20px;right:20px;background:var(--s);border:1px solid var(--g);border-radius:8px;padding:10px 16px;font-size:13px;color:var(--g);opacity:0;transition:opacity .3s;pointer-events:none;z-index:999}
.toast.show{opacity:1}

/* Empty */
.empty{text-align:center;padding:40px;color:var(--tm);font-size:14px}

/* Modal */
.modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;align-items:center;justify-content:center}
.modal-bg.show{display:flex}
.modal{background:var(--s);border:1px solid var(--b);border-radius:12px;padding:24px;max-width:700px;width:90%;max-height:80vh;overflow-y:auto}
.modal h2{font-size:16px;margin-bottom:12px}
.modal pre{background:var(--bg);border:1px solid var(--b);border-radius:6px;padding:12px;font-size:12px;overflow-x:auto;color:var(--c);margin-bottom:16px;white-space:pre-wrap}
.modal .mactions{display:flex;gap:8px;justify-content:flex-end}
.modal .mbtn{padding:8px 16px;border-radius:6px;border:none;font-size:13px;cursor:pointer;font-weight:500}
.modal .mbtn.p{background:var(--bl);color:#fff}.modal .mbtn.s{background:var(--b);color:var(--t)}

@media(max-width:768px){.charts{flex-direction:column}.stats{flex-direction:column}}
</style>
</head>
<body>
<div class="wrap">
    <div class="hdr">
        <h1>Update Dashboard</h1>
        <div class="ts"><span class="server-dot off" id="serverDot"></span><span id="serverLabel">Offline</span> &middot; __TIMESTAMP__</div>
    </div>
    <div class="stats" id="stats"></div>
    <div class="charts" id="charts"></div>
    <div class="ctrl">
        <input type="text" class="sbox" id="search" placeholder="Search packages or projects..." oninput="render()">
        <button class="fbtn on" onclick="setF('all',this)">All</button>
        <button class="fbtn" onclick="setF('outdated',this)">Outdated</button>
        <button class="fbtn" onclick="setF('major',this)">Major</button>
        <button class="fbtn" onclick="setF('minor',this)">Minor</button>
        <button class="fbtn" onclick="setF('patch',this)">Patch</button>
        <button class="fbtn" onclick="setF('current',this)">Up to Date</button>
        <button class="gen-btn" onclick="genScript()">Generate Script</button>
        <button class="gen-btn" id="bulkBtn" style="display:none;background:var(--bl)" onclick="bulkUpdate()">Update All Outdated</button>
    </div>
    <div class="bulk-bar" id="bulkBar">
        <div class="spinner"></div>
        <span id="bulkStatus">Updating...</span>
        <div class="progress"><div class="progress-fill" id="bulkProgress" style="width:0%"></div></div>
        <span id="bulkCount" style="min-width:60px;text-align:right;font-size:12px;color:var(--tm)"></span>
    </div>
    <div class="log-box" id="logBox"></div>
    <div id="projects"></div>
</div>
<div class="toast" id="toast"></div>
<div class="modal-bg" id="modalBg" onclick="if(event.target===this)closeModal()">
    <div class="modal">
        <h2>PowerShell Update Script</h2>
        <p style="color:var(--tm);font-size:13px;margin-bottom:12px">Copy this script and run it in PowerShell to update all outdated packages.</p>
        <pre id="scriptContent"></pre>
        <div class="mactions">
            <button class="mbtn s" onclick="closeModal()">Close</button>
            <button class="mbtn p" onclick="copyScript()">Copy to Clipboard</button>
        </div>
    </div>
</div>
<script>
const D=__JSON_DATA__;
let F='all',S='';

function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2000)}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function render(){
    S=document.getElementById('search').value.toLowerCase();
    renderStats();renderCharts();renderProjects();
}

function renderStats(){
    var total=D.length, out=D.filter(function(d){return d.Status==='outdated'}).length;
    var ok=D.filter(function(d){return d.Status==='current'}).length;
    var projs={};D.forEach(function(d){projs[d.Project]=1});
    document.getElementById('stats').innerHTML=
        '<div class="st tot"><div class="n">'+total+'</div><div class="l">Total Checked</div></div>'+
        '<div class="st out"><div class="n">'+out+'</div><div class="l">Outdated</div></div>'+
        '<div class="st ok"><div class="n">'+ok+'</div><div class="l">Up to Date</div></div>'+
        '<div class="st proj"><div class="n">'+Object.keys(projs).length+'</div><div class="l">Projects</div></div>';
}

function renderCharts(){
    var methods={};D.forEach(function(d){methods[d.Method]=(methods[d.Method]||0)+1});
    var projects={};D.forEach(function(d){
        if(!projects[d.Project])projects[d.Project]={total:0,outdated:0};
        projects[d.Project].total++;
        if(d.Status==='outdated')projects[d.Project].outdated++;
    });
    var maxP=1;Object.values(projects).forEach(function(p){if(p.outdated>maxP)maxP=p.outdated});
    var rows='';
    Object.entries(projects).sort(function(a,b){return b[1].outdated-a[1].outdated}).forEach(function(e){
        var n=e[0],p=e[1],w=maxP?(p.outdated/maxP*100):0;
        rows+='<div class="bar-r"><div class="bar-l" title="'+esc(n)+'">'+esc(n)+'</div>'+
            '<div class="bar-t"><div class="bar-f" style="width:'+w+'%;background:var(--o)">'+p.outdated+'</div></div>'+
            '<div class="bar-c">'+p.total+'</div></div>';
    });
    var total=D.length||1,angle=0,paths='',leg='';
    var mc={npm:'#3fb950',pip:'#58a6ff',cargo:'#d29922',portable:'#bc8cff',winget:'#f778ba'};
    var entries=Object.entries(methods).sort(function(a,b){return b[1]-a[1]});
    entries.forEach(function(e){
        var m=e[0],c=e[1],pct=c/total,r=60,cx=70,cy=70;
        var x1=cx+r*Math.cos(angle*2*Math.PI),y1=cy+r*Math.sin(angle*2*Math.PI);
        angle+=pct;
        var x2=cx+r*Math.cos(angle*2*Math.PI),y2=cy+r*Math.sin(angle*2*Math.PI);
        var lg=pct>.5?1:0;
        paths+='<path d="M'+cx+','+cy+' L'+x1+','+y1+' A'+r+','+r+' 0 '+lg+',1 '+x2+','+y2+' Z" fill="'+(mc[m]||'#8b949e')+'" opacity=".85"/>';
        leg+='<div class="leg-i"><div class="leg-d" style="background:'+(mc[m]||'#8b949e')+'"></div><span>'+m+' ('+c+')</span></div>';
    });
    document.getElementById('charts').innerHTML=
        '<div class="cbox"><h3>Outdated by Project</h3>'+rows+'</div>'+
        '<div class="cbox"><h3>By Source</h3><div class="donut">'+
        '<svg viewBox="0 0 140 140" width="140" height="140"><circle cx="70" cy="70" r="45" fill="none" stroke="var(--s)" stroke-width="22"/>'+
        '<circle cx="70" cy="70" r="32" fill="var(--s)"/>'+paths+'</svg>'+
        '<div><div style="font-size:24px;font-weight:700;color:var(--tb)">'+D.length+'</div><div style="font-size:11px;color:var(--tm)">packages</div>'+
        '<div class="leg" style="margin-top:8px">'+leg+'</div></div></div></div>';
}

function renderProjects(){
    var filtered=D.filter(function(d){
        var ms=!S||d.Name.toLowerCase().indexOf(S)>=0||d.Project.toLowerCase().indexOf(S)>=0;
        var mf=F==='all'||d.Status===F||d.Compat===F||(F==='outdated'&&d.Status==='outdated');
        return ms&&mf;
    });
    var grouped={};filtered.forEach(function(d){
        if(!grouped[d.Project])grouped[d.Project]={};
        var key=d.Name+'|'+d.Method;
        if(!grouped[d.Project][key])grouped[d.Project][key]=[];
        grouped[d.Project][key].push(d);
    });
    var html='';
    var projNames=Object.keys(grouped).sort();
    projNames.forEach(function(proj){
        var deps=grouped[proj];
        var total=0,outdated=0,methods={};
        Object.values(deps).forEach(function(arr){
            arr.forEach(function(d){total++;if(d.Status==='outdated')outdated++;methods[d.Method]=1});
        });
        var mhtml='';Object.keys(methods).forEach(function(m){mhtml+='<span class="badge '+m+'">'+m+'</span> '});
        var depHtml='';
        var keys=Object.keys(deps).sort();
        keys.forEach(function(k){
            var d=deps[k][0];
            var compatClass=d.Status==='current'?'current':d.Compat;
            var compatLabel=d.Status==='current'?'up to date':d.Compat;
            depHtml+='<div class="dep">'+
                '<span class="dname">'+esc(d.Name)+'</span>'+
                '<span class="dver">'+esc(d.Installed||'-')+'</span>'+
                (d.Status==='outdated'?'<span class="darrow">&rarr;</span><span class="dnew" style="color:var(--g)">'+esc(d.Available)+'</span>':'<span class="dnew" style="color:var(--tm)">latest</span>')+
                '<span class="dcompat">'+
                '<span class="compat '+compatClass+'">'+compatLabel+'</span>'+
                (d.Status==='outdated'?'<button class="upd-btn'+(SERVER_ON?' run':'')+'" id="btn-'+esc(d.Name)+'-'+esc(d.Method)+'" onclick="'+(SERVER_ON?'runCmd':'copyCmd')+'(this,\''+esc(d.Cmd)+'\',\''+esc(d.Name)+'\',\''+esc(d.Method)+'\')">'+(SERVER_ON?'Run':'Copy')+'</button>':'')+
                '</span></div>';
        });
        html+='<div class="acc" id="p_'+esc(proj.replace(/[^a-zA-Z0-9]/g,''))+'">'+
            '<div class="acc-h" onclick="toggleAcc(this)">'+
            '<span class="arrow">&#9654;</span>'+
            '<span class="pname">'+esc(proj)+'</span>'+
            '<span class="pmeth">'+mhtml+'</span>'+
            '<div class="pstats">'+
            '<span>'+(outdated>0?'<b style="color:var(--o)">'+outdated+'</b> outdated':'<b style="color:var(--g)">All current</b>')+'</span>'+
            '<span>'+total+' deps</span>'+
            '</div></div>'+
            '<div class="acc-b">'+depHtml+'</div></div>';
    });
    if(!html)html='<div class="empty">No packages match your filters.</div>';
    document.getElementById('projects').innerHTML=html;
}

function toggleAcc(el){el.parentElement.classList.toggle('open')}
function setF(f,btn){F=f;document.querySelectorAll('.fbtn').forEach(function(b){b.classList.remove('on')});btn.classList.add('on');render()}

function copyCmd(btn,cmd){
    navigator.clipboard.writeText(cmd).then(function(){
        btn.textContent='Copied';btn.classList.add('copied');
        setTimeout(function(){btn.textContent='Copy';btn.classList.remove('copied')},1500);
        toast('Copied: '+cmd);
    });
}

var SERVER_ON=false;
var SERVER_URL='http://localhost:3847';

function checkServer(){
    fetch(SERVER_URL+'/api/refresh',{method:'GET',signal:AbortSignal.timeout(2000)}).then(function(r){
        if(r.ok){SERVER_ON=true;document.getElementById('serverDot').className='server-dot on';document.getElementById('serverLabel').textContent='Live';document.getElementById('bulkBtn').style.display='';document.getElementById('lastScan').textContent='Last scan: connected'}
    }).catch(function(){
        SERVER_ON=false;document.getElementById('serverDot').className='server-dot off';document.getElementById('serverLabel').textContent='Offline';document.getElementById('bulkBtn').style.display='none';
    });
}

function runCmd(btn,cmd,name,method){
    if(btn.classList.contains('running'))return;
    btn.classList.remove('run','ok','fail');btn.classList.add('running');btn.textContent='Running...';
    var logBox=document.getElementById('logBox');logBox.classList.add('show');
    logBox.innerHTML+='<div style="color:var(--bl)">▶ '+esc(name)+' ('+method+')</div>';

    fetch(SERVER_URL+'/api/update',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({cmd:cmd,name:name,method:method})
    }).then(function(resp){
        var reader=resp.body.getReader();var decoder=new TextDecoder();var buffer='';
        function read(){
            reader.read().then(function(result){
                if(result.done){return}
                buffer+=decoder.decode(result.value,{stream:true});
                var lines=buffer.split('\n');buffer=lines.pop();
                lines.forEach(function(line){
                    if(!line.startsWith('event:')&&!line.startsWith('data:'))return;
                    if(line.startsWith('event:')){
                        var ev=line.substring(6).trim();
                    } else if(line.startsWith('data:')){
                        try{var d=JSON.parse(line.substring(5).trim())}catch(e){return}
                        if(ev==='output'&&d.line){
                            logBox.innerHTML+='<div>'+esc(d.line)+'</div>';logBox.scrollTop=logBox.scrollHeight;
                        }else if(ev==='done'){
                            if(d.success){btn.classList.remove('running');btn.classList.add('ok');btn.textContent='Done';toast('✓ '+d.message)}
                            else{btn.classList.remove('running');btn.classList.add('fail');btn.textContent='Failed';toast('✗ '+d.message);logBox.innerHTML+='<div class="log-err">'+esc(d.message)+'</div>'}
                        }
                    }
                });
                read();
            });
        }
        read();
    }).catch(function(e){
        btn.classList.remove('running');btn.classList.add('fail');btn.textContent='Error';
        logBox.innerHTML+='<div class="log-err">Connection error: '+esc(String(e))+'</div>';
    });
}

function bulkUpdate(){
    var outdated=D.filter(function(d){return d.Status==='outdated'});
    if(!outdated.length){toast('Nothing to update');return}
    if(!confirm('Update '+outdated.length+' packages?'))return;
    var bar=document.getElementById('bulkBar');bar.classList.add('show');
    var countEl=document.getElementById('bulkCount');
    var pfill=document.getElementById('bulkProgress');
    var logBox=document.getElementById('logBox');logBox.classList.add('show');logBox.innerHTML='';
    var done=0,total=outdated.length;
    countEl.textContent='0/'+total;pfill.style.width='0%';

    var commands=outdated.map(function(d){return{cmd:d.Cmd,name:d.Name,method:d.Method}});

    fetch(SERVER_URL+'/api/bulk-update',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({commands:commands})
    }).then(function(resp){
        var reader=resp.body.getReader();var decoder=new TextDecoder();var buffer='';
        function read(){
            reader.read().then(function(result){
                if(result.done){bar.classList.remove('show');return}
                buffer+=decoder.decode(result.value,{stream:true});
                var lines=buffer.split('\n');buffer=lines.pop();
                var ev='';
                lines.forEach(function(line){
                    if(line.startsWith('event:')){ev=line.substring(6).trim()}
                    else if(line.startsWith('data:')){
                        try{var d=JSON.parse(line.substring(5).trim())}catch(e){return}
                        if(ev==='bulk_progress'){
                            done++;countEl.textContent=done+'/'+total;pfill.style.width=((done/total)*100)+'%';
                            var cls=d.success===true?'log-ok':d.success===false?'log-err':'';
                            logBox.innerHTML+='<div class="'+cls+'">'+(d.success===true?'✓':d.success===false?'✗':'●')+' '+esc(d.name)+(d.output?' — '+esc(String(d.output).substring(0,120)):'' )+'</div>';
                        }else if(ev==='bulk_done'){
                            toast('Done: '+d.success+' updated, '+d.failed+' failed');
                            logBox.innerHTML+='<div style="color:var(--bl);margin-top:8px">Complete: '+d.success+' updated, '+d.failed+' failed</div>';
                        }
                    }
                });
                logBox.scrollTop=logBox.scrollHeight;
                read();
            });
        }
        read();
    }).catch(function(e){
        bar.classList.remove('show');toast('Connection error');logBox.innerHTML+='<div class="log-err">'+esc(String(e))+'</div>';
    });
}

function genScript(){
    var outdated=D.filter(function(d){return d.Status==='outdated'});
    if(!outdated.length){toast('No outdated packages');return}
    var grouped={};outdated.forEach(function(d){
        if(!grouped[d.Method])grouped[d.Method]=[];
        grouped[d.Method].push(d);
    });
    var lines=['# Auto-generated update script','# Generated: __TIMESTAMP__','','$ErrorActionPreference="Continue"',''];
    if(grouped.npm){
        lines.push('# ── npm updates ──');
        var dirs={};grouped.npm.forEach(function(d){if(!dirs[d.Project])dirs[d.Project]=[];dirs[d.Project].push(d)});
        Object.entries(dirs).forEach(function(e){
            lines.push('# '+e[0]);e[1].forEach(function(d){lines.push(d.Cmd)});lines.push('');
        });
    }
    if(grouped.pip){
        lines.push('# ── pip updates ──');grouped.pip.forEach(function(d){lines.push(d.Cmd)});lines.push('');
    }
    if(grouped.cargo){
        lines.push('# ── cargo updates ──');grouped.cargo.forEach(function(d){lines.push(d.Cmd)});lines.push('');
    }
    if(grouped.winget){
        lines.push('# ── winget updates ──');grouped.winget.forEach(function(d){lines.push(d.Cmd)});lines.push('');
    }
    lines.push('Write-Host "Done! '+outdated.length+' packages updated." -ForegroundColor Green');
    document.getElementById('scriptContent').textContent=lines.join('\n');
    document.getElementById('modalBg').classList.add('show');
}

function closeModal(){document.getElementById('modalBg').classList.remove('show')}
function copyScript(){
    navigator.clipboard.writeText(document.getElementById('scriptContent').textContent).then(function(){
        toast('Script copied to clipboard!');closeModal();
    });
}

checkServer();render();
</script>
</body>
</html>
'@

    # ── Decoupled data output (default) ──
    # The committed dashboard shell (scripts/utility/update_dashboard/shell.html) is the single
    # source of truth for the UI. We always write structured JSON here; the HTML artifact
    # is opt-in via -ExportHtml for static snapshots, so the dashboard is viewable without
    # depending on a generated file.
    $segmentDir = Join-Path $PSScriptRoot 'update_dashboard'
    if (-not (Test-Path $segmentDir)) { New-Item -ItemType Directory -Path $segmentDir -Force | Out-Null }
    $dataPath = Join-Path $segmentDir 'update_data.json'

    # Per-project metadata: code projects are grouped by their on-disk directory
    # (system/portable entries have no Path and are excluded from this view).
    $projGroups = $allData | Where-Object { $_.Path } | Group-Object -Property Path
    $projects = @()
    foreach ($g in $projGroups) {
        $grp = $g.Group
        $methods = @($grp | ForEach-Object { $_.Method } | Sort-Object -Unique)
        $isGit = Test-Path -LiteralPath (Join-Path $g.Name '.git')
        $branch = $null
        if ($isGit) {
            try { $branch = [string](& git -C $g.Name rev-parse --abbrev-ref HEAD 2>$null) } catch { $branch = $null }
        }
        $projects += @{
            path     = $g.Name
            name     = Split-Path $g.Name -Leaf
            sources  = $methods
            total    = $grp.Count
            outdated = ($grp | Where-Object { $_.Status -eq 'outdated' }).Count
            current  = ($grp | Where-Object { $_.Status -eq 'current' }).Count
            unknown  = ($grp | Where-Object { $_.Status -notin @('outdated', 'current') }).Count
            isGit    = $isGit
            branch   = if ($branch) { $branch.Trim() } else { $null }
        }
    }

    $data = @{
        timestamp = $timestamp
        summary = @{
            total    = $allData.Count
            outdated = ($allData | Where-Object { $_.Status -eq 'outdated' }).Count
            current  = ($allData | Where-Object { $_.Status -eq 'current' }).Count
            projects = ($allData | ForEach-Object { $_.Project } | Sort-Object -Unique).Count
        }
        projects = $projects
        packages = $allData
    }
    $data | ConvertTo-Json -Depth 6 | Out-File -FilePath $dataPath -Encoding UTF8 -Force

    Write-Host "`n[*] Update data written: $dataPath" -ForegroundColor Green
    Write-Host "  Open the dashboard at http://localhost:3847 (run update_dashboard_server.ps1 if not started)." -ForegroundColor DarkGray
    Write-Host "  $($data.summary.outdated) outdated / $($data.summary.total) checked." -ForegroundColor $(if ($data.summary.outdated -gt 0) { 'Yellow' } else { 'Green' })

    if ($ExportHtml) {
        $html = $htmlTemplate.Replace('__TIMESTAMP__', $timestamp).Replace('__JSON_DATA__', $jsonData)
        $outPath = Join-Path (Get-Location) 'update_dashboard.html'
        $html | Out-File -FilePath $outPath -Encoding UTF8 -Force
        Write-Host "`n[*] Dashboard HTML generated: $outPath" -ForegroundColor Green
        Start-Process $outPath
    }
}

function Show-TableReport {
    param([array]$PortableResults, [array]$WingetResults, [array]$DepResults)

    if ($PortableResults) {
        $outdated = $PortableResults | Where-Object { $_.Status -eq 'outdated' }
        $unknown = $PortableResults | Where-Object { $_.Status -ne 'outdated' }

        Write-Host "`n" -NoNewline
        Write-Host ("=" * 95) -ForegroundColor DarkGray
        Write-Host " PORTABLE APPS - Online Version Check " -ForegroundColor White -BackgroundColor DarkBlue
        Write-Host ("=" * 95) -ForegroundColor DarkGray

        if ($outdated -and $outdated.Count -gt 0) {
            Write-Host "`n  [UPDATE AVAILABLE]:" -ForegroundColor Red
            foreach ($a in $outdated) {
                $dl = if ($a.WingetId) { "winget upgrade --id $($a.WingetId)" } else { 'manual' }
                Write-Host ("  {0,-20} {1,-15} -> {2,-15} {3}" -f $a.Name, $a.Installed, $a.Available, $dl) -ForegroundColor Yellow
            }
        } else {
            Write-Host "`n  All checked portable apps are up to date." -ForegroundColor Green
        }
        if ($unknown -and $unknown.Count -gt 0) {
            Write-Host "`n  [COULD NOT VERIFY]:" -ForegroundColor DarkYellow
            foreach ($a in $unknown) { Write-Host ("  {0,-20} v{1}" -f $a.Name, $a.Installed) -ForegroundColor Gray }
        }
    }

    if ($WingetResults -and $WingetResults.Count -gt 0) {
        Write-Host "`n" -NoNewline
        Write-Host ("=" * 95) -ForegroundColor DarkGray
        Write-Host " WINGET - System Package Updates " -ForegroundColor White -BackgroundColor DarkBlue
        Write-Host ("=" * 95) -ForegroundColor DarkGray
        foreach ($p in $WingetResults) {
            Write-Host ("  {0,-35} {1,-15} -> {2,-15}" -f $p.Name, $p.Installed, $p.Available) -ForegroundColor Yellow
        }
        Write-Host "`n  To update all: winget upgrade --all" -ForegroundColor DarkGray
    }

    if ($DepResults -and $DepResults.Count -gt 0) {
        $outdated = $DepResults | Where-Object { $_.Status -eq 'outdated' }
        Write-Host "`n" -NoNewline
        Write-Host ("=" * 95) -ForegroundColor DarkGray
        Write-Host " CODE DEPENDENCIES - npm / pip / cargo " -ForegroundColor White -BackgroundColor DarkBlue
        Write-Host ("=" * 95) -ForegroundColor DarkGray

        $projects = $DepResults | Group-Object Project
        foreach ($proj in $projects) {
            $projOut = $proj.Group | Where-Object { $_.Status -eq 'outdated' }
            if ($projOut -and $projOut.Count -gt 0) {
                Write-Host "`n  [$($proj.Name)]" -ForegroundColor Cyan
                foreach ($d in $projOut) {
                    $color = switch ($d.Method) { 'npm' { 'Green' } 'pip' { 'Blue' } 'cargo' { 'DarkYellow' } }
                    Write-Host ("    {0,-30} {1,-12} -> {2,-12} [{3}]" -f $d.Name, $d.Installed, $d.Available, $d.Method) -ForegroundColor $color
                }
            }
        }
        $totalOut = if ($outdated) { $outdated.Count } else { 0 }
        Write-Host "`n  Dependencies: $totalOut outdated out of $($DepResults.Count) checked" -ForegroundColor White
    }

    Write-Host "`n" -NoNewline
    Write-Host ("=" * 95) -ForegroundColor DarkGray
    Write-Host " SUMMARY " -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host ("=" * 95) -ForegroundColor DarkGray

    $pc = if ($PortableResults) { ($PortableResults | Where-Object { $_.Status -eq 'outdated' }).Count } else { 0 }
    $wc = if ($WingetResults) { $WingetResults.Count } else { 0 }
    $dc = if ($DepResults) { ($DepResults | Where-Object { $_.Status -eq 'outdated' }).Count } else { 0 }
    $total = $pc + $wc + $dc
    Write-Host ""
    Write-Host "  Portable apps needing update:   $pc" -ForegroundColor $(if ($pc -gt 0) { 'Yellow' } else { 'Green' })
    Write-Host "  Winget packages needing update: $wc" -ForegroundColor $(if ($wc -gt 0) { 'Yellow' } else { 'Green' })
    Write-Host "  Code deps needing update:       $dc" -ForegroundColor $(if ($dc -gt 0) { 'Yellow' } else { 'Green' })
    Write-Host ("  " + ("-" * 50)) -ForegroundColor DarkGray
    Write-Host "  Total updates available:        $total" -ForegroundColor $(if ($total -gt 0) { 'Red' } else { 'Green' })
    Write-Host ""
}

# ── Main ──────────────────────────────────────────────────────

Write-Host "`n[*] Comprehensive Update Checker" -ForegroundColor Cyan
Write-Host "  PowerShell $($PSVersionTable.PSVersion)" -ForegroundColor DarkGray

$portableResults = @()
$wingetResults = @()
$depResults = @()

if (-not $SkipWinget) { $wingetResults = Get-WingetUpgrades }
if (-not $SkipPortable) { $portableResults = Get-PortableAppsOnline }
if (-not $SkipDependencies) {
    $paths = if ($DependencyPaths.Count -gt 0) { $DependencyPaths } else { @('E:\Self-Built-Web-and-Mobile-Apps') }
    $depResults = Get-AllDeps -BasePaths $paths
}

if ($Dashboard) {
    Show-Dashboard -PortableResults $portableResults -WingetResults $wingetResults -DepResults $depResults -ExportHtml:$ExportHtml
} else {
    Show-TableReport -PortableResults $portableResults -WingetResults $wingetResults -DepResults $depResults
}
