// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the Settings page. Persists theme, scanner path,
/// and Ollama configuration to the embedded database via
/// <see cref="SettingsStore"/>. Auto-saves on every change so settings
/// survive rebuilds/restarts.
/// </summary>
public class SettingsViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private static readonly HttpClient s_httpClient = new() { Timeout = TimeSpan.FromSeconds(10) };
    private bool _disposed;

    // ── Appearance ──

    private string _theme = "Dark";
    public string Theme
    {
        get => _theme;
        set
        {
            _theme = value;
            OnPropertyChanged();
            Save();
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

    private string _scannerPath = string.Empty;
    public string ScannerPath
    {
        get => _scannerPath;
        set
        {
            _scannerPath = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsScannerPathValid));
            OnPropertyChanged(nameof(ScannerPathStatus));
            Save();
        }
    }

    public bool IsScannerPathValid => !string.IsNullOrWhiteSpace(ScannerPath) && System.IO.File.Exists(ScannerPath);

    public string ScannerPathStatus => ScannerPath switch
    {
        null or "" => "No path set",
        _ when IsScannerPathValid => "Scanner found",
        _ => "Scanner not found at this path",
    };

    private double _scanDepth = 5;
    public double ScanDepth
    {
        get => _scanDepth;
        set { _scanDepth = value; OnPropertyChanged(); Save(); }
    }

    private bool _includeHidden;
    public bool IncludeHidden
    {
        get => _includeHidden;
        set { _includeHidden = value; OnPropertyChanged(); Save(); }
    }

    private bool _gpuAcceleration = true;
    public bool GpuAcceleration
    {
        get => _gpuAcceleration;
        set { _gpuAcceleration = value; OnPropertyChanged(); Save(); }
    }

    private string _defaultScanPaths = string.Empty;
    public string DefaultScanPaths
    {
        get => _defaultScanPaths;
        set { _defaultScanPaths = value; OnPropertyChanged(); Save(); }
    }

    public List<string> DefaultScanPathList
    {
        get
        {
            if (string.IsNullOrWhiteSpace(_defaultScanPaths))
                return new List<string>();
            return _defaultScanPaths
                .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(p => p.Trim())
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .ToList();
        }
    }

    // ── Ollama ──

    private string _ollamaUrl = "http://localhost:11434";
    public string OllamaUrl
    {
        get => _ollamaUrl;
        set { _ollamaUrl = value; OnPropertyChanged(); Save(); }
    }

    private string _ollamaModel = "gemma3:1b";
    public string OllamaModel
    {
        get => _ollamaModel;
        set { _ollamaModel = value; OnPropertyChanged(); Save(); }
    }

    private bool _ollamaEnabled = true;
    public bool OllamaEnabled
    {
        get => _ollamaEnabled;
        set
        {
            _ollamaEnabled = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(OllamaOptionsEnabled));
            OnPropertyChanged(nameof(ManualModelEnabled));
            OnPropertyChanged(nameof(AgenticOptionsEnabled));
            Save();
        }
    }

    private bool _ollamaThink = true;
    public bool OllamaThink
    {
        get => _ollamaThink;
        set { _ollamaThink = value; OnPropertyChanged(); Save(); }
    }

    private bool _agenticToolsEnabled = true;
    public bool AgenticToolsEnabled
    {
        get => _agenticToolsEnabled;
        set
        {
            _agenticToolsEnabled = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(AgenticOptionsEnabled));
            Save();
        }
    }

    private bool _autoModelSelection = true;
    public bool AutoModelSelection
    {
        get => _autoModelSelection;
        set
        {
            _autoModelSelection = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(ManualModelEnabled));
            Save();
        }
    }

    private string _toolCallingModel = "qwen2.5-coder:7b";
    public string ToolCallingModel
    {
        get => _toolCallingModel;
        set { _toolCallingModel = value; OnPropertyChanged(); Save(); }
    }

    private string _toolChoice = "auto";
    public string ToolChoice
    {
        get => _toolChoice;
        set { _toolChoice = value; OnPropertyChanged(); Save(); }
    }

    // ── UI: Advanced mode ──

    private bool _advancedMode;
    public bool AdvancedMode
    {
        get => _advancedMode;
        set { _advancedMode = value; OnPropertyChanged(); Save(); }
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
    /// <see cref="DetectedModels"/>. Swallows failures when the server is offline.
    /// </summary>
    public async Task RefreshDetectedModelsAsync()
    {
        try
        {
            var response = await s_httpClient.GetAsync($"{OllamaUrl.TrimEnd('/')}/api/tags");
            if (!response.IsSuccessStatusCode)
                return;
            var json = await response.Content.ReadAsStringAsync();
            var payload = JsonSerializer.Deserialize<TagsResponse>(json, OllamaClient.JsonOptions);
            var names = (payload?.Models ?? new List<OllamaModelInfo>())
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
            var response = await s_httpClient.GetAsync($"{OllamaUrl.TrimEnd('/')}/api/tags");
            if (response.IsSuccessStatusCode)
            {
                await RefreshDetectedModelsAsync();
                OllamaTestResult = DetectedModels.Count == 0
                    ? "Connected (no models found)"
                    : $"Connected — {DetectedModels.Count} model(s) available";
                OllamaTestBrush = GetThemeBrush("SuccessBrush");
            }
            else
            {
                OllamaTestResult = $"Error {(int)response.StatusCode}";
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
        LoadFromStore();
    }

    private void LoadFromStore()
    {
        try
        {
            _theme = SettingsStore.Get("theme") ?? "Dark";
            _scannerPath = SettingsStore.Get("scanner_path") ?? string.Empty;
            if (string.IsNullOrWhiteSpace(_scannerPath))
                _scannerPath = _scanner.ScannerPath;
            _scanDepth = double.TryParse(SettingsStore.Get("scan_depth"), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : 5;
            _includeHidden = SettingsStore.GetBool("include_hidden");
            _gpuAcceleration = SettingsStore.GetBool("gpu_acceleration", true);
            _defaultScanPaths = SettingsStore.Get("default_scan_paths") ?? string.Empty;
            _ollamaUrl = SettingsStore.Get("ollama_url") ?? "http://localhost:11434";
            _ollamaModel = SettingsStore.Get("ollama_model") ?? "gemma3:1b";
            _ollamaEnabled = SettingsStore.GetBool("ollama_enabled", true);
            _ollamaThink = SettingsStore.GetBool("ollama_think", true);
            _agenticToolsEnabled = SettingsStore.GetBool("agentic_tools_enabled", true);
            _autoModelSelection = SettingsStore.GetBool("auto_model_selection", true);
            _toolCallingModel = SettingsStore.Get("tool_calling_model") ?? "qwen2.5-coder:7b";
            _toolChoice = SettingsStore.Get("tool_choice") ?? "auto";
            _advancedMode = SettingsStore.GetBool("advanced_mode");

            OnPropertyChanged(nameof(Theme));
            OnPropertyChanged(nameof(ScannerPath));
            OnPropertyChanged(nameof(IsScannerPathValid));
            OnPropertyChanged(nameof(ScannerPathStatus));
            OnPropertyChanged(nameof(ScanDepth));
            OnPropertyChanged(nameof(IncludeHidden));
            OnPropertyChanged(nameof(GpuAcceleration));
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

            // Reflect the restored theme on the live root so the picker matches
            // what is actually rendered (independent of the startup-time apply).
            ApplyTheme(_theme);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SettingsViewModel] Load failed: {ex}");
        }
    }

    public void Save()
    {
        try
        {
            SettingsStore.Set("theme", Theme);
            SettingsStore.Set("scanner_path", ScannerPath);
            SettingsStore.Set("scan_depth", ScanDepth.ToString(System.Globalization.CultureInfo.InvariantCulture));
            SettingsStore.SetBool("include_hidden", IncludeHidden);
            SettingsStore.SetBool("gpu_acceleration", GpuAcceleration);
            SettingsStore.Set("default_scan_paths", DefaultScanPaths);
            SettingsStore.Set("ollama_url", OllamaUrl);
            SettingsStore.Set("ollama_model", OllamaModel);
            SettingsStore.SetBool("ollama_enabled", OllamaEnabled);
            SettingsStore.SetBool("ollama_think", OllamaThink);
            SettingsStore.SetBool("agentic_tools_enabled", AgenticToolsEnabled);
            SettingsStore.SetBool("auto_model_selection", AutoModelSelection);
            SettingsStore.Set("tool_calling_model", ToolCallingModel);
            SettingsStore.Set("tool_choice", ToolChoice);
            SettingsStore.SetBool("advanced_mode", AdvancedMode);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SettingsViewModel] Save failed: {ex}");
        }
    }

    public void ResetToDefaults()
    {
        Theme = "Dark";
        ScannerPath = string.Empty;
        ScanDepth = 5;
        IncludeHidden = false;
        GpuAcceleration = true;
        DefaultScanPaths = string.Empty;
        OllamaUrl = "http://localhost:11434";
        OllamaModel = "gemma3:1b";
        OllamaEnabled = true;
        OllamaThink = true;
        AgenticToolsEnabled = true;
        AutoModelSelection = true;
        ToolCallingModel = "qwen2.5-coder:7b";
        ToolChoice = "auto";
        OllamaTestResult = string.Empty;
        OllamaTestBrush = GetThemeBrush("MutedBrush");
        Save();
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
