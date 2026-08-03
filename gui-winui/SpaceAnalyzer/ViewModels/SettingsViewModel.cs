// Licensed under the MIT License.

using System;
using System.ComponentModel;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Windows.Storage;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the Settings page. Persists theme, scanner path,
/// and Ollama configuration to <see cref="ApplicationData"/> local settings.
/// Auto-saves on every change so settings survive rebuilds/restarts.
/// </summary>
public class SettingsViewModel : INotifyPropertyChanged
{
    private readonly ScannerService _scanner = new();
    private static readonly HttpClient s_httpClient = new() { Timeout = TimeSpan.FromSeconds(10) };
    private const string LocalSettingsKey = "SpaceAnalyzer.Settings";

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
            var requested = theme switch
            {
                "Light" => Microsoft.UI.Xaml.ApplicationTheme.Light,
                "System" => DetectSystemTheme(),
                _ => Microsoft.UI.Xaml.ApplicationTheme.Dark,
            };
            Application.Current.RequestedTheme = requested;
        }
        catch { /* non-fatal */ }
    }

    /// <summary>
    /// Detect whether Windows is currently in dark or light mode by sampling the
    /// system background color, so the "System" theme choice can be honored.
    /// </summary>
    private static Microsoft.UI.Xaml.ApplicationTheme DetectSystemTheme()
    {
        try
        {
            var color = new Windows.UI.ViewManagement.UISettings()
                .GetColorValue(Windows.UI.ViewManagement.UIColorType.Background);
            var luminance = (color.R * 299 + color.G * 587 + color.B * 114) / 1000;
            return luminance < 128
                ? Microsoft.UI.Xaml.ApplicationTheme.Dark
                : Microsoft.UI.Xaml.ApplicationTheme.Light;
        }
        catch
        {
            return Microsoft.UI.Xaml.ApplicationTheme.Dark;
        }
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
        set { _ollamaEnabled = value; OnPropertyChanged(); Save(); }
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
        set { _agenticToolsEnabled = value; OnPropertyChanged(); Save(); }
    }

    private bool _autoModelSelection = true;
    public bool AutoModelSelection
    {
        get => _autoModelSelection;
        set { _autoModelSelection = value; OnPropertyChanged(); Save(); }
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
                OllamaTestResult = "Connected";
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
        Load();
    }

    private void Load()
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer(LocalSettingsKey, ApplicationDataCreateDisposition.Always);

            if (container.Values.TryGetValue("Theme", out var v) && v is string theme)
                _theme = theme;
            if (container.Values.TryGetValue("ScannerPath", out v) && v is string sp)
                _scannerPath = sp;
            if (string.IsNullOrWhiteSpace(_scannerPath))
                _scannerPath = _scanner.ScannerPath;
            if (container.Values.TryGetValue("ScanDepth", out v) && v is double d)
                _scanDepth = d;
            if (container.Values.TryGetValue("IncludeHidden", out v) && v is bool h)
                _includeHidden = h;
            if (container.Values.TryGetValue("GpuAcceleration", out v) && v is bool g)
                _gpuAcceleration = g;
            if (container.Values.TryGetValue("OllamaUrl", out v) && v is string ou)
                _ollamaUrl = ou;
            if (container.Values.TryGetValue("OllamaModel", out v) && v is string om)
                _ollamaModel = om;
            if (container.Values.TryGetValue("OllamaEnabled", out v) && v is bool oe)
                _ollamaEnabled = oe;
            if (container.Values.TryGetValue("OllamaThink", out v) && v is bool ot)
                _ollamaThink = ot;
            if (container.Values.TryGetValue("AgenticToolsEnabled", out v) && v is bool at)
                _agenticToolsEnabled = at;
            if (container.Values.TryGetValue("AutoModelSelection", out v) && v is bool am)
                _autoModelSelection = am;
            if (container.Values.TryGetValue("ToolCallingModel", out v) && v is string tcm)
                _toolCallingModel = tcm;
            if (container.Values.TryGetValue("ToolChoice", out v) && v is string tc)
                _toolChoice = tc;

            // Fire change notifications for all properties so the UI reflects loaded values
            OnPropertyChanged(nameof(Theme));
            OnPropertyChanged(nameof(ScannerPath));
            OnPropertyChanged(nameof(IsScannerPathValid));
            OnPropertyChanged(nameof(ScannerPathStatus));
            OnPropertyChanged(nameof(ScanDepth));
            OnPropertyChanged(nameof(IncludeHidden));
            OnPropertyChanged(nameof(GpuAcceleration));
            OnPropertyChanged(nameof(OllamaUrl));
            OnPropertyChanged(nameof(OllamaModel));
            OnPropertyChanged(nameof(OllamaEnabled));
            OnPropertyChanged(nameof(OllamaThink));
            OnPropertyChanged(nameof(AgenticToolsEnabled));
            OnPropertyChanged(nameof(AutoModelSelection));
            OnPropertyChanged(nameof(ToolCallingModel));
            OnPropertyChanged(nameof(ToolChoice));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SettingsViewModel] Load failed: {ex}");
            // Defaults are fine.
        }
    }

    public void Save()
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer(LocalSettingsKey, ApplicationDataCreateDisposition.Always);

            container.Values["Theme"] = Theme;
            container.Values["ScannerPath"] = ScannerPath;
            container.Values["ScanDepth"] = ScanDepth;
            container.Values["IncludeHidden"] = IncludeHidden;
            container.Values["GpuAcceleration"] = GpuAcceleration;
            container.Values["OllamaUrl"] = OllamaUrl;
            container.Values["OllamaModel"] = OllamaModel;
            container.Values["OllamaEnabled"] = OllamaEnabled;
            container.Values["OllamaThink"] = OllamaThink;
            container.Values["AgenticToolsEnabled"] = AgenticToolsEnabled;
            container.Values["AutoModelSelection"] = AutoModelSelection;
            container.Values["ToolCallingModel"] = ToolCallingModel;
            container.Values["ToolChoice"] = ToolChoice;
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

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    private static SolidColorBrush GetThemeBrush(string key)
        => Application.Current.Resources[key] as SolidColorBrush
           ?? new SolidColorBrush(Microsoft.UI.Colors.Gray);
}
