#Requires -Version 7
<#
.SYNOPSIS
    Capture a screenshot (primary screen or a named window) to a PNG file.
.DESCRIPTION
    Runs under PowerShell 7 using System.Drawing.Common loaded from the .NET
    Windows Desktop runtime plus Win32 P/Invoke. No Windows.Forms dependency.
.PARAMETER WindowTitle
    Substring of a top-level window title to capture. If omitted, the entire
    primary screen is captured.
.PARAMETER OutputPath
    Destination PNG path.
#>
param(
    [string]$WindowTitle,
    [string]$OutputPath = "E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\screenshot.png"
)

$ErrorActionPreference = 'Stop'

# Locate System.Drawing.Common from the .NET Windows Desktop runtime (pwsh 7 has no GAC copy).
$sdCommon = @(
    "C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App\10.0.11\System.Drawing.Common.dll",
    "C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App\8.0.30\System.Drawing.Common.dll"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $sdCommon) { throw 'System.Drawing.Common not found in the .NET Windows Desktop runtime.' }
Add-Type -Path $sdCommon

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CaptureApi {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
'@

function Save-Bitmap {
    param([int]$X, [int]$Y, [int]$W, [int]$H, [string]$Path)
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.CopyFromScreen($X, $Y, 0, 0, $bmp.Size)
        $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $g.Dispose()
        $bmp.Dispose()
    }
    Write-Host "Saved $Path (${W}x${H})"
}

if ($WindowTitle) {
    $proc = Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Contains($WindowTitle) } |
        Select-Object -First 1
    if (-not $proc) { throw "No window whose title contains '$WindowTitle' was found." }
    $r = New-Object CaptureApi+RECT
    [CaptureApi]::GetWindowRect($proc.MainWindowHandle, [ref]$r) | Out-Null
    $w = $r.Right - $r.Left
    $h = $r.Bottom - $r.Top
    if ($w -le 0 -or $h -le 0) { throw "Window '" + $proc.MainWindowTitle + "' reported a non-positive size (${w}x${h})." }
    Save-Bitmap $r.Left $r.Top $w $h $OutputPath
} else {
    $w = [CaptureApi]::GetSystemMetrics(0)
    $h = [CaptureApi]::GetSystemMetrics(1)
    Save-Bitmap 0 0 $w $h $OutputPath
}
