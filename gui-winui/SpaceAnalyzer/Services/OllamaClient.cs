// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SpaceAnalyzer.Services;

/// <summary>
/// Minimal HTTP client for the local Ollama REST API.
/// Communicates with <c>/api/chat</c> and <c>/api/tags</c> endpoints.
/// </summary>
public class OllamaClient : IDisposable
{
    private readonly HttpClient _http;
    private bool _disposed;
    private ModelFallbackConfig _fallback;

    public OllamaClient(string baseUrl)
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromMinutes(5)
        };
        _fallback = new ModelFallbackConfig();
    }

    /// <summary>
    /// Configure model fallback from local discovered models.
    /// </summary>
    public void SetFallbackFromLocal(string primaryModel, IReadOnlyList<string> localModelNames)
    {
        _fallback = ModelFallbackConfig.FromLocalModels(primaryModel, localModelNames);
    }

    /// <summary>
    /// Send a non-streaming chat request with fallback support and return the assistant's reply text.
    /// </summary>
    public async Task<string> SendChatMessageAsync(
        string model,
        List<ChatMessage> messages,
        List<ToolDefinition>? tools = null,
        string? toolChoice = null,
        CancellationToken ct = default)
    {
        var candidates = new List<string> { model };
        if (_fallback.Enabled)
        {
            candidates.AddRange(_fallback.FallbackModels);
        }

        string? lastError = null;
        foreach (var candidate in candidates)
        {
            try
            {
                var response = await SendChatRequestAsync(candidate, messages, tools, toolChoice, ct).ConfigureAwait(false);
                return response;
            }
            catch (Exception ex)
            {
                lastError = ex.Message;
            }
        }

        throw new InvalidOperationException($"Chat failed for all candidates. Last error: {lastError}");
    }

    private async Task<string> SendChatRequestAsync(
        string model,
        List<ChatMessage> messages,
        List<ToolDefinition>? tools,
        string? toolChoice,
        CancellationToken ct)
    {
        var request = new ChatRequest
        {
            Model = model,
            Messages = messages,
            Stream = false,
            Options = new Dictionary<string, object>
            {
                ["temperature"] = 0.3,
                ["num_ctx"] = 8192,
                ["num_gpu"] = -1,
                ["num_predict"] = -1
            },
            KeepAlive = "5m",
            Tools = tools,
            ToolChoice = toolChoice
        };

        var json = JsonSerializer.Serialize(request, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _http.PostAsync("api/chat", content, ct).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        var responseJson = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        var chatResponse = JsonSerializer.Deserialize<ChatResponse>(responseJson, JsonOptions);

        return chatResponse?.Message?.Content ?? string.Empty;
    }

    /// <summary>
    /// Check whether the Ollama server is reachable and the given model is loaded.
    /// </summary>
    public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _http.GetAsync("api/tags", ct).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    // ── Shared JSON options ──

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _http.Dispose();
    }
}

// ── Request / Response DTOs ──

/// <summary>
/// Role of a chat message participant.
/// </summary>
public enum ChatRole { System, User, Assistant }

/// <summary>
/// A single chat message for Ollama <c>/api/chat</c>.
/// </summary>
public class ChatMessage
{
    public ChatRole Role { get; set; }
    public string Content { get; set; } = string.Empty;
}

/// <summary>
/// Request body for <c>/api/chat</c>.
/// </summary>
public class ChatRequest
{
    public string Model { get; set; } = string.Empty;
    public List<ChatMessage> Messages { get; set; } = new();
    public bool? Stream { get; set; }
    public Dictionary<string, object>? Options { get; set; }
    public object? Think { get; set; }
    public string? KeepAlive { get; set; }
    public Dictionary<string, object>? Format { get; set; }
    public List<ToolDefinition>? Tools { get; set; }
    public string? ToolChoice { get; set; }
}

/// <summary>
/// Definition of a tool for Ollama <c>/api/chat</c>.
/// Mirrors the Rust <c>ToolDefinition</c> struct.
/// </summary>
public class ToolDefinition
{
    public string Type { get; set; } = "function";
    public ToolFunction Function { get; set; } = new();
}

/// <summary>
/// Function descriptor within a tool definition.
/// </summary>
public class ToolFunction
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Dictionary<string, object>? Parameters { get; set; }
}

/// <summary>
/// Response from <c>/api/chat</c> (non-streaming mode).
/// </summary>
public class ChatResponse
{
    public string Model { get; set; } = string.Empty;
    public string? CreatedAt { get; set; }
    public ChatMessage? Message { get; set; }
    public bool Done { get; set; }
    public int? PromptEvalCount { get; set; }
    public int? EvalCount { get; set; }
}

/// <summary>
/// Fallback configuration for model routing.
/// </summary>
public class ModelFallbackConfig
{
    public bool Enabled { get; set; } = true;
    public List<string> FallbackModels { get; set; } = new();
    public bool LogFallbacks { get; set; } = true;

    /// <summary>
    /// Build a fallback chain from local discovered models, excluding the primary.
    /// Smaller/faster models are tried first.
    /// </summary>
    public static ModelFallbackConfig FromLocalModels(string primaryModel, IReadOnlyList<string> localModelNames)
    {
        var fallbacks = localModelNames
            .Where(m => !string.Equals(m, primaryModel, StringComparison.OrdinalIgnoreCase))
            .ToList();

        fallbacks.Sort((a, b) =>
        {
            var scoreA = SizeScore(a);
            var scoreB = SizeScore(b);
            return scoreA != scoreB ? scoreA.CompareTo(scoreB) : a.Length.CompareTo(b.Length);
        });

        return new ModelFallbackConfig
        {
            Enabled = true,
            FallbackModels = fallbacks,
            LogFallbacks = true
        };
    }

    private static int SizeScore(string model)
    {
        var lower = model.ToLowerInvariant();
        if (lower.Contains(":1b") || lower.Contains("tiny")) return 0;
        if (lower.Contains(":3b") || lower.Contains(":4b")) return 1;
        if (lower.Contains(":7b") || lower.Contains(":8b")) return 2;
        return 3;
    }
}

