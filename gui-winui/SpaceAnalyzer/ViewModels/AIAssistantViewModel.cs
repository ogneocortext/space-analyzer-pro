// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

public partial class AIAssistantViewModel : ViewModelBase, IDisposable
{
    private OllamaClient? _client;
    private ToolExecutor? _toolExecutor;
    private CancellationTokenSource _cts = new();
    private bool _disposed;
    private readonly ObservableCollection<OllamaModelInfo> _installedModels = new();
    private bool _autoSelectingDefault;

    public ReadOnlyObservableCollection<OllamaModelInfo> InstalledModels { get; }

    private bool _ollamaConnected;
    public bool OllamaConnected
    {
        get => _ollamaConnected;
        private set { if (_ollamaConnected == value) return; _ollamaConnected = value; OnPropertyChanged(); RaiseConnectionProps(); }
    }

    public int InstalledModelCount => _installedModels.Count;

    public string ConnectionStatusText =>
        !OllamaEnabled ? "AI disabled in Settings"
        : _ollamaConnected
            ? $"Ollama connected · {_installedModels.Count} model{(_installedModels.Count == 1 ? "" : "s")}"
            : "Ollama offline — check the server/URL in Settings";

    private static readonly SolidColorBrush s_fallbackStatusBrush = new(Microsoft.UI.Colors.Gray);
    public Brush ConnectionStatusBrush
    {
        get
        {
            string key = !OllamaEnabled ? "MutedBrush" : _ollamaConnected ? "SuccessBrush" : "ErrorBrush";
            try
            {
                return (Application.Current?.Resources[key] as SolidColorBrush) ?? s_fallbackStatusBrush;
            }
            catch
            {
                return s_fallbackStatusBrush;
            }
        }
    }

    public string ConnectionStatusGlyph =>
        !OllamaEnabled ? "\uE77F"
        : _ollamaConnected ? "\uE930"
        : "\uE7BA";

    public bool CanRetryConnection => OllamaEnabled && !_ollamaConnected;
    public bool ShowNoModelsHint => _ollamaConnected && _installedModels.Count == 0;

    private void RaiseConnectionProps()
    {
        OnPropertyChanged(nameof(ConnectionStatusText));
        OnPropertyChanged(nameof(ConnectionStatusBrush));
        OnPropertyChanged(nameof(ConnectionStatusGlyph));
        OnPropertyChanged(nameof(CanRetryConnection));
        OnPropertyChanged(nameof(ShowNoModelsHint));
    }

    private readonly DispatcherQueueTimer? _modelRefreshTimer;

    // ── Display ──

    private ObservableCollection<AIChatMessage> _messages = new();
    public ObservableCollection<AIChatMessage> Messages => _messages;

    // ── Input ──

    private string _inputText = string.Empty;
    public string InputText
    {
        get => _inputText;
        set { _inputText = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsInputValid)); OnPropertyChanged(nameof(CanSend)); }
    }
    public bool IsInputValid => !string.IsNullOrWhiteSpace(InputText);

    // ── Busy state ──

    private bool _isBusy;
    public bool IsBusy
    {
        get => _isBusy;
        set { _isBusy = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotBusy)); OnPropertyChanged(nameof(CanSend)); }
    }
    public bool IsNotBusy => !_isBusy;
    public bool CanSend => IsNotBusy && IsInputValid;

    // ── Status ──

    private string _statusText = "Connect to start chatting.";
    public string StatusText
    {
        get => _statusText;
        set { _statusText = value; OnPropertyChanged(); }
    }

    private string _thinkingStatus = string.Empty;
    public string ThinkingStatus
    {
        get => _thinkingStatus;
        set { _thinkingStatus = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsThinking)); }
    }

    public bool IsThinking => !string.IsNullOrEmpty(ThinkingStatus);
    public bool ShowSuggestions => _messages.Count <= 2 && !IsBusy;

    // ── Settings ──

    public string OllamaUrl
    {
        get => AppSettings.OllamaUrl;
        set
        {
            AppSettings.OllamaUrl = value;
            OnPropertyChanged();
            RefreshOllamaClient();
        }
    }

    public string OllamaModel
    {
        get => AppSettings.OllamaModel;
        set { AppSettings.OllamaModel = value; OnPropertyChanged(); }
    }

    public string ToolCallingModel
    {
        get => AppSettings.ToolCallingModel;
        set { AppSettings.ToolCallingModel = value; OnPropertyChanged(); }
    }

    public bool AgenticToolsEnabled
    {
        get => AppSettings.AgenticToolsEnabled;
        set { AppSettings.AgenticToolsEnabled = value; OnPropertyChanged(); }
    }

    public bool AutoModelSelection
    {
        get => AppSettings.AutoModelSelection;
        set { AppSettings.AutoModelSelection = value; OnPropertyChanged(); }
    }

    public string ToolChoice
    {
        get => AppSettings.ToolChoice;
        set { AppSettings.ToolChoice = value; OnPropertyChanged(); }
    }

    public bool OllamaEnabled
    {
        get => AppSettings.OllamaEnabled;
        set { AppSettings.OllamaEnabled = value; OnPropertyChanged(); }
    }

    public bool OllamaThink
    {
        get => AppSettings.OllamaThink;
        set { AppSettings.OllamaThink = value; OnPropertyChanged(); }
    }

    public AIAssistantViewModel()
    {
        LoadSettings();
        _client = new OllamaClient(OllamaUrl);
        InstalledModels = new ReadOnlyObservableCollection<OllamaModelInfo>(_installedModels);
        SettingsStore.SettingsChanged += OnSettingsChanged;
        _modelRefreshTimer = DispatcherQueue.GetForCurrentThread()?.CreateTimer();
        if (_modelRefreshTimer is not null)
        {
            _modelRefreshTimer.Interval = TimeSpan.FromSeconds(30);
            _modelRefreshTimer.Tick += ModelRefreshTick;
            _modelRefreshTimer.Start();
        }
        _ = RefreshInstalledModelsAsync();
        AddMessage(ChatRole.Assistant,
            "Hello! I am your AI assistant for Space Analyzer Pro. " +
            "I can help you understand your disk usage and find space-saving opportunities. " +
            "Ask me anything!");
    }

    public void ReloadSettings()
    {
        if (_disposed || IsBusy) return;
        LoadSettings();
        RefreshOllamaClient();
        _ = RefreshInstalledModelsAsync();
    }

    private async Task RefreshInstalledModelsAsync()
    {
        if (_disposed || _client is null) { OllamaConnected = false; return; }
        try
        {
            var models = await _client.GetInstalledModelsAsync();
            _installedModels.Clear();
            foreach (var m in models) _installedModels.Add(m);
            OllamaConnected = true;

            if (string.IsNullOrWhiteSpace(OllamaModel) && _installedModels.Count > 0)
            {
                var recommended = ModelPreferences.PickRecommended(_installedModels);
                if (!string.IsNullOrEmpty(recommended))
                {
                    _autoSelectingDefault = true;
                    try { OllamaModel = recommended; }
                    finally { _autoSelectingDefault = false; }
                }
            }

            foreach (var m in _installedModels)
                m.IsDefault = string.Equals(m.Name, OllamaModel, StringComparison.OrdinalIgnoreCase);
            if (_installedModels.Count == 0) return;

            var fallbacks = _installedModels
                .Where(m => !string.Equals(m.Name, OllamaModel, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(m => m.Capabilities.Contains("tools"))
                .ThenBy(m => m.Size)
                .Select(m => m.Name)
                .Take(3)
                .ToList();
            if (fallbacks.Count > 0)
                _client.SetFallbackFromLocal(OllamaModel, fallbacks);
        }
        catch
        {
            OllamaConnected = false;
        }
        finally
        {
            OnPropertyChanged(nameof(InstalledModelCount));
            RaiseConnectionProps();
        }
    }

    public void RetryConnection()
    {
        if (_disposed) return;
        StatusText = "Reconnecting…";
        _ = RefreshInstalledModelsAsync();
    }

    private void ModelRefreshTick(object? sender, object? e)
    {
        if (_disposed) return;
        _ = RefreshInstalledModelsAsync();
    }

    private void OnSettingsChanged(object? sender, SettingsStore.SettingsChangedEventArgs e)
    {
        if (_disposed) return;
        switch (e.Key)
        {
            case SettingKeys.OllamaUrl:
                OnPropertyChanged(nameof(OllamaUrl));
                RefreshOllamaClient();
                _ = RefreshInstalledModelsAsync();
                break;
            case SettingKeys.OllamaModel:
                OnPropertyChanged(nameof(OllamaModel));
                if (!_autoSelectingDefault)
                    _ = RefreshInstalledModelsAsync();
                break;
            case SettingKeys.ToolCallingModel:
                OnPropertyChanged(nameof(ToolCallingModel));
                break;
            case SettingKeys.OllamaEnabled:
                OnPropertyChanged(nameof(OllamaEnabled));
                RaiseConnectionProps();
                _ = RefreshInstalledModelsAsync();
                break;
            case SettingKeys.OllamaThink:
                OnPropertyChanged(nameof(OllamaThink));
                break;
            case SettingKeys.AgenticToolsEnabled:
                OnPropertyChanged(nameof(AgenticToolsEnabled));
                break;
            case SettingKeys.AutoModelSelection:
                OnPropertyChanged(nameof(AutoModelSelection));
                break;
            case SettingKeys.ToolChoice:
                OnPropertyChanged(nameof(ToolChoice));
                break;
        }
    }

    private void RefreshOllamaClient()
    {
        if (_disposed) return;
        _client?.Dispose();
        _client = new OllamaClient(OllamaUrl);
    }

    private void EnsureToolExecutor()
    {
        if (_toolExecutor == null)
        {
            var scanner = new ScannerService();
            _toolExecutor = new ToolExecutor(scanner);
        }
    }

    private void LoadSettings()
    {
        try
        {
            OnPropertyChanged(nameof(OllamaUrl));
            OnPropertyChanged(nameof(OllamaModel));
            OnPropertyChanged(nameof(ToolCallingModel));
            OnPropertyChanged(nameof(AgenticToolsEnabled));
            OnPropertyChanged(nameof(AutoModelSelection));
            OnPropertyChanged(nameof(ToolChoice));
            OnPropertyChanged(nameof(OllamaEnabled));
            OnPropertyChanged(nameof(OllamaThink));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[AIAssistantViewModel] LoadSettings failed: {ex}");
        }
    }

    private const int MaxToolIterations = 10;
    private const int MaxMessages = 50;

    public void AddMessage(ChatRole role, string content, List<ToolCallResponse>? toolCalls = null, string? toolCallId = null)
    {
        _messages.Add(new AIChatMessage(role, content, toolCalls, toolCallId));
        while (_messages.Count > MaxMessages)
            _messages.RemoveAt(0);
        OnPropertyChanged(nameof(ShowSuggestions));
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        SettingsStore.SettingsChanged -= OnSettingsChanged;
        if (_modelRefreshTimer is not null)
        {
            _modelRefreshTimer.Tick -= ModelRefreshTick;
            _modelRefreshTimer.Stop();
        }
        _cts.Cancel();
        _cts.Dispose();
        _client?.Dispose();
        _toolExecutor?.Dispose();
        GC.SuppressFinalize(this);
    }

    public void Abort()
    {
        if (!_disposed && IsBusy)
        {
            try { _cts.Cancel(); }
            catch { /* already cancelled */ }
        }
    }
}

public class AIChatMessage : ViewModelBase
{
    private readonly ChatRole _role;
    private string _content;

    public ChatRole Role => _role;
    public string Content
    {
        get => _content;
        set { _content = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsUser)); OnPropertyChanged(nameof(IsTool)); }
    }
    public DateTime Timestamp { get; }
    public bool IsUser => _role == ChatRole.User;
    public bool IsTool => _role == ChatRole.Tool;
    public string TimestampDisplay => Timestamp.ToString("HH:mm");
    public List<ToolCallResponse>? ToolCalls { get; }
    public string? ToolCallId { get; }
    public string ToolName => ToolCalls?.FirstOrDefault()?.Function.Name ?? "";

    public AIChatMessage(ChatRole role, string content, List<ToolCallResponse>? toolCalls = null, string? toolCallId = null)
    {
        _role = role;
        _content = content;
        ToolCalls = toolCalls;
        ToolCallId = toolCallId;
        Timestamp = DateTime.Now;
    }
}
