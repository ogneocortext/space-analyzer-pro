#Requires -Version 7
<#
.SYNOPSIS
    Send a screenshot to the local Ollama vision model and print its analysis.
.DESCRIPTION
    Reads a PNG, base64-encodes it, and posts it to Ollama's generate endpoint.
.PARAMETER ImagePath
    PNG screenshot to analyze.
.PARAMETER Model
    Ollama vision model to use.
.PARAMETER Prompt
    Analysis prompt. Defaults to a Space Analyzer Pro History page review.
#>
param(
    [string]$ImagePath = "C:\Users\AOMEGA~1\AppData\Local\Temp\kilo\history_v2.png",
    [string]$Model = "gemma4:e2b-it-qat",
    [string]$Prompt = @'
This is the History page of Space Analyzer Pro (a WinUI 3 desktop app). Verify these UI elements and report problems: (1) A 'Size Trend' line/area chart near the top showing full-history size usage. (2) A small chip/badge under the title summarizing duplicate scans (e.g. 'N duplicate scans across M folders'). (3) In the search/sort bar: buttons 'Date', 'Size', 'Files', 'Dupes', and a 'Duplicates only' toggle. (4) The 'Delete Duplicates' button with a numeric count badge. (5) Scan cards rendered as expanders with a one-line summary (path, date, size, file count) and expandable detail. (6) A maintenance area with grouped expanders (Cleanup & Prune, Database, Danger Zone). Report any layout problems, overlapping text, cut-off controls, or errors. Be concise.
'@
)

$bytes = [System.IO.File]::ReadAllBytes($ImagePath)
$b64 = [System.Convert]::ToBase64String($bytes)
$body = @{ model = $Model; prompt = $Prompt; images = @($b64); stream = $false } | ConvertTo-Json -Depth 3
$resp = Invoke-RestMethod -Uri 'http://localhost:11434/api/generate' -Method Post -Body $body -ContentType 'application/json'
Write-Host $resp.response
