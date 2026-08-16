// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the Settings page. Acts as the editable binding surface for
/// <see cref="AppSettings"/> — the canonical, persisted source of truth. Each
/// property reads/writes <see cref="AppSettings"/>, so values and their
/// defaults are defined once and shared by every other feature in the app.
/// Auto-saves on every change (the setter persists through
/// <see cref="AppSettings"/>), so settings survive rebuilds/restarts.
/// </summary>
public class SettingsViewModel : ViewModelBase, IDisposable
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

            // WinUI 3 only honours Application.RequestedTheme when set before the
            // first window content is created. After that it throws, so apply the
            // theme to the live root element instead (element-level themes can be
            // changed at any time). This lets the Settings picker switch themes
            // live without a restart.
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
            // Fall back to the auto-discovered scanner binary when nothing is stored.
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

    // ── Ollama ──

    public string OllamaUrl
    {
        get => AppSettings.OllamaUrl;
        set { if (AppSettings.OllamaUrl == value) return; AppSettings.OllamaUrl = value; OnPropertyChanged(); }
    }

    public string OllamaModel
    {
        get => AppSettings.OllamaModel;
        set { if (AppSettings.OllamaModel == value) return; AppSettings.OllamaModel = value; OnPropertyChanged(); }
    }

    public bool OllamaEnabled
    {
        get => AppSettings.OllamaEnabled;
        set
        {
            if (AppSettings.OllamaEnabled == value) return;
            AppSettings.OllamaEnabled = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(OllamaOptionsEnabled));
            OnPropertyChanged(nameof(ManualModelEnabled));
            OnPropertyChanged(nameof(AgenticOptionsEnabled));
        }
    }

    public bool OllamaThink
    {
        get => AppSettings.OllamaThink;
        set { if (AppSettings.OllamaThink == value) return; AppSettings.OllamaThink = value; OnPropertyChanged(); }
    }

    public bool AgenticToolsEnabled
    {
        get => AppSettings.AgenticToolsEnabled;
        set
        {
            if (AppSettings.AgenticToolsEnabled == value) return;
            AppSettings.AgenticToolsEnabled = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(AgenticOptionsEnabled));
        }
    }

    public bool AutoModelSelection
    {
        get => AppSettings.AutoModelSelection;
        set
        {
            if (AppSettings.AutoModelSelection == value) return;
            AppSettings.AutoModelSelection = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(ManualModelEnabled));
        }
    }

    public string ToolCallingModel
    {
        get => AppSettings.ToolCallingModel;
        set { if (AppSettings.ToolCallingModel == value) return; AppSettings.ToolCallingModel = value; OnPropertyChanged(); }
    }

    public string ToolChoice
    {
        get => AppSettings.ToolChoice;
        set { if (AppSettings.ToolChoice == value) return; AppSettings.ToolChoice = value; OnPropertyChanged(); }
    }

    // ── UI: Advanced mode ──

    public bool AdvancedMode
    {
        get => AppSettings.AdvancedMode;
        set { if (AppSettings.AdvancedMode == value) return; AppSettings.AdvancedMode = value; OnPropertyChanged(); }
    }

    /// <summary>True when AI is enabled — gates the Connection and Chat model groups
    /// so their controls grey out (and read as "needs AI on") instead of being
    /// independently toggleable with no effect.</summary>
    public bool OllamaOptionsEnabled => OllamaEnabled;

    /// <summary>True when the manual chat model field is editable (AI on and
    /// auto-select off). When auto-select is on the field is disabled with a note.</summary>
    public bool ManualModelEnabled => OllamaEnabled && !AutoModelSelection;

    /// <summary>True when the agentic-tool controls are editable (AI on and agentic
    /// tools enabled).</summary>
    public bool AgenticOptionsEnabled => OllamaEnabled && AgenticToolsEnabled;

    // ── Ollama connection test ──

    private bool _ollamaTesting;
    public bool OllamaTesting
    {
        get => _ollamaTesting;
        set { _ollamaTesting = value; OnPropertyChanged(); }
    }

    private string _ollamaTestResult = string.Empty;
    public string OllamaTestResult
    {
        get => _ollamaTestResult;
        set { _ollamaTestResult = value; OnPropertyChanged(); }
    }

    private SolidColorBrush _ollamaTestBrush = GetThemeBrush("MutedBrush");
    public SolidColorBrush OllamaTestBrush
    {
        get => _ollamaTestBrush;
        set { _ollamaTestBrush = value; OnPropertyChanged(); }
    }

    // ── Detected models (from /api/tags) ──

    public ObservableCollection<string> DetectedModels { get; } = new();

    public bool HasDetectedModels => DetectedModels.Count > 0;

    public string DetectedModelsSummary =>
        DetectedModels.Count == 0 ? "No models detected" : $"{DetectedModels.Count} model(s) available";

    /// <summary>
    /// Queries the Ollama server for installed models and populates
    /// <see cref="DetectedModels"/>, reusing <see cref="OllamaClient"/> so the
    /// /api/tags fetch/parse logic lives in exactly one place. Swallows failures
    /// when the server is offline.
    /// </summary>
    public async Task RefreshDetectedModelsAsync()
    {
        try
        {
            using var client = new OllamaClient(OllamaUrl);
            var models = await client.GetInstalledModelsAsync();
            var names = models
                .Select(m => m.Name)
                .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                .ToList();

            DetectedModels.Clear();
            foreach (var n in names)
                DetectedModels.Add(n);

            OnPropertyChanged(nameof(HasDetectedModels));
            OnPropertyChanged(nameof(DetectedModelsSummary));
        }
        catch
        {
            // Server offline — leave whatever list is currently shown.
        }
    }

    public async Task TestOllamaConnectionAsync()
    {
        OllamaTesting = true;
        OllamaTestResult = "Testing...";
        OllamaTestBrush = GetThemeBrush("MutedBrush");
        try
        {
            using var client = new OllamaClient(OllamaUrl);
            if (await client.IsAvailableAsync())
            {
                await RefreshDetectedModelsAsync();
                OllamaTestResult = DetectedModels.Count == 0
                    ? "Connected (no models found)"
                    : $"Connected — {DetectedModels.Count} model(s) available";
                OllamaTestBrush = GetThemeBrush("SuccessBrush");
            }
            else
            {
                OllamaTestResult = "Ollama server not reachable";
                OllamaTestBrush = GetThemeBrush("WarningBrush");
            }
        }
        catch (Exception ex)
        {
            OllamaTestResult = ex.Message.Length > 60 ? ex.Message[..60] : ex.Message;
            OllamaTestBrush = GetThemeBrush("ErrorBrush");
        }
        finally
        {
            OllamaTesting = false;
        }
    }

    // ── Lifecycle ──

    public SettingsViewModel()
    {
        _ = LoadAsync();
        _ = RefreshDetectedModelsAsync();
    }

    private async Task LoadAsync()
    {
        await SettingsStore.EnsureLoadedAsync();
        NotifyAll();
        ApplyTheme(AppSettings.Theme);
    }

    /// <summary>Refreshes all bound properties after the settings cache has loaded.</summary>
    private void NotifyAll()
    {
        OnPropertyChanged(nameof(Theme));
        OnPropertyChanged(nameof(ScannerPath));
        OnPropertyChanged(nameof(IsScannerPathValid));
        OnPropertyChanged(nameof(ScannerPathStatus));
        OnPropertyChanged(nameof(ScanDepth));
        OnPropertyChanged(nameof(IncludeHidden));
        OnPropertyChanged(nameof(GpuAcceleration));
        OnPropertyChanged(nameof(UseFileCache));
        OnPropertyChanged(nameof(DefaultScanPaths));
        OnPropertyChanged(nameof(OllamaUrl));
        OnPropertyChanged(nameof(OllamaModel));
        OnPropertyChanged(nameof(OllamaEnabled));
        OnPropertyChanged(nameof(OllamaThink));
        OnPropertyChanged(nameof(AgenticToolsEnabled));
        OnPropertyChanged(nameof(AutoModelSelection));
        OnPropertyChanged(nameof(ToolCallingModel));
        OnPropertyChanged(nameof(ToolChoice));
        OnPropertyChanged(nameof(AdvancedMode));
        OnPropertyChanged(nameof(OllamaOptionsEnabled));
        OnPropertyChanged(nameof(ManualModelEnabled));
        OnPropertyChanged(nameof(AgenticOptionsEnabled));
    }

    public void ResetToDefaults()
    {
        // Defaults live only in AppSettings.Defaults; delegate so the two can never drift.
        AppSettings.ResetToDefaults();
        NotifyAll();
        OllamaTestResult = string.Empty;
        OllamaTestBrush = GetThemeBrush("MutedBrush");
    }

    private static SolidColorBrush GetThemeBrush(string key)
        => Application.Current.Resources[key] as SolidColorBrush
           ?? new SolidColorBrush(Microsoft.UI.Colors.Gray);

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _scanner.Dispose();
        GC.SuppressFinalize(this);
    }
}
