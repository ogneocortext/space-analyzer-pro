// Licensed under the MIT License.

using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using Windows.Storage.Pickers;
using WinRT.Interop;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Centralised UI helper methods for the WinUI 3 front-end.
/// </summary>
public static class UiHelper
{
    // ── Folder picker ───────────────────────────────────────────────

    /// <summary>
    /// Opens a folder picker dialog and returns the selected path, or <c>null</c> if cancelled.
    /// </summary>
    public static async Task<string?> PickFolderAsync()
    {
        var picker = new FolderPicker();
        picker.FileTypeFilter.Add("*");

        // WinUI 3 desktop apps have no Window.Current (it is always null), so the
        // picker must be initialized with the handle of the app's main window.
        var window = MainWindow.Current as Microsoft.UI.Xaml.Window ?? Microsoft.UI.Xaml.Window.Current;
        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(window);
        WinRT.Interop.InitializeWithWindow.Initialize(picker, hwnd);
        var folder = await picker.PickSingleFolderAsync();
        return folder?.Path;
    }

    // ── File picker ───────────────────────────────────────────────

    /// <summary>
    /// Opens a file picker dialog and returns the selected file path, or <c>null</c> if cancelled.
    /// </summary>
    public static async Task<string?> PickFileAsync(params string[]? fileTypeFilter)
    {
        var picker = new FileOpenPicker();
        var filter = fileTypeFilter is { Length: > 0 } ? fileTypeFilter : new[] { "*" };
        foreach (var ft in filter)
            picker.FileTypeFilter.Add(ft);

        var window = MainWindow.Current as Microsoft.UI.Xaml.Window ?? Microsoft.UI.Xaml.Window.Current;
        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(window);
        WinRT.Interop.InitializeWithWindow.Initialize(picker, hwnd);
        var file = await picker.PickSingleFileAsync();
        return file?.Path;
    }

    // ── Navigation view ─────────────────────────────────────────────

    /// <summary>
    /// Finds the nearest <see cref="NavigationView"/> ancestor of <paramref name="element"/>.
    /// Returns <c>null</c> if not found.
    /// </summary>
    public static NavigationView? FindNavigationView(DependencyObject? element)
        => FindAncestor<NavigationView>(element);

    private static T? FindAncestor<T>(DependencyObject? start) where T : DependencyObject
    {
        while (start is not null)
        {
            if (start is T target) return target;
            start = VisualTreeHelper.GetParent(start);
        }
        return null;
    }

    // ── Usage colors ────────────────────────────────────────────────

    /// <summary>
    /// Maps a percentage (0-100) to a semantic color brush:
    /// <c>>= 90</c> = Error, <c>>= 70</c> = Warning, otherwise Success.
    /// Resolves theme-aware brushes from App.xaml resources.
    /// </summary>
    private static SolidColorBrush GetThemeBrush(string key)
        => Application.Current.Resources[key] as SolidColorBrush
           ?? new SolidColorBrush(Colors.Gray);

    public static SolidColorBrush GetUsageBrush(double percent)
    {
        if (double.IsNaN(percent) || double.IsInfinity(percent))
            return GetThemeBrush("SuccessBrush");

        return percent switch
        {
            >= 90 => GetThemeBrush("ErrorBrush"),
            >= 70 => GetThemeBrush("WarningBrush"),
            _ => GetThemeBrush("SuccessBrush"),
        };
    }

    // ── System memory ───────────────────────────────────────────────

    /// <summary>
    /// Gets the current system memory status via GlobalMemoryStatusEx.
    /// </summary>
    /// <param name="memStatus">Receives the memory status structure.</param>
    /// <returns><c>true</c> if the call succeeded.</returns>
    public static bool GetMemoryStatus(out MemoryStatusEx memStatus)
    {
        memStatus = new MemoryStatusEx { dwLength = (uint)Marshal.SizeOf<MemoryStatusEx>() };
        return GlobalMemoryStatusEx(ref memStatus);
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MemoryStatusEx
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool GlobalMemoryStatusEx([In, Out] ref MemoryStatusEx lpBuffer);

    // ── Open path ──────────────────────────────────────────────

    /// <summary>
    /// Opens a file or folder path using the default system handler.
    /// </summary>
    public static void OpenPath(string path)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true,
            };
            Process.Start(psi);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[UiHelper] OpenPath failed: {ex}");
        }
    }
}
