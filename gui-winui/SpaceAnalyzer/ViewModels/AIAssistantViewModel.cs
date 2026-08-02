// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the AI Assistant page. Sends user queries to the local
/// Ollama server via <see cref="OllamaClient"/> and displays the conversation.
/// Supports model routing: auto-selects chat/tool models per task and falls
/// back through local models when the primary is unavailable.
/// </summary>
public class AIAssistantViewModel : INotifyPropertyChanged, IDisposable
{
    private OllamaClient? _client;
    private CancellationTokenSource _cts = new();
    private bool _disposed;

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

    public bool ShowSuggestions => _messages.Count <= 2;

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

    public AIAssistantViewModel()
    {
        LoadSettings();
        _client = new OllamaClient(_ollamaUrl);
        AddMessage(ChatRole.Assistant,
            "Hello! I am your AI assistant for Space Analyzer Pro. " +
            "I can help you understand your disk usage and find space-saving opportunities. " +
            "Ask me anything!");
    }

    private void RefreshOllamaClient()
    {
        if (_disposed) return;
        _client?.Dispose();
        _client = new OllamaClient(OllamaUrl);
    }

    private void LoadSettings()
    {
        try
        {
            var container = Windows.Storage.ApplicationData.Current.LocalSettings
                .CreateContainer("SpaceAnalyzer.Settings", Windows.Storage.ApplicationDataCreateDisposition.Always);

            // Set backing fields directly to avoid triggering property setter side effects
            // (e.g. OllamaUrl setter calls RefreshOllamaClient()) before all values load.
            if (container.Values.TryGetValue("OllamaUrl", out var v))
                _ollamaUrl = (string)v;
            if (container.Values.TryGetValue("OllamaModel", out v))
                _ollamaModel = (string)v;
            if (container.Values.TryGetValue("ToolCallingModel", out v))
                _toolCallingModel = (string)v;
            if (container.Values.TryGetValue("AgenticToolsEnabled", out v) && v is bool b)
                _agenticToolsEnabled = b;
            if (container.Values.TryGetValue("AutoModelSelection", out v) && v is bool b2)
                _autoModelSelection = b2;
            if (container.Values.TryGetValue("ToolChoice", out v))
                _toolChoice = (string)v;

            // Fire change notifications for loaded properties
            OnPropertyChanged(nameof(OllamaUrl));
            OnPropertyChanged(nameof(OllamaModel));
            OnPropertyChanged(nameof(ToolCallingModel));
            OnPropertyChanged(nameof(AgenticToolsEnabled));
            OnPropertyChanged(nameof(AutoModelSelection));
            OnPropertyChanged(nameof(ToolChoice));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[AIAssistantViewModel] LoadSettings failed: {ex}");
            // Defaults are fine.
        }
    }

    private const int MaxMessages = 50;

    public void AddMessage(ChatRole role, string content)
    {
        _messages.Add(new AIChatMessage(role, content));
        while (_messages.Count > MaxMessages)
            _messages.RemoveAt(0);
        OnPropertyChanged(nameof(ShowSuggestions));
    }

    private string ClassifyTask(string userMessage)
    {
        var lower = userMessage.ToLowerInvariant();
        if (lower.Contains("analyz") || lower.Contains("recommend") || lower.Contains("report"))
            return "Analysis";
        if (lower.Contains("run") || lower.Contains("execute") || lower.Contains("clean") || lower.Contains("delete"))
            return "Tool Calling";
        if (lower.Contains("search") || lower.Contains("find") || lower.Contains("file") || lower.Contains("scan"))
            return "Semantic Search";
        return "General Chat";
    }

    /// <summary>
    /// Dynamically resolves tool_choice based on the user's question,
    /// mirroring the Rust <c>resolve_tool_choice</c> logic in
    /// <see cref="src/ollama/features.rs"/>.
    /// When the question clearly references disk-analysis domain keywords
    /// or tool names, forces "required" so the model skips chit-chat
    /// and goes straight to tool calling.
    /// </summary>
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

        if (tools.Count == 0 || lower.Contains("hello") || lower.Contains("hi "))
            return "auto";
        if (hasDomainKeyword || hasToolName)
            return "required";
        return "auto";
    }

    private string SelectModelForTask(string taskType)
    {
        // In the WinUI frontend we don't have a discovered model list, so we
        // pick between the two configured slots based on task heuristics.
        if (!AutoModelSelection) return OllamaModel;

        var lower = taskType.ToLowerInvariant();
        if (lower.Contains("tool") || lower.Contains("agentic") || lower.Contains("workflow"))
            return string.IsNullOrWhiteSpace(ToolCallingModel) ? OllamaModel : ToolCallingModel;

        return OllamaModel;
    }

    private List<ToolDefinition> GetToolDefinitions()
    {
        var tools = new List<ToolDefinition>
        {
            // Always-available tools
            new ToolDefinition
            {
                Type = "function",
                Function = new ToolFunction
                {
                    Name = "get_disk_volumes",
                    Description = "Get information about all disk volumes including total size, used space, and available space.",
                    Parameters = new Dictionary<string, object>()
                }
            },
            new ToolDefinition
            {
                Type = "function",
                Function = new ToolFunction
                {
                    Name = "get_system_resources",
                    Description = "Get current CPU and memory usage statistics.",
                    Parameters = new Dictionary<string, object>()
                }
            },
            new ToolDefinition
            {
                Type = "function",
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
                Type = "function",
                Function = new ToolFunction
                {
                    Name = "list_workflows",
                    Description = "List all available workflow templates with their descriptions.",
                    Parameters = new Dictionary<string, object>()
                }
            },
            new ToolDefinition
            {
                Type = "function",
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
            // Destructive-action preview gate tools (read-only / preview only)
            new ToolDefinition
            {
                Type = "function",
                Function = new ToolFunction
                {
                    Name = "preview_impact",
                    Description = "Generate a destructive-action impact report for a file. Shows hardlinks, symlinks, sibling files, and an impact assessment. READ-ONLY — does not modify the filesystem.",
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
                Type = "function",
                Function = new ToolFunction
                {
                    Name = "move_to_trash",
                    Description = "PREVIEW ONLY: Returns an impact report for moving a file to trash. The AI agent CANNOT perform this action directly. The user must confirm via the GUI.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the file to move to trash" }
                        },
                        ["required"] = new List<string> { "path" }
                    }
                }
            },
            new ToolDefinition
            {
                Type = "function",
                Function = new ToolFunction
                {
                    Name = "hardlink_duplicates",
                    Description = "PREVIEW ONLY: Returns a plan for hard-linking duplicate files in a directory. The AI agent CANNOT perform this action directly.",
                    Parameters = new Dictionary<string, object>
                    {
                        ["type"] = "object",
                        ["properties"] = new Dictionary<string, object>
                        {
                            ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the directory to scan for duplicates" }
                        },
                        ["required"] = new List<string> { "path" }
                    }
                }
            }
        };

        // Scan-dependent tools (only meaningful after a scan has been run)
        tools.Add(new ToolDefinition
        {
            Type = "function",
            Function = new ToolFunction
            {
                Name = "get_scan_summary",
                Description = "Get a summary of the current scan results including total files, size, and file type distribution.",
                Parameters = new Dictionary<string, object>()
            }
        });

        tools.Add(new ToolDefinition
        {
            Type = "function",
            Function = new ToolFunction
            {
                Name = "get_file_type_breakdown",
                Description = "Get a detailed breakdown of files by extension from the current scan.",
                Parameters = new Dictionary<string, object>()
            }
        });

        tools.Add(new ToolDefinition
        {
            Type = "function",
            Function = new ToolFunction
            {
                Name = "analyze_file_patterns",
                Description = "Analyze file patterns to find duplicates, similar files, and categorization insights from current scan.",
                Parameters = new Dictionary<string, object>()
            }
        });

        tools.Add(new ToolDefinition
        {
            Type = "function",
            Function = new ToolFunction
            {
                Name = "search_files",
                Description = "Search files in the current scan by extension, name keyword, or size range.",
                Parameters = new Dictionary<string, object>
                {
                    ["type"] = "object",
                    ["properties"] = new Dictionary<string, object>
                    {
                        ["extension"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Filter by file extension (without dot, e.g. 'pdf')" },
                        ["keyword"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Filter by keyword in file path/name" },
                        ["min_size_mb"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Minimum file size in MB" },
                        ["max_size_mb"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Maximum file size in MB" },
                        ["limit"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Maximum number of results (default 20)" }
                    },
                    ["required"] = new List<string>()
                }
            }
        });

        tools.Add(new ToolDefinition
        {
            Type = "function",
            Function = new ToolFunction
            {
                Name = "get_largest_files",
                Description = "Get the largest files from the current scan with optional size filter and configurable count.",
                Parameters = new Dictionary<string, object>
                {
                    ["type"] = "object",
                    ["properties"] = new Dictionary<string, object>
                    {
                        ["count"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Number of largest files to return (default 20, max 100)" },
                        ["min_size_mb"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Minimum file size in MB to include" }
                    },
                    ["required"] = new List<string>()
                }
            }
        });

        return tools;
    }

    public async Task SendMessageAsync()
    {
        if (_disposed) return;
        if (IsBusy || string.IsNullOrWhiteSpace(InputText))
            return;

        _cts.Dispose();
        _cts = new CancellationTokenSource();

        var userMessage = InputText.Trim();
        AddMessage(ChatRole.User, userMessage);
        InputText = string.Empty;

        var assistantMsg = new AIChatMessage(ChatRole.Assistant, string.Empty);
        _messages.Add(assistantMsg);

        IsBusy = true;
        StatusText = "Thinking...";

        var taskType = ClassifyTask(userMessage);
        var selectedModel = SelectModelForTask(taskType);

        var apiMessages = new List<ChatMessage>
        {
            new()
            {
                Role = ChatRole.System,
                Content = "You are a helpful disk-usage analysis assistant. " +
                          "You help users find and reclaim disk space. Keep answers concise and actionable."
            }
        };

        foreach (var msg in _messages)
        {
            apiMessages.Add(new ChatMessage
            {
                Role = msg.Role,
                Content = msg.Content
            });
        }

        try
        {
            if (_client is null)
            {
                assistantMsg.Content = "Ollama client is not configured. Check your settings.";
                StatusText = "Not connected.";
                return;
            }

            List<ToolDefinition>? tools = null;
            string resolvedToolChoice = "auto";
            if (AgenticToolsEnabled)
            {
                tools = GetToolDefinitions();
                resolvedToolChoice = ResolveToolChoice(userMessage, tools);
            }

            var response = await _client.SendChatMessageAsync(selectedModel, apiMessages, tools, resolvedToolChoice, _cts.Token);
            assistantMsg.Content = response;
            StatusText = "Ready.";
        }
        catch (Exception ex)
        {
            assistantMsg.Content = $"I could not reach Ollama. Make sure it is running and the model is loaded. ({ex.Message})";
            StatusText = "Connection failed.";
        }
        finally
        {
            IsBusy = false;
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts.Cancel();
        _cts.Dispose();
        _client?.Dispose();
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
        set { _content = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsUser)); }
    }
    public DateTime Timestamp { get; }
    public bool IsUser => _role == ChatRole.User;
    public string TimestampDisplay => Timestamp.ToString("HH:mm");

    public AIChatMessage(ChatRole role, string content)
    {
        _role = role;
        _content = content;
        Timestamp = DateTime.Now;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}


