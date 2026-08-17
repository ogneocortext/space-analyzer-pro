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

# Load System.Drawing.Common from the .NET Windows Desktop runtime.
$sdCommon = @(
    "C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App\10.0.11\System.Drawing.Common.dll",
    "C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App\8.0.30\System.Drawing.Common.dll"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $sdCommon) { Write-Host 'System.Drawing.Common not found.'; exit 1 }
Add-Type -Path $sdCommon

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CaptureApi {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
'@

# Reuse the already-running instance. Never launch, never kill.
$proc = Get-Process -Name SpaceAnalyzer -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Host 'NO_RUNNING_INSTANCE'; exit 1 }
$hwnd = $proc.MainWindowHandle
Write-Host "ATTACHED pid=$($proc.Id) hwnd=$hwnd title='$($proc.MainWindowTitle)'"

function Capture {
    param([string]$Path)
    $r = New-Object CaptureApi+RECT
    [CaptureApi]::GetWindowRect($hwnd, [ref]$r) | Out-Null
    $w = $r.Right - $r.Left
    $h = $r.Bottom - $r.Top
    if ($w -le 0 -or $h -le 0) { Write-Host "BAD_SIZE ${w}x${h}"; return }
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
        $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $g.Dispose()
        $bmp.Dispose()
    }
    Write-Host "SAVED $Path (${w}x${h})"
}

if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir | Out-Null }

Capture "$TempDir\view_before.png"

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
Capture "$TempDir\view_after.png"
Write-Host 'DONE'
