#Requires -Version 7
<#
.SYNOPSIS
    Local HTTP server for the update dashboard.
.DESCRIPTION
    Serves the dashboard HTML and provides API endpoints to run
    package updates with live progress streaming via SSE. Update endpoints
    run on a background thread so the listener stays responsive (the
    dashboard, /api/updates, and static assets keep working while an
    update streams).
.PARAMETER Port
    Port to listen on (default: 3847)
#>
param([int]$Port = 3847)

$ErrorActionPreference = 'Continue'
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:${Port}/")
$listener.Start()

# Always-viewable shell (the dashboard's own segment). Served at "/" so the
# dashboard opens instantly without first running the update-generator pipeline.
$shellPath = Join-Path $PSScriptRoot 'update_dashboard' 'shell.html'
# Decoupled data written by check_updates.ps1 -Dashboard (no HTML generation required).
$dataPath = Join-Path $PSScriptRoot 'update_dashboard' 'update_data.json'

# ---- Background / trace logging -------------------------------------------
$logFile = Join-Path $PSScriptRoot 'update_dashboard_server.log'
function Write-Log {
    param([string]$Message, [switch]$NoConsole)
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
    $line = "[$ts] $Message"
    if (-not $NoConsole) { Write-Host $line }
    try { Add-Content -Path $logFile -Value $line -Encoding UTF8 } catch {}
}

function Send-Json {
    param($Context, $Data, [int]$StatusCode = 200)
    try {
        $json = $Data | ConvertTo-Json -Compress -Depth 10
        $buf = [System.Text.Encoding]::UTF8.GetBytes($json)
        $Context.Response.StatusCode = $StatusCode
        $Context.Response.ContentType = 'application/json'
        $Context.Response.ContentLength64 = $buf.Length
        $Context.Response.OutputStream.Write($buf, 0, $buf.Length)
    } catch {
        Write-Log "SEND-JSON ERROR: $($_.Exception.Message)" -NoConsole
    } finally {
        try { $Context.Response.Close() } catch {}
    }
}

function Send-Html {
    param($Context, $Html)
    try {
        $buf = [System.Text.Encoding]::UTF8.GetBytes($Html)
        $Context.Response.StatusCode = 200
        $Context.Response.ContentType = 'text/html; charset=utf-8'
        $Context.Response.ContentLength64 = $buf.Length
        $Context.Response.OutputStream.Write($buf, 0, $buf.Length)
    } catch {
        Write-Log "SEND-HTML ERROR: $($_.Exception.Message)" -NoConsole
    } finally {
        try { $Context.Response.Close() } catch {}
    }
}

# Self-contained update handler. Runs on a background thread (see main loop)
# so the listener never blocks while an update streams. It owns the response
# for the SSE connection end-to-end.
$UpdateJobSb = {
    param($Context, $Body, [string]$Mode, [string]$LogFile)

    function Write-LogThread {
        param([string]$Message)
        $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
        $line = "[$ts] $Message"
        Write-Host $line
        try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch {}
    }

    function Send-SseHeaders {
        param($Context)
        $Context.Response.StatusCode = 200
        $Context.Response.ContentType = 'text/event-stream'
        try { $Context.Response.Headers.Add('Cache-Control', 'no-cache') } catch {}
        try { $Context.Response.Headers.Add('Connection', 'keep-alive') } catch {}
    }

    function Write-Sse {
        param($Context, $EventType, $Data)
        try {
            $json = $Data | ConvertTo-Json -Compress -Depth 5
            $msg = "event: ${EventType}`ndata: ${json}`n`n"
            $buf = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $Context.Response.OutputStream.Write($buf, 0, $buf.Length)
            $Context.Response.OutputStream.Flush()
        } catch {}
    }

    try {
        Send-SseHeaders $Context
        $req = $Body | ConvertFrom-Json -AsHashtable

        if ($Mode -eq 'bulk') {
            $commands = $req['commands']
            Write-Sse $Context 'bulk_start' @{ total = $commands.Count }
            $success = 0; $failed = 0
            Write-LogThread "BULK START: $($commands.Count) command(s)"
            foreach ($item in $commands) {
                $sw = [System.Diagnostics.Stopwatch]::StartNew()
                Write-LogThread "  BULK START $($item.name) cmd=[$($item.cmd)]"
                Write-Sse $Context 'bulk_progress' @{ name = $item.name; cmd = $item.cmd; success = $null }
                try {
                    $output = & pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& { $($item.cmd) } 2>&1" 2>$null
                    $exitCode = $LASTEXITCODE
                    $sw.Stop()
                    if ($exitCode -eq 0) {
                        $success++
                        Write-Sse $Context 'bulk_progress' @{ name = $item.name; cmd = $item.cmd; success = $true; output = ($output -join "`n") }
                        Write-LogThread "  BULK DONE $($item.name) success (exit 0, $($sw.ElapsedMilliseconds)ms)"
                    } else {
                        $failed++
                        Write-Sse $Context 'bulk_progress' @{ name = $item.name; cmd = $item.cmd; success = $false; output = ($output -join "`n") }
                        Write-LogThread "  BULK DONE $($item.name) FAILED (exit $exitCode, $($sw.ElapsedMilliseconds)ms)"
                    }
                } catch {
                    $failed++
                    Write-LogThread "  BULK ERROR $($item.name) - $($_.Exception.Message)"
                    Write-Sse $Context 'bulk_progress' @{ name = $item.name; cmd = $item.cmd; success = $false; output = $_.Exception.Message }
                }
            }
            Write-LogThread "BULK DONE: $($commands.Count) total, $success ok, $failed failed"
            Write-Sse $Context 'bulk_done' @{ total = $commands.Count; success = $success; failed = $failed }
        } else {
            $cmd = $req['cmd']; $name = $req['name']; $method = $req['method']
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            Write-LogThread "UPDATE START: $name ($method) cmd=[$cmd]"
            Write-Sse $Context 'start' @{ name = $name; cmd = $cmd; method = $method }
            try {
                $psi = [System.Diagnostics.ProcessStartInfo]::new()
                $psi.FileName = 'pwsh.exe'
                $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command `"& { $cmd } 2>&1 | ForEach-Object { Write-Output `"`$_`" }`""
                $psi.RedirectStandardOutput = $true
                $psi.RedirectStandardError = $true
                $psi.UseShellExecute = $false
                $psi.CreateNoWindow = $true

                $proc = [System.Diagnostics.Process]::Start($psi)

                while (-not $proc.HasExited) {
                    $line = $proc.StandardOutput.ReadLine()
                    if ($line) {
                        Write-Sse $Context 'output' @{ name = $name; line = $line }
                    }
                    $errLine = $proc.StandardError.ReadLine()
                    if ($errLine) {
                        Write-Sse $Context 'output' @{ name = $name; line = "[err] $errLine" }
                        Write-LogThread "  [stderr] $name : $errLine"
                    }
                }

                # Drain remaining output
                while (-not $proc.StandardOutput.EndOfStream) {
                    $line = $proc.StandardOutput.ReadLine()
                    if ($line) { Write-Sse $Context 'output' @{ name = $name; line = $line }; Write-LogThread "  [stdout] $name : $line" }
                }

                $exitCode = $proc.ExitCode
                $sw.Stop()
                $proc.Dispose()

                if ($exitCode -eq 0) {
                    Write-Sse $Context 'done' @{ name = $name; success = $true; message = "Updated $name" }
                    Write-LogThread "UPDATE DONE: $name success (exit 0, $($sw.ElapsedMilliseconds)ms)"
                } else {
                    Write-Sse $Context 'done' @{ name = $name; success = $false; message = "Failed (exit code $exitCode)" }
                    Write-LogThread "UPDATE DONE: $name FAILED (exit $exitCode, $($sw.ElapsedMilliseconds)ms)"
                }
            } catch {
                Write-Sse $Context 'done' @{ name = $name; success = $false; message = $_.Exception.Message }
                Write-LogThread "UPDATE ERROR: $name - $($_.Exception.Message)"
            }
        }
        Write-Sse $Context 'end' @{}
    } catch {
        Write-LogThread "UPDATE JOB ERROR: $($_.Exception.Message)"
        try { Write-Sse $Context 'end' @{} } catch {}
    } finally {
        try { $Context.Response.Close() } catch {}
    }
}

Write-Host ""
Write-Host "  Update Dashboard Server" -ForegroundColor Cyan
Write-Host "  http://localhost:${Port}" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""
Write-Log "Server started and listening on http://localhost:${Port}/ (log: $logFile)"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $path = $context.Request.Url.AbsolutePath
        $method = $context.Request.HttpMethod

        # CORS
        $context.Response.Headers.Add('Access-Control-Allow-Origin', '*')
        $context.Response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        $context.Response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')

        Write-Log "REQUEST $method $path"

        if ($method -eq 'OPTIONS') {
            Write-Log "  -> OPTIONS preflight"
            $context.Response.StatusCode = 204
            $context.Response.Close()
            continue
        }

        try {
        switch -Regex ($path) {
            '^/$' {
                if (Test-Path $shellPath) {
                    $html = Get-Content $shellPath -Raw -Encoding UTF8
                    Send-Html $Context $html
                } else {
                    $buf = [System.Text.Encoding]::UTF8.GetBytes("Dashboard not found. Run check_updates.ps1 or ensure scripts/utility/update_dashboard/shell.html exists.")
                    $context.Response.StatusCode = 404
                    $context.Response.OutputStream.Write($buf, 0, $buf.Length)
                    $context.Response.Close()
                }
            }
            '^/api/update$' {
                $reader = [System.IO.StreamReader]::new($context.Request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Dispose()
                # Hand off to a background thread so the listener stays responsive.
                $null = Start-ThreadJob -ScriptBlock $UpdateJobSb -ArgumentList $Context, $body, 'single', $logFile
                continue
            }
            '^/api/bulk-update$' {
                $reader = [System.IO.StreamReader]::new($context.Request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Dispose()
                $null = Start-ThreadJob -ScriptBlock $UpdateJobSb -ArgumentList $Context, $body, 'bulk', $logFile
                continue
            }
            '^/api/refresh$' {
                # Re-run the dependency check (portable/winget skipped for speed) which writes
                # update_data.json; then serve the freshly written data.
                Write-Log "REFRESH: re-running check_updates.ps1 -Dashboard -SkipPortable -SkipWinget"
                $genPath = Join-Path $PSScriptRoot 'check_updates.ps1'
                & pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& '$genPath' -Dashboard -SkipPortable -SkipWinget" 2>$null
                if (Test-Path $dataPath) {
                    try {
                        $obj = (Get-Content $dataPath -Raw -Encoding UTF8) | ConvertFrom-Json -AsHashtable
                        Send-Json $Context @{ packages = $obj.packages; timestamp = $obj.timestamp; summary = $obj.summary; projects = $obj.projects }
                        Write-Log "REFRESH complete: $($obj.packages.Count) packages served"
                    } catch {
                        Send-Json $Context @{ packages = @(); timestamp = $null; summary = $null; projects = @() }
                        Write-Log "REFRESH ERROR: failed to parse update_data.json - $($_.Exception.Message)"
                    }
                } else {
                    Send-Json $Context @{ packages = @(); timestamp = $null; summary = $null; projects = @() }
                    Write-Log "REFRESH ERROR: update_data.json not found after generation"
                }
            }
            '^/api/updates$' {
                if (Test-Path $dataPath) {
                    try {
                        $obj = (Get-Content $dataPath -Raw -Encoding UTF8) | ConvertFrom-Json -AsHashtable
                        Send-Json $Context @{ packages = $obj.packages; timestamp = $obj.timestamp; summary = $obj.summary; projects = $obj.projects }
                    } catch {
                        Send-Json $Context @{ packages = @(); timestamp = $null; summary = $null; projects = @() }
                    }
                } else {
                    Send-Json $Context @{ packages = @(); timestamp = $null; summary = $null }
                }
            }
            '^/shell$' {
                if (Test-Path $shellPath) {
                    $html = Get-Content $shellPath -Raw -Encoding UTF8
                    Send-Html $Context $html
                } else { $context.Response.StatusCode = 404; $context.Response.Close() }
            }
            '^/full$' {
                if (Test-Path $shellPath) {
                    $html = Get-Content $shellPath -Raw -Encoding UTF8
                    Send-Html $Context $html
                } else { $context.Response.StatusCode = 404; $context.Response.Close() }
            }
            '^/update_dashboard/(.+)$' {
                $name = $matches[1]
                $fp = Join-Path $PSScriptRoot 'update_dashboard' $name
                if (Test-Path $fp -PathType Leaf) {
                    $ext = [System.IO.Path]::GetExtension($fp).ToLower()
                    $ct = switch ($ext) {
                        '.css' { 'text/css' }
                        '.js' { 'application/javascript' }
                        '.html' { 'text/html; charset=utf-8' }
                        '.json' { 'application/json' }
                        default { 'application/octet-stream' }
                    }
                    $buf = [System.Text.Encoding]::UTF8.GetBytes((Get-Content $fp -Raw -Encoding UTF8))
                    $context.Response.StatusCode = 200
                    $context.Response.ContentType = $ct
                    $context.Response.OutputStream.Write($buf, 0, $buf.Length)
                    $context.Response.Close()
                } else { $context.Response.StatusCode = 404; $context.Response.Close() }
            }
            default {
                $context.Response.StatusCode = 404
                $context.Response.Close()
            }
        }
        } catch {
            Write-Host "  Request handler error: $($_.Exception.Message)" -ForegroundColor Red
            Write-Log "REQUEST ERROR: $method $path - $($_.Exception.Message)"
            try { $context.Response.StatusCode = 500; $context.Response.Close() } catch {}
        }

        # Reap completed background update jobs so they don't accumulate.
        try { Get-Job -State Completed -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue } catch {}
    }
} finally {
    Write-Log "Server stopped."
    $listener.Stop()
    $listener.Dispose()
    Write-Host "`n  Server stopped." -ForegroundColor Yellow
}
