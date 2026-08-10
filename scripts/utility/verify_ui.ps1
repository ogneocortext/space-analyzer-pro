Add-Type -AssemblyName System.Drawing -ErrorAction Stop
Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WA {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
'@

# Reuse the already-running instance. Never launch, never kill.
$proc = Get-Process -Name SpaceAnalyzer -ErrorAction SilentlyContinue | Select-Object -First 1
if ($proc -eq $null) { Write-Host "NO_RUNNING_INSTANCE"; exit 1 }
$hwnd = $proc.MainWindowHandle
Write-Host ("ATTACHED pid=" + $proc.Id + " hwnd=" + $hwnd)

function Capture($path) {
    $r = New-Object WA+RECT
    [WA]::GetWindowRect($hwnd, [ref]$r) | Out-Null
    $w = $r.Right - $r.Left
    $h = $r.Bottom - $r.Top
    if ($w -le 0 -or $h -le 0) { Write-Host ("BAD_SIZE " + $w + "x" + $h); return }
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    # Capture the window's screen region directly. No cursor movement, no focus change.
    $g.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)))
    $bmp.Save($path)
    Write-Host ("SAVED " + $path + " (" + $w + "x" + $h + ")")
}

function InvokeByName($name) {
    $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $name)
    $el = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
    if ($el -eq $null) { Write-Host ("NOTFOUND " + $name); return $false }
    try {
        $p = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $p.Invoke()
        Write-Host ("INVOKED " + $name)
        return $true
    } catch {
        Write-Host ("INVOKE_FAIL " + $name + " : " + $_.Exception.Message)
        return $false
    }
}

$tmp = "C:\Users\AOMEGA~1\AppData\Local\Temp\kilo"
Capture ($tmp + "\view_before.png")
# Bring to front once so automation is responsive (no cursor movement).
[System.Windows.Automation.AutomationElement]::FromHandle($hwnd).SetFocus() | Out-Null
Start-Sleep -Seconds 1
InvokeByName "History"
Start-Sleep -Seconds 4
Capture ($tmp + "\history_v2.png")
# Restore the user's original view.
InvokeByName "DiskAnalyzer"
Start-Sleep -Seconds 2
Capture ($tmp + "\view_after.png")
Write-Host "DONE"
