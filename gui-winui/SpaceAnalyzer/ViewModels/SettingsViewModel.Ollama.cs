// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

public partial class SettingsViewModel
{
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
            if (value)
                _ = RefreshConnectionStatusAsync();
            else
            {
                ConnectionStatusText = "AI disabled";
                ConnectionStatusBrush = GetThemeBrush("MutedBrush");
            }
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

    public bool NotificationsEnabled
    {
        get => AppSettings.NotificationsEnabled;
        set { if (AppSettings.NotificationsEnabled == value) return; AppSettings.NotificationsEnabled = value; OnPropertyChanged(); }
    }

    public bool OllamaOptionsEnabled => OllamaEnabled;

    public bool ManualModelEnabled => OllamaEnabled && !AutoModelSelection;

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

    // ── Live connection status (auto-refreshed) ──

    private bool _isCheckingConnection;
    public bool IsCheckingConnection
    {
        get => _isCheckingConnection;
        set { _isCheckingConnection = value; OnPropertyChanged(); }
    }

    private string _connectionStatusText = "Not checked";
    public string ConnectionStatusText
    {
        get => _connectionStatusText;
        set { _connectionStatusText = value; OnPropertyChanged(); }
    }

    private SolidColorBrush _connectionStatusBrush = GetThemeBrush("MutedBrush");
    public SolidColorBrush ConnectionStatusBrush
    {
        get => _connectionStatusBrush;
        set { _connectionStatusBrush = value; OnPropertyChanged(); }
    }

    // ── Model list search/filter ──

    public ObservableCollection<string> FilteredModels { get; } = new();

    public bool HasFilteredModels => FilteredModels.Count > 0;

    private string _modelSearchText = string.Empty;
    public string ModelSearchText
    {
        get => _modelSearchText;
        set
        {
            if (_modelSearchText == value) return;
            _modelSearchText = value;
            OnPropertyChanged();
            UpdateFilteredModels();
        }
    }

    // ── Detected models (from /api/tags) ──

    public ObservableCollection<string> DetectedModels { get; } = new();

    public bool HasDetectedModels => DetectedModels.Count > 0;

    public string DetectedModelsSummary =>
        DetectedModels.Count == 0 ? "No models detected" : $"{DetectedModels.Count} model(s) available";

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
            UpdateFilteredModels();

            OnPropertyChanged(nameof(HasDetectedModels));
            OnPropertyChanged(nameof(DetectedModelsSummary));
        }
        catch
        {
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
        ConnectionStatusText = OllamaTestResult;
        ConnectionStatusBrush = OllamaTestBrush;
    }

    public async Task RefreshConnectionStatusAsync()
    {
        if (!OllamaEnabled)
        {
            ConnectionStatusText = "AI disabled";
            ConnectionStatusBrush = GetThemeBrush("MutedBrush");
            return;
        }
        IsCheckingConnection = true;
        try
        {
            using var client = new OllamaClient(OllamaUrl);
            if (await client.IsAvailableAsync())
            {
                ConnectionStatusText = "Connected";
                ConnectionStatusBrush = GetThemeBrush("SuccessBrush");
                await RefreshDetectedModelsAsync();
            }
            else
            {
                ConnectionStatusText = "Not reachable";
                ConnectionStatusBrush = GetThemeBrush("WarningBrush");
            }
        }
        catch (Exception ex)
        {
            ConnectionStatusText = "Error: " + (ex.Message.Length > 40 ? ex.Message[..40] : ex.Message);
            ConnectionStatusBrush = GetThemeBrush("ErrorBrush");
        }
        finally
        {
            IsCheckingConnection = false;
        }
    }

    private void UpdateFilteredModels()
    {
        var q = (_modelSearchText ?? string.Empty).Trim();
        FilteredModels.Clear();
        foreach (var m in DetectedModels)
        {
            if (string.IsNullOrWhiteSpace(q) || m.Contains(q, StringComparison.OrdinalIgnoreCase))
                FilteredModels.Add(m);
        }
        OnPropertyChanged(nameof(HasFilteredModels));
    }

    // ── Lifecycle ──

    public SettingsViewModel()
    {
        _ = LoadAsync();
        _ = RefreshDetectedModelsAsync();
        _ = RefreshConnectionStatusAsync();
    }

    private async Task LoadAsync()
    {
        await SettingsStore.EnsureLoadedAsync();
        NotifyAll();
        ApplyTheme(AppSettings.Theme);
    }

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
        OnPropertyChanged(nameof(NotificationsEnabled));
        OnPropertyChanged(nameof(OllamaOptionsEnabled));
        OnPropertyChanged(nameof(ManualModelEnabled));
        OnPropertyChanged(nameof(AgenticOptionsEnabled));
    }

    public void ResetToDefaults()
    {
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
