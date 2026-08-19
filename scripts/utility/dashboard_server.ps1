#Requires -Version 7
<#
.SYNOPSIS
    Local HTTP server for the update dashboard.
.DESCRIPTION
    Serves the dashboard HTML and provides API endpoints to run
    package updates with live progress streaming via SSE.
.PARAMETER Port
    Port to listen on (default: 3847)
#>
param([int]$Port = 3847)

$ErrorActionPreference = 'Continue'
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:${Port}/")
$listener.Start()

$dashboardPath = Join-Path (Split-Path $PSScriptRoot) '..' 'update_dashboard.html'
if (-not (Test-Path $dashboardPath)) {
    $dashboardPath = Join-Path (Get-Location) 'update_dashboard.html'
}

Write-Host ""
Write-Host "  Update Dashboard Server" -ForegroundColor Cyan
Write-Host "  http://localhost:${Port}" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

function Send-Json {
    param($Context, $Data, [int]$StatusCode = 200)
    $json = $Data | ConvertTo-Json -Compress -Depth 10
    $buf = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = 'application/json'
    $Context.Response.ContentLength64 = $buf.Length
    $Context.Response.OutputStream.Write($buf, 0, $buf.Length)
    $Context.Response.Close()
}

function Send-Html {
    param($Context, $Html)
    $buf = [System.Text.Encoding]::UTF8.GetBytes($Html)
    $Context.Response.StatusCode = 200
    $Context.Response.ContentType = 'text/html; charset=utf-8'
    $Context.Response.ContentLength64 = $buf.Length
    $Context.Response.OutputStream.Write($buf, 0, $buf.Length)
    $Context.Response.Close()
}

function Send-SseHeaders {
    param($Context)
    $Context.Response.StatusCode = 200
    $Context.Response.ContentType = 'text/event-stream'
    $Context.Response.Headers.Add('Cache-Control', 'no-cache')
    $Context.Response.Headers.Add('Connection', 'keep-alive')
    $Context.Response.Headers.Add('Access-Control-Allow-Origin', '*')
}

function Write-Sse {
    param($Context, $EventType, $Data)
    $json = $Data | ConvertTo-Json -Compress -Depth 5
    $msg = "event: ${EventType}`ndata: ${json}`n`n"
    $buf = [System.Text.Encoding]::UTF8.GetBytes($msg)
    try {
        $Context.Response.OutputStream.Write($buf, 0, $buf.Length)
        $Context.Response.OutputStream.Flush()
    } catch {}
}

function Run-Update {
    param($Context, $Body)
    $req = $Body | ConvertFrom-Json -AsHashtable
    $cmd = $req['cmd']
    $name = $req['name']
    $method = $req['method']

    Send-SseHeaders $Context
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
            }
        }

        # Drain remaining output
        while (-not $proc.StandardOutput.EndOfStream) {
            $line = $proc.StandardOutput.ReadLine()
            if ($line) { Write-Sse $Context 'output' @{ name = $name; line = $line } }
        }

        $exitCode = $proc.ExitCode
        $proc.Dispose()

        if ($exitCode -eq 0) {
            Write-Sse $Context 'done' @{ name = $name; success = $true; message = "Updated $name" }
        } else {
            Write-Sse $Context 'done' @{ name = $name; success = $false; message = "Failed (exit code $exitCode)" }
        }
    } catch {
        Write-Sse $Context 'done' @{ name = $name; success = $false; message = $_.Exception.Message }
    }

    Write-Sse $Context 'end' @{}
    $Context.Response.Close()
}

function Run-BulkUpdate {
    param($Context, $Body)
    $req = $Body | ConvertFrom-Json -AsHashtable
    $commands = $req['commands']

    Send-SseHeaders $Context
    Write-Sse $Context 'bulk_start' @{ total = $commands.Count }

    $success = 0
    $failed = 0

    foreach ($item in $commands) {
        Write-Sse $Context 'bulk_progress' @{ name = $item.name; cmd = $item.cmd; success = $null }

        try {
            $output = & pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& { $($item.cmd) } 2>&1" 2>$null
            $exitCode = $LASTEXITCODE

            if ($exitCode -eq 0) {
                $success++
                Write-Sse $Context 'bulk_progress' @{ name = $item.name; cmd = $item.cmd; success = $true; output = ($output -join "`n") }
            } else {
                $failed++
                Write-Sse $Context 'bulk_progress' @{ name = $item.name; cmd = $item.cmd; success = $false; output = ($output -join "`n") }
            }
        } catch {
            $failed++
            Write-Sse $Context 'bulk_progress' @{ name = $item.name; cmd = $item.cmd; success = $false; output = $_.Exception.Message }
        }
    }

    Write-Sse $Context 'bulk_done' @{ total = $commands.Count; success = $success; failed = $failed }
    Write-Sse $Context 'end' @{}
    $Context.Response.Close()
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $path = $context.Request.Url.AbsolutePath
        $method = $context.Request.HttpMethod

        # CORS
        $context.Response.Headers.Add('Access-Control-Allow-Origin', '*')
        $context.Response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        $context.Response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')

        if ($method -eq 'OPTIONS') {
            $context.Response.StatusCode = 204
            $context.Response.Close()
            continue
        }

        switch -Regex ($path) {
            '^/$' {
                if (Test-Path $dashboardPath) {
                    $html = Get-Content $dashboardPath -Raw -Encoding UTF8
                    Send-Html $Context $html
                } else {
                    $buf = [System.Text.Encoding]::UTF8.GetBytes("Dashboard not found at $dashboardPath")
                    $context.Response.StatusCode = 404
                    $context.Response.OutputStream.Write($buf, 0, $buf.Length)
                    $context.Response.Close()
                }
            }
            '^/api/update$' {
                $reader = [System.IO.StreamReader]::new($context.Request.InputStream)
                $body = $reader.ReadToEnd()
                Run-Update $Context $body
            }
            '^/api/bulk-update$' {
                $reader = [System.IO.StreamReader]::new($context.Request.InputStream)
                $body = $reader.ReadToEnd()
                Run-BulkUpdate $Context $body
            }
            '^/api/scan$' {
                $out = & pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& 'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\scripts\utility\check_updates.ps1' -SkipPortable -SkipWinget -OutputFormat json" 2>$null
                try { $json = $out | ConvertFrom-Json -AsHashtable } catch { $json = @() }
                Send-Json $Context @{ packages = $json; timestamp = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') }
            }
            default {
                $context.Response.StatusCode = 404
                $context.Response.Close()
            }
        }
    }
} finally {
    $listener.Stop()
    $listener.Dispose()
    Write-Host "`n  Server stopped." -ForegroundColor Yellow
}
