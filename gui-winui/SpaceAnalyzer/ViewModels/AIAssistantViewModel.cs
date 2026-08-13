// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the AI Assistant page. Sends user queries to the local
/// Ollama server via <see cref="OllamaClient"/> and executes tools via
/// <see cref="ToolExecutor"/> in an agentic loop.
/// </summary>
public partial class AIAssistantViewModel : ViewModelBase, IDisposable
{
    private OllamaClient? _client;
    private ToolExecutor? _toolExecutor;
    private CancellationTokenSource _cts = new();
    private bool _disposed;
    private readonly ObservableCollection<OllamaModelInfo> _installedModels = new();
    // Set while we persist an auto-selected default so the resulting SettingsChanged
    // re-entrancy does not schedule a redundant model refresh.
    private bool _autoSelectingDefault;

    /// <summary>
    /// Models detected on the Ollama server, surfaced to the UI so the AI page can
    /// show a "connected · N models" indicator and the actual installed model list
    /// (refreshed live via <see cref="_modelRefreshTimer"/> and
    /// <see cref="SettingsStore.SettingsChanged"/>).
    /// </summary>
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

    /// <summary>
    /// Semantic brush for the connection status badge (green = connected, red =
    /// offline, gray = disabled). Resolved from theme resources so it stays
    /// correct in light/dark; guarded so headless (test) usage never throws.
    /// </summary>
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

    /// <summary>Segoe MDL2 glyph for the connection status badge.</summary>
    public string ConnectionStatusGlyph =>
        !OllamaEnabled ? "\uE77F"   // Blocked
        : _ollamaConnected ? "\uE930" // CheckMark
        : "\uE7BA";                  // Warning

    /// <summary>True when Ollama is enabled but unreachable, so a Retry button is offered.</summary>
    public bool CanRetryConnection => OllamaEnabled && !_ollamaConnected;

    /// <summary>True when connected but the server reports zero installed models.</summary>
    public bool ShowNoModelsHint => _ollamaConnected && _installedModels.Count == 0;

    /// <summary>
    /// Raises every connection-derived property at once. Connection state can change
    /// from several paths (refresh, settings edit, enable toggle), and all of these
    /// bindings must refresh together to keep the status badge consistent.
    /// </summary>
    private void RaiseConnectionProps()
    {
        OnPropertyChanged(nameof(ConnectionStatusText));
        OnPropertyChanged(nameof(ConnectionStatusBrush));
        OnPropertyChanged(nameof(ConnectionStatusGlyph));
        OnPropertyChanged(nameof(CanRetryConnection));
        OnPropertyChanged(nameof(ShowNoModelsHint));
    }

    // Periodic refresh so models installed mid-session (e.g. `ollama pull`) appear
    // without the user navigating away and back. Guarded because the VM may be
    // constructed on a thread with no DispatcherQueue (headless tests).
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

    /// <summary>Send is allowed only when idle and the input is non-empty.</summary>
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
    // These mirror <see cref="AppSettings"/>. The settings page is the single
    // source of truth; this ViewModel only reads them (via AppSettings) and
    // raises change notifications for its own bindings. No duplicated key or
    // default literals live here anymore.

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

    /// <summary>
    /// Re-reads shared settings from <see cref="Windows.Storage.ApplicationData"/>
    /// local settings. Called when the page is navigated to so changes made on the
    /// Settings page take effect without an app restart.
    /// </summary>
    public void ReloadSettings()
    {
        if (_disposed || IsBusy) return;
        LoadSettings();
        RefreshOllamaClient();
        _ = RefreshInstalledModelsAsync();
    }

    /// <summary>
    /// Queries the Ollama server for installed models and configures the client
    /// fallback so requests never fail because the configured model is missing.
    /// </summary>
    private async Task RefreshInstalledModelsAsync()
    {
        if (_disposed || _client is null) { OllamaConnected = false; return; }
        try
        {
            var models = await _client.GetInstalledModelsAsync();
            _installedModels.Clear();
            foreach (var m in models) _installedModels.Add(m);
            OllamaConnected = true;

            // Auto-select the default model from the benchmark-driven ranking when the
            // user has not explicitly chosen one (OllamaModel is the empty "auto"
            // sentinel). This makes the default capability-aware instead of a fixed
            // literal, and persists the pick so the Settings page reflects it.
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

            // Highlight the configured default model in the UI list.
            foreach (var m in _installedModels)
                m.IsDefault = string.Equals(m.Name, OllamaModel, StringComparison.OrdinalIgnoreCase);
            if (_installedModels.Count == 0) return;

            // Prefer tool-capable, then small models so fallback stays cheap.
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
            // Offline — keep the current list (possibly empty); primary model still tried.
            OllamaConnected = false;
        }
        finally
        {
            OnPropertyChanged(nameof(InstalledModelCount));
            RaiseConnectionProps();
        }
    }

    /// <summary>
    /// Manually re-probes the Ollama server from the UI (Retry button). Lets the user
    /// recover immediately after starting Ollama or fixing the URL without waiting for
    /// the 30s auto-refresh tick.
    /// </summary>
    public void RetryConnection()
    {
        if (_disposed) return;
        StatusText = "Reconnecting…";
        _ = RefreshInstalledModelsAsync();
    }

    /// <summary>
    /// Periodic model-list refresh (driven by <see cref="_modelRefreshTimer"/>) so a
    /// model installed mid-session (e.g. `ollama pull`) becomes selectable without a
    /// page re-navigation.
    /// </summary>
    private void ModelRefreshTick(object? sender, object? e)
    {
        if (_disposed) return;
        _ = RefreshInstalledModelsAsync();
    }

    /// <summary>
    /// Reacts to settings edits made on the Settings page (the single source of truth)
    /// so AI-assistant state — most importantly the Ollama enable toggle and the
    /// installed-model list — updates live instead of only when the page is re-entered.
    /// </summary>
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
                // Skip the re-entrant refresh triggered by our own auto-selection.
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

    /// <summary>
    /// Re-reads shared settings and notifies the UI. Called when the page is
    /// navigated to so changes made on the Settings page take effect without an
    /// app restart. Model values are read live from <see cref="AppSettings"/>
    /// (the single source of truth), so there is nothing to copy here beyond
    /// refreshing the bindings.
    /// </summary>
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

    private const int MaxMessages = 50;
    private const int MaxToolIterations = 10;

    public void AddMessage(ChatRole role, string content, List<ToolCallResponse>? toolCalls = null, string? toolCallId = null)
    {
        _messages.Add(new AIChatMessage(role, content, toolCalls, toolCallId));
        while (_messages.Count > MaxMessages)
            _messages.RemoveAt(0);
        OnPropertyChanged(nameof(ShowSuggestions));
    }

    private string SelectModelForTask(string userMessage)
    {
        var lower = userMessage.ToLowerInvariant();
        var isDiskTask = lower.Contains("disk") || lower.Contains("scan") || lower.Contains("file")
            || lower.Contains("duplicate") || lower.Contains("cleanup") || lower.Contains("storage");
        var preferred = AutoModelSelection && isDiskTask
            ? (string.IsNullOrWhiteSpace(ToolCallingModel) ? OllamaModel : ToolCallingModel)
            : OllamaModel;

        // No model list available yet (offline or still loading) — use the configured model.
        if (_installedModels.Count == 0)
            return preferred;

        // Use the configured model when it is actually installed.
        if (!string.IsNullOrWhiteSpace(preferred)
            && _installedModels.Any(m => string.Equals(m.Name, preferred, StringComparison.OrdinalIgnoreCase)))
            return preferred;

        // Otherwise resolve to an installed model using the benchmark-derived ranking
        // (code/reasoning), with tool capability and size as tie-breakers.
        var pick = ModelPreferences.PickRecommended(_installedModels)
                   ?? _installedModels
                       .OrderByDescending(m => m.Capabilities.Contains("tools"))
                       .ThenBy(m => m.Size)
                       .FirstOrDefault()?.Name;
        return pick ?? preferred;
    }

    private string ResolveToolChoice(string question, List<ToolDefinition> tools)
    {
        var lower = question.ToLowerInvariant();
        var domainKeywords = new[]
        {
            "disk", "space", "storage", "scan", "volume", "drive",
            "file", "folder", "directory", "largest", "size",
            "history", "trend", "prediction", "cleanup", "workflow",
            "system", "resource", "cpu", "memory", "gpu",
            "summary", "breakdown", "duplicate", "dedup"
        };
        var hasDomainKeyword = domainKeywords.Any(k => lower.Contains(k));
        var hasToolName = tools.Any(t => lower.Contains(t.Function.Name.ToLowerInvariant()));

        if (tools.Count == 0 || IsGreeting(lower))
            return "auto";
        if (hasDomainKeyword || hasToolName)
            return "required";
        return "auto";
    }

    /// <summary>
    /// Detects short greeting messages so tool choice stays "auto" instead of
    /// forcing tool use. Uses a word-boundary match so "hi" matches on its own,
    /// at the end of a message ("Just saying hi"), or with punctuation ("hi!"),
    /// but does not match inside words like "hint" or "this".
    /// </summary>
    private static bool IsGreeting(string lower)
    {
        if (lower.Contains("hello"))
            return true;
        return Regex.IsMatch(lower, @"\bhi\b");
    }

    private static readonly JsonSerializerOptions s_toolArgJson = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private List<ToolDefinition> GetToolDefinitions()
    {
        return new List<ToolDefinition>
        {
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "get_disk_volumes",
                    Description = "Get information about all disk volumes including total size, used space, and available space.",
                    Parameters = new Dictionary<string, object>()
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "get_system_resources",
                    Description = "Get current CPU and memory usage statistics.",
                    Parameters = new Dictionary<string, object>()
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "get_storage_trend",
                    Description = "Get storage usage trend over time from scan history.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["limit"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Number of data points to retrieve (default 20)" }
                        },
                        ["required"] = new List<string>()
                    }
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "list_workflows",
                    Description = "List all available workflow templates with their descriptions.",
                    Parameters = new Dictionary<string, object>()
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "predict_storage",
                    Description = "Predict future storage usage based on historical scan data.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["days_ahead"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Number of days to predict ahead (default 30)" }
                        },
                        ["required"] = new List<string>()
                    }
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "preview_impact",
                    Description = "Generate a destructive-action impact report for a file. Shows hardlinks, symlinks, sibling files, and an impact assessment. READ-ONLY.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the file to analyze" }
                        },
                        ["required"] = new List<string> { "path" }
                    }
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "move_to_trash",
                    Description = "Move a file to the Recycle Bin (recoverable). The file is removed from its current location immediately but can be restored later from the Recycle Bin. Requires the 'path' argument.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the file" }
                        },
                        ["required"] = new List<string> { "path" }
                    }
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "hardlink_duplicates",
                    Description = "Hard-link duplicate files in a directory so identical copies share a single inode, reclaiming disk space. No file content is deleted (hard-linking is safe). Requires the 'path' argument.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the directory" }
                        },
                        ["required"] = new List<string> { "path" }
                    }
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "run_scan",
                    Description = "Scan a directory and return a summary of disk usage including total files, size, top directories, largest files, and file type distribution. Always provide the 'path' argument with the absolute path to the directory to scan, for example \"C:\\Users\\MyName\". If 'path' is omitted, the most recently scanned directory is used instead.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the directory to scan" },
                            ["deep"] = new Dictionary<string, object> { ["type"] = "boolean", ["description"] = "Enable deep scan with unlimited depth (default false)" }
                        },
                        ["required"] = new List<string> { "path" }
                    }
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "analyze_file_patterns",
                    Description = "Analyze duplicate file patterns and potential savings in the target directory using content hashing.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the directory to analyze (optional, uses most recent scan path if omitted)" }
                        },
                        ["required"] = new List<string>()
                    }
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "get_scan_summary",
                    Description = "Get a summary of the latest scan results including total files, size, and file type distribution.",
                    Parameters = new Dictionary<string, object>()
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "get_file_type_breakdown",
                    Description = "Get a detailed breakdown of files by extension from the current scan.",
                    Parameters = new Dictionary<string, object>()
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "search_files",
                    Description = "Search files in the target directory by extension, name keyword, or size range. Uses the most recent cached scan of that directory when available (fast, no re-scan), otherwise performs a new scan.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["extension"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Filter by file extension (without dot, e.g. 'pdf')" },
                            ["keyword"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Filter by keyword in file path/name" },
                            ["limit"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Maximum number of results (default 20)" }
                        },
                        ["required"] = new List<string>()
                    }
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "get_largest_files",
                    Description = "Get the largest files from the target directory. Uses the most recent cached scan of that directory when available (fast, no re-scan), otherwise performs a new scan.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["count"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Number of largest files to return (default 20)" }
                        },
                        ["required"] = new List<string>()
                    }
                }
            },
            new ToolDefinition
            {
                Function = new ToolFunction
                {
                    Name = "run_workflow",
                    Description = "Execute a predefined workflow to find files matching specific criteria (e.g. large files, old files, duplicates, zero-byte files, temp files, hidden files, orphaned projects, downloads bloat). Provide the 'workflow' parameter with the workflow name. Use list_workflows to see all available workflows and their descriptions.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["workflow"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "The workflow name to execute (e.g. 'find_large_files', 'find_old_files', 'find_duplicate_files')" },
                            ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the target directory (optional, uses most recent scan path if omitted)" },
                            ["min_size_mb"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Minimum file size in MB (used by find_large_files, find_in_size_range, downloads_folder_bloat)" },
                            ["max_size_mb"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Maximum file size in MB (used by find_in_size_range)" },
                            ["days_old"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Number of days old (used by find_old_files, find_recently_modified, find_files_older_than, downloads_folder_bloat)" },
                            ["start_date"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Start date for find_by_date_range (ISO-8601, e.g. 2026-01-01)" },
                            ["end_date"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "End date for find_by_date_range (ISO-8601, e.g. 2026-06-30)" },
                            ["extension"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "File extension to filter by (used by find_by_extension, e.g. '.log')" }
                        },
                        ["required"] = new List<string> { "workflow" }
                    }
                }
            },
        };
    }

    /// <summary>
    /// Main send method with agentic tool-calling loop.
    /// When the model responds with tool_calls, executes them and feeds results back,
    /// repeating until the model produces a final text response or max iterations reached.
    /// </summary>
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

    /// <summary>
    /// Cancels any in-flight agentic loop (streaming / tool execution) so the user
    /// can stop a long-running scan or tool chain. The loop checks the
    /// CancellationToken each iteration and tears down the scanner process tree via
    /// <see cref="Services.ScannerService.StopScan"/>.
    /// </summary>
    public void Abort()
    {
        if (!_disposed && IsBusy)
        {
            try { _cts.Cancel(); }
            catch { /* already cancelled */ }
        }
    }

}

/// <summary>
/// A single chat message for display in the AI Assistant UI.
/// </summary>
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

    /// <summary>Tool calls embedded in an assistant message (for display).</summary>
    public List<ToolCallResponse>? ToolCalls { get; }

    /// <summary>Tool call ID for tool result messages.</summary>
    public string? ToolCallId { get; }

    /// <summary>Display name for the tool that was called.</summary>
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
