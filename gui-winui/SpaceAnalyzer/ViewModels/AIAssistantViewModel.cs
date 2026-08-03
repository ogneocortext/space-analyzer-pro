// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the AI Assistant page. Sends user queries to the local
/// Ollama server via <see cref="OllamaClient"/> and executes tools via
/// <see cref="ToolExecutor"/> in an agentic loop.
/// </summary>
public class AIAssistantViewModel : INotifyPropertyChanged, IDisposable
{
    private OllamaClient? _client;
    private ToolExecutor? _toolExecutor;
    private CancellationTokenSource _cts = new();
    private bool _disposed;
    private List<OllamaModelInfo> _installedModels = new();

    // ── Display ──

    private ObservableCollection<AIChatMessage> _messages = new();
    public ObservableCollection<AIChatMessage> Messages => _messages;

    // ── Input ──

    private string _inputText = string.Empty;
    public string InputText
    {
        get => _inputText;
        set { _inputText = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsInputValid)); }
    }
    public bool IsInputValid => !string.IsNullOrWhiteSpace(InputText);

    // ── Busy state ──

    private bool _isBusy;
    public bool IsBusy
    {
        get => _isBusy;
        set { _isBusy = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotBusy)); }
    }
    public bool IsNotBusy => !_isBusy;

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

    // ── Settings (from local settings) ──

    private string _ollamaUrl = "http://localhost:11434";
    public string OllamaUrl
    {
        get => _ollamaUrl;
        set
        {
            _ollamaUrl = value;
            OnPropertyChanged();
            RefreshOllamaClient();
        }
    }

    private string _ollamaModel = "gemma3:1b";
    public string OllamaModel
    {
        get => _ollamaModel;
        set { _ollamaModel = value; OnPropertyChanged(); }
    }

    private string _toolCallingModel = "qwen2.5-coder:7b";
    public string ToolCallingModel
    {
        get => _toolCallingModel;
        set { _toolCallingModel = value; OnPropertyChanged(); }
    }

    private bool _agenticToolsEnabled = true;
    public bool AgenticToolsEnabled
    {
        get => _agenticToolsEnabled;
        set { _agenticToolsEnabled = value; OnPropertyChanged(); }
    }

    private bool _autoModelSelection = true;
    public bool AutoModelSelection
    {
        get => _autoModelSelection;
        set { _autoModelSelection = value; OnPropertyChanged(); }
    }

    private string _toolChoice = "auto";
    public string ToolChoice
    {
        get => _toolChoice;
        set { _toolChoice = value; OnPropertyChanged(); }
    }

    private bool _ollamaEnabled = true;
    public bool OllamaEnabled
    {
        get => _ollamaEnabled;
        set { _ollamaEnabled = value; OnPropertyChanged(); }
    }

    private bool _ollamaThink = true;
    public bool OllamaThink
    {
        get => _ollamaThink;
        set { _ollamaThink = value; OnPropertyChanged(); }
    }

    public AIAssistantViewModel()
    {
        LoadSettings();
        _client = new OllamaClient(_ollamaUrl);
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
        if (_disposed || _client is null) return;
        try
        {
            _installedModels = await _client.GetInstalledModelsAsync();
            if (_installedModels.Count == 0 || _client is null) return;

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
            _ollamaUrl = SettingsStore.Get("ollama_url") ?? "http://localhost:11434";
            _ollamaModel = SettingsStore.Get("ollama_model") ?? "gemma3:1b";
            _toolCallingModel = SettingsStore.Get("tool_calling_model") ?? "qwen2.5-coder:7b";
            _agenticToolsEnabled = SettingsStore.Get("agentic_tools_enabled") != "false";
            _autoModelSelection = SettingsStore.Get("auto_model_selection") != "false";
            _toolChoice = SettingsStore.Get("tool_choice") ?? "auto";
            _ollamaEnabled = SettingsStore.Get("ollama_enabled") != "false";
            _ollamaThink = SettingsStore.Get("ollama_think") != "false";

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
        if (_installedModels.Any(m => string.Equals(m.Name, preferred, StringComparison.OrdinalIgnoreCase)))
            return preferred;

        // Otherwise resolve to an installed model: prefer tool-capable ones for
        // tool tasks, then the smallest model to keep VRAM usage low.
        var pick = _installedModels
            .OrderByDescending(m => m.Capabilities.Contains("tools"))
            .ThenBy(m => m.Size)
            .FirstOrDefault();
        return pick?.Name ?? preferred;
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
                    Description = "PREVIEW ONLY: Returns an impact report for moving a file to trash. Cannot perform the action directly.",
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
                    Description = "PREVIEW ONLY: Returns a plan for hard-linking duplicate files in a directory.",
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
    public async Task SendMessageAsync()
    {
        if (_disposed) return;
        if (IsBusy || string.IsNullOrWhiteSpace(InputText))
            return;

        _cts.Dispose();
        _cts = new CancellationTokenSource();
        var ct = _cts.Token;

        var userMessage = InputText.Trim();
        AddMessage(ChatRole.User, userMessage);
        InputText = string.Empty;

        IsBusy = true;
        StatusText = "Thinking...";

        try
        {
            if (_client is null)
            {
                AddMessage(ChatRole.Assistant, "Ollama client is not configured. Check your settings.");
                StatusText = "Not connected.";
                return;
            }

            if (!OllamaEnabled)
            {
                AddMessage(ChatRole.Assistant, "Ollama AI is disabled. Enable it in Settings to chat.");
                StatusText = "AI disabled.";
                return;
            }

            EnsureToolExecutor();

            var selectedModel = SelectModelForTask(userMessage);
            var apiMessages = BuildApiMessages();
            List<ToolDefinition>? tools = null;
            string resolvedToolChoice = "auto";

            if (AgenticToolsEnabled)
            {
                tools = GetToolDefinitions();
                resolvedToolChoice = ResolveToolChoice(userMessage, tools);
            }

            for (int iteration = 0; iteration < MaxToolIterations; iteration++)
            {
                ct.ThrowIfCancellationRequested();

                ThinkingStatus = iteration == 0
                    ? "Thinking..."
                    : $"Executing tools (step {iteration + 1})...";

                var response = await _client.SendChatMessageAsync(
                    selectedModel, apiMessages, tools, resolvedToolChoice, ct, think: OllamaThink);

                var message = response.Message;
                if (message == null)
                {
                    AddMessage(ChatRole.Assistant, "Received empty response from model.");
                    break;
                }

                // Check for tool calls
                if (message.ToolCalls is { Count: > 0 })
                {
                    // Add assistant message with tool_calls to the live API context
                    apiMessages.Add(new ChatMessage
                    {
                        Role = ChatRole.Assistant,
                        Content = message.Content ?? "",
                        ToolCalls = message.ToolCalls
                    });

                    // Persist the assistant tool_calls message to the display list so
                    // BuildApiMessages() includes it on follow-up turns. Without this,
                    // the next user turn rebuilds [system, user, tool_results, …]
                    // instead of [system, user, assistant(tool_calls), tool_results, …],
                    // breaking the OpenAI/Ollama tool-use message ordering.
                    AddMessage(ChatRole.Assistant, message.Content ?? "", message.ToolCalls);

                    // Execute each tool call and add results
                    foreach (var toolCall in message.ToolCalls)
                    {
                        ct.ThrowIfCancellationRequested();

                        var fnName = toolCall.Function.Name;
                        var args = ParseToolArguments(toolCall.Function.Arguments);

                        ThinkingStatus = $"Running {fnName}...";
                        System.Diagnostics.Debug.WriteLine($"[AI] Tool call: {fnName}");

                        // Live progress for scan-backed tools (run_scan, and the
                        // live-scan fallback of get_largest_files/search_files).
                        bool firstProgress = true;
                        var throttle = Stopwatch.StartNew();
                        var progress = new Progress<StreamProgress>(p =>
                        {
                            if (!firstProgress && throttle.ElapsedMilliseconds < 200)
                                return;
                            firstProgress = false;
                            throttle.Restart();
                            ThinkingStatus = p.Percentage > 0
                                ? $"Running {fnName} — {p.Percentage:0}% · {p.FilesScanned:N0} files…"
                                : p.FilesScanned > 0
                                    ? $"Running {fnName} — {p.FilesScanned:N0} files…"
                                    : $"Running {fnName}…";
                        });

                        var result = await (_toolExecutor ?? throw new InvalidOperationException("ToolExecutor not initialized"))
                            .ExecuteAsync(fnName, args, ct, userMessage, progress);

                        // Use the tool-call id returned by Ollama so the tool result
                        // message's tool_call_id matches the assistant's tool_calls id
                        // (OpenAI/Ollama tool-use spec). Fall back to a generated id
                        // when the model omits one.
                        var toolCallId = !string.IsNullOrWhiteSpace(toolCall.Id)
                            ? toolCall.Id
                            : $"call_{Guid.NewGuid():N}";
                        apiMessages.Add(new ChatMessage
                        {
                            Role = ChatRole.Tool,
                            Content = result,
                            ToolCallId = toolCallId,
                        });

                        // Also add to display messages (show as assistant with tool info)
                        AddMessage(ChatRole.Tool, $"[{fnName}] {TruncateResult(result)}",
                            new List<ToolCallResponse> { toolCall }, toolCallId);
                    }

                    // Continue loop — model should now synthesize a text response
                    continue;
                }

                // No tool calls — this is the final text response
                AddMessage(ChatRole.Assistant, message.Content ?? "(no response)");
                StatusText = "Ready.";
                break;
            }

            // Loop exhausted — model kept requesting tools without producing a final answer.
            AddMessage(ChatRole.Assistant,
                $"Reached the maximum of {MaxToolIterations} tool steps without a final answer. " +
                "Try rephrasing your question or narrowing the target directory.");
            StatusText = "Max steps reached.";
        }
        catch (OperationCanceledException)
        {
            StatusText = "Cancelled.";
        }
        catch (Exception ex)
        {
            AddMessage(ChatRole.Assistant,
                $"I could not reach Ollama. Make sure it is running and the model is loaded. ({ex.Message})");
            StatusText = "Connection failed.";
        }
        finally
        {
            ThinkingStatus = string.Empty;
            IsBusy = false;
        }
    }

    /// <summary>
    /// Builds the API message list from the display messages. Unlike the display
    /// list, the Ollama API context must include tool result messages (role "tool")
    /// so the model can see prior tool outputs on subsequent turns.
    /// </summary>
    private List<ChatMessage> BuildApiMessages()
    {
        var apiMessages = new List<ChatMessage>
        {
            new ChatMessage
            {
                Role = ChatRole.System,
                Content = "You are a helpful disk-usage analysis assistant. " +
                          "You help users find and reclaim disk space. Keep answers concise and actionable. " +
                          "Use the available tools to look up actual data before answering questions about disk usage, " +
                          "file sizes, scan history, or system resources."
            }
        };

        foreach (var msg in _messages)
        {
            // Always include user and assistant messages.
            if (msg.Role == ChatRole.User || msg.Role == ChatRole.Assistant)
            {
                apiMessages.Add(new ChatMessage
                {
                    Role = msg.Role,
                    Content = msg.Content,
                    ToolCalls = msg.ToolCalls,
                    // ToolCallId is only valid on tool-result messages; omitting it
                    // here (plus WhenWritingNull in JsonOptions) keeps the payload
                    // semantically correct for the Ollama/OpenAI tool-use spec.
                });
                continue;
            }

            // Include tool result messages so the model can see prior outputs.
            if (msg.Role == ChatRole.Tool)
            {
                apiMessages.Add(new ChatMessage
                {
                    Role = ChatRole.Tool,
                    Content = msg.Content,
                    ToolCallId = msg.ToolCallId,
                });
            }
        }

        return apiMessages;
    }

    private static Dictionary<string, object> ParseToolArguments(object arguments)
    {
        if (arguments is Dictionary<string, object> dict)
        {
            // Nested JsonElement values must be unwrapped to plain objects.
            var hasNestedElements = dict.Values.Any(v => v is JsonElement);
            if (!hasNestedElements)
                return dict;
            var json = JsonSerializer.Serialize(dict);
            return JsonSerializer.Deserialize<Dictionary<string, object>>(json, s_toolArgJson) ?? new();
        }

        if (arguments is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.Object)
                return JsonSerializer.Deserialize<Dictionary<string, object>>(je.GetRawText(), s_toolArgJson) ?? new();
            if (je.ValueKind == JsonValueKind.Undefined || je.ValueKind == JsonValueKind.Null)
                return new();
        }

        // Fallback: try parsing the string representation.
        var str = arguments.ToString();
        if (!string.IsNullOrWhiteSpace(str))
        {
            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, object>>(str, s_toolArgJson) ?? new();
            }
            catch { }
        }

        return new();
    }

    private static string TruncateResult(string result, int maxLen = 500)
    {
        return result.Length <= maxLen ? result : result[..maxLen] + "...";
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts.Cancel();
        _cts.Dispose();
        _client?.Dispose();
        _toolExecutor?.Dispose();
        GC.SuppressFinalize(this);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

/// <summary>
/// A single chat message for display in the AI Assistant UI.
/// </summary>
public class AIChatMessage : INotifyPropertyChanged
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

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
