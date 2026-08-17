// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

public partial class SettingsViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;

    // ── Appearance ──

    public string Theme
    {
        get => AppSettings.Theme;
        set
        {
            if (AppSettings.Theme == value) return;
            AppSettings.Theme = value;
            OnPropertyChanged();
            ApplyTheme(value);
        }
    }

    private static void ApplyTheme(string theme)
    {
        try
        {
            var requested = ThemeHelper.ResolveTheme(theme);
            if (MainWindow.Current?.Content is Microsoft.UI.Xaml.FrameworkElement root)
            {
                root.RequestedTheme = requested switch
                {
                    Microsoft.UI.Xaml.ApplicationTheme.Light => Microsoft.UI.Xaml.ElementTheme.Light,
                    Microsoft.UI.Xaml.ApplicationTheme.Dark => Microsoft.UI.Xaml.ElementTheme.Dark,
                    _ => Microsoft.UI.Xaml.ElementTheme.Default
                };
            }
            else
            {
                Application.Current.RequestedTheme = requested;
            }
        }
        catch { /* non-fatal */ }
    }

    // ── Scanner ──

    public string ScannerPath
    {
        get
        {
            var stored = SettingsStore.Get(SettingKeys.ScannerPath);
            if (!string.IsNullOrWhiteSpace(stored))
                return stored;
            return _scanner.ScannerPath;
        }
        set
        {
            if (ScannerPath == value) return;
            AppSettings.ScannerPath = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsScannerPathValid));
            OnPropertyChanged(nameof(ScannerPathStatus));
        }
    }

    public bool IsScannerPathValid => !string.IsNullOrWhiteSpace(ScannerPath) && System.IO.File.Exists(ScannerPath);

    public string ScannerPathStatus => ScannerPath switch
    {
        null or "" => "No path set",
        _ when IsScannerPathValid => "Scanner found",
        _ => "Scanner not found at this path",
    };

    public double ScanDepth
    {
        get => AppSettings.ScanDepth;
        set { if (AppSettings.ScanDepth == value) return; AppSettings.ScanDepth = value; OnPropertyChanged(); }
    }

    public bool IncludeHidden
    {
        get => AppSettings.IncludeHidden;
        set { if (AppSettings.IncludeHidden == value) return; AppSettings.IncludeHidden = value; OnPropertyChanged(); }
    }

    public bool GpuAcceleration
    {
        get => AppSettings.GpuAcceleration;
        set { if (AppSettings.GpuAcceleration == value) return; AppSettings.GpuAcceleration = value; OnPropertyChanged(); }
    }

    public bool UseFileCache
    {
        get => AppSettings.UseFileCache;
        set { if (AppSettings.UseFileCache == value) return; AppSettings.UseFileCache = value; OnPropertyChanged(); }
    }

    public string DefaultScanPaths
    {
        get => AppSettings.DefaultScanPaths;
        set { if (AppSettings.DefaultScanPaths == value) return; AppSettings.DefaultScanPaths = value; OnPropertyChanged(); }
    }

    public List<string> DefaultScanPathList
    {
        get
        {
            var raw = AppSettings.DefaultScanPaths;
            if (string.IsNullOrWhiteSpace(raw))
                return new List<string>();
            return raw
                .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(p => p.Trim())
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .ToList();
        }
    }
}
