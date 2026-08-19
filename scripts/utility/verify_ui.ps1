#Requires -Version 7
<#
.SYNOPSIS
    Capture the running Space Analyzer Pro window and (best-effort) navigate to a page.
.DESCRIPTION
    Attaches to the already-running SpaceAnalyzer process, captures its window
    before navigation, attempts to click a named navigation item via UI Automation,
    then captures again afterwards. Runs under PowerShell 7 using System.Drawing.Common
    loaded from the .NET Windows Desktop runtime.
.PARAMETER PageName
    Display name of the navigation item to click (e.g. 'History').
.PARAMETER TempDir
    Directory for the before/after PNG captures.
#>
param(
    [string]$PageName = 'History',
    [string]$TempDir = "C:\Users\AOMEGA~1\AppData\Local\Temp\kilo"
)

$ErrorActionPreference = 'Continue'

# Reuse the shared capture helpers (loads System.Drawing.Common + CaptureApi, then
# exposes Save-Bitmap / Save-HwndCapture / Save-WindowCapture / Save-ScreenCapture).
$CaptureScript = Join-Path $PSScriptRoot 'capture.ps1'
if (-not (Test-Path $CaptureScript)) { Write-Host 'capture.ps1 not found.'; exit 1 }
. $CaptureScript

# Reuse the already-running instance. Never launch, never kill.
$proc = Get-Process -Name SpaceAnalyzer -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Host 'NO_RUNNING_INSTANCE'; exit 1 }
$hwnd = $proc.MainWindowHandle
Write-Host "ATTACHED pid=$($proc.Id) hwnd=$hwnd title='$($proc.MainWindowTitle)'"

if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir | Out-Null }

Save-HwndCapture -Hwnd $hwnd -OutputPath "$TempDir\view_before.png"

# Bring to front so the window is on-screen.
[System.Windows.Automation.AutomationElement]::FromHandle($hwnd).SetFocus() 2>$null
Start-Sleep -Seconds 1

# Attempt UI Automation navigation (may be unavailable in some environments).
$root = $null
try {
    $r = "C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App\10.0.11"
    Add-Type -Path (Join-Path $r 'UIAutomationTypes.dll') -ErrorAction Stop
    Add-Type -Path (Join-Path $r 'UIAutomationClient.dll') -ErrorAction Stop
    $root = [System.Windows.Automation.AutomationElement]::RootElement
} catch { Write-Host "UIA_INIT_FAIL: $($_.Exception.Message)" }

$clicked = $false
if ($root) {
    try {
        $cond = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::NameProperty, $PageName)
        $el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
        if ($el) {
            $p = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            $p.Invoke()
            $clicked = $true
            Write-Host "INVOKED $PageName"
        } else { Write-Host "NOTFOUND $PageName" }
    } catch { Write-Host "UIA_NAV_FAIL: $($_.Exception.Message)" }
}

if (-not $clicked) {
    Write-Host "AUTOMATION_UNAVAILABLE: navigate to '$PageName' manually, then press Enter to capture."
    Read-Host -Prompt 'Press Enter after navigating'
}

Start-Sleep -Seconds 4
Save-HwndCapture -Hwnd $hwnd -OutputPath "$TempDir\view_after.png"
Write-Host 'DONE'
