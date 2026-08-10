$imgPath = "C:\Users\AOMEGA~1\AppData\Local\Temp\kilo\history_v2.png"
$bytes = [System.IO.File]::ReadAllBytes($imgPath)
$b64 = [System.Convert]::ToBase64String($bytes)
$prompt = "This is the History page of Space Analyzer Pro (WinUI 3 desktop app). Verify these UI elements and report problems: (1) A 'Size Trend' line/area chart near the top showing full-history size usage. (2) A small chip/badge under the title summarizing duplicate scans (e.g. 'N duplicate scans across M folders'). (3) In the search/sort bar: buttons 'Date', 'Size', 'Files', 'Dupes', and a 'Duplicates only' toggle. (4) The 'Delete Duplicates' button with a numeric count badge. (5) Column header row above the scan list (FILES | SIZE | DURATION | DEPTH). (6) Any scan-type color badge on cards. Report any layout problems, overlapping text, cut-off controls, or errors. Be concise."
$body = @{ model = "gemma4:e2b-it-qat"; prompt = $prompt; images = @($b64); stream = $false } | ConvertTo-Json -Depth 3
$resp = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -Body $body -ContentType "application/json"
Write-Host $resp.response
