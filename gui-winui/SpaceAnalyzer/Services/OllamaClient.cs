// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace SpaceAnalyzer.Services;

/// <summary>
/// HTTP client for the local Ollama REST API.
/// Supports multi-round agentic tool-calling conversations.
/// </summary>
public class OllamaClient : IDisposable
{
    private readonly HttpClient _http;
    private bool _disposed;
    private ModelFallbackConfig _fallback;
    private const int MaxRetries = 2;

    public OllamaClient(string baseUrl)
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromMinutes(5)
        };
        _fallback = new ModelFallbackConfig();
    }

    public void SetFallbackFromLocal(string primaryModel, IReadOnlyList<string> localModelNames)
    {
        _fallback = ModelFallbackConfig.FromLocalModels(primaryModel, localModelNames);
    }

    /// <summary>
    /// Returns true if the exception is transient and the request should be retried.
    /// Non-transient errors (bad request, invalid model, auth) fail immediately.
    /// </summary>
    private static bool IsTransientError(Exception ex)
    {
        return ex is HttpRequestException
            or TaskCanceledException
            or TimeoutException
            or InvalidOperationException;
    }

    /// <summary>
    /// Send a chat request and return the full <see cref="ChatResponse"/> (not just text).
    /// Includes tool_calls when the model requests them.
    /// Retries only transient errors (network, timeout); fails immediately on bad input.
    /// </summary>
    public async Task<ChatResponse> SendChatMessageAsync(
        string model,
        List<ChatMessage> messages,
        List<ToolDefinition>? tools = null,
        string? toolChoice = null,
        CancellationToken ct = default,
        bool? think = null)
    {
        if (string.IsNullOrWhiteSpace(model))
            throw new ArgumentException("Model name cannot be empty", nameof(model));
        if (messages == null || messages.Count == 0)
            throw new ArgumentException("Messages list cannot be null or empty", nameof(messages));

        var candidates = new List<string> { model };
        if (_fallback.Enabled)
            candidates.AddRange(_fallback.FallbackModels);

        string? lastError = null;
        foreach (var candidate in candidates)
        {
            for (int attempt = 0; attempt <= MaxRetries; attempt++)
            {
                try
                {
                    return await SendChatRequestAsync(candidate, messages, tools, toolChoice, think, ct)
                        .ConfigureAwait(false);
                }
                catch (Exception ex) when (IsTransientError(ex) && attempt < MaxRetries)
                {
                    lastError = ex.Message;
                    await Task.Delay(TimeSpan.FromMilliseconds(200 * Math.Pow(2, attempt)), ct)
                        .ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    lastError = ex.Message;
                    break;
                }
            }
        }

        throw new InvalidOperationException($"Chat failed for all candidates. Last error: {lastError}");
    }

    private async Task<ChatResponse> SendChatRequestAsync(
        string model,
        List<ChatMessage> messages,
        List<ToolDefinition>? tools,
        string? toolChoice,
        bool? think,
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
        if (think.HasValue)
            request.Think = think.Value;

        var json = JsonSerializer.Serialize(request, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _http.PostAsync("api/chat", content, ct).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            var status = (int)response.StatusCode;
            var errBody = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            string detail = errBody;
            try
            {
                using var doc = JsonDocument.Parse(errBody);
                if (doc.RootElement.TryGetProperty("error", out var errEl))
                    detail = errEl.GetString() ?? errBody;
            }
            catch { }
            // Throw non-transient (OllamaApiException is not in IsTransientError)
            // so SendChatMessageAsync fails fast instead of burning retries on a 4xx
            // (e.g. unknown/invalid model).
            throw new OllamaApiException($"Ollama returned {status}: {detail}");
        }

        var responseJson = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        var chatResponse = JsonSerializer.Deserialize<ChatResponse>(responseJson, JsonOptions);

        return chatResponse ?? throw new InvalidOperationException("Null response from Ollama");
    }

    /// <summary>
    /// Check whether the Ollama server is reachable.
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

    /// <summary>
    /// Returns the models installed on the Ollama server by querying
    /// <c>/api/tags</c>. Returns an empty list if the server is unreachable.
    /// </summary>
    public async Task<List<OllamaModelInfo>> GetInstalledModelsAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _http.GetAsync("api/tags", ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
                return new List<OllamaModelInfo>();
            var json = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var payload = JsonSerializer.Deserialize<TagsResponse>(json, JsonOptions);
            return payload?.Models ?? new List<OllamaModelInfo>();
        }
        catch
        {
            return new List<OllamaModelInfo>();
        }
    }

    // ── Shared JSON options ──

    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false,
        // Omit null fields (e.g. tool_call_id on non-tool messages, tool_calls on
        // plain text messages) so the request payload matches the Ollama/OpenAI
        // tool-use message shape exactly.
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
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
/// Raised when the Ollama server returns a non-success HTTP status (e.g. 404 for an
/// unknown model). Intentionally NOT transient, so <see cref="SendChatMessageAsync"/>
/// surfaces it immediately instead of retrying.
/// </summary>
public class OllamaApiException : Exception
{
    public OllamaApiException(string message) : base(message) { }
}

/// <summary>
/// Payload for <c>/api/tags</c>.
/// </summary>
public class TagsResponse
{
    public List<OllamaModelInfo> Models { get; set; } = new();
}

/// <summary>
/// A model installed on the Ollama server (from <c>/api/tags</c>).
/// </summary>
public class OllamaModelInfo
{
    public string Name { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public long Size { get; set; }

    [JsonPropertyName("modified_at")]
    public string? ModifiedAt { get; set; }

    public List<string> Capabilities { get; set; } = new();
    public OllamaModelDetails? Details { get; set; }

    /// <summary>
    /// UI-only flag: true when this model matches the configured default model in
    /// Settings, so the AI Assistant page can highlight it in the installed-model list.
    /// Not serialized (it is derived by the ViewModel, not returned by Ollama).
    /// </summary>
    [JsonIgnore]
    public bool IsDefault { get; set; }

    [JsonIgnore]
    public string SizeDisplay
    {
        get
        {
            double mb = Size / (1024.0 * 1024.0);
            return mb >= 1024 ? $"{mb / 1024.0:F1} GB" : $"{mb:F0} MB";
        }
    }
}

/// <summary>
/// Model metadata details from <c>/api/tags</c>.
/// </summary>
public class OllamaModelDetails
{
    public string? Family { get; set; }

    [JsonPropertyName("parameter_size")]
    public string? ParameterSize { get; set; }

    [JsonPropertyName("quantization_level")]
    public string? QuantizationLevel { get; set; }
}

/// <summary>
/// Role of a chat message participant.
/// </summary>
public enum ChatRole { System, User, Assistant, Tool }

/// <summary>
/// A single chat message for Ollama <c>/api/chat</c>.
/// </summary>
public class ChatMessage
{
    public ChatRole Role { get; set; }
    public string Content { get; set; } = string.Empty;

    [JsonPropertyName("tool_calls")]
    public List<ToolCallResponse>? ToolCalls { get; set; }

    [JsonPropertyName("tool_call_id")]
    public string? ToolCallId { get; set; }
}

/// <summary>
/// A tool call requested by the model.
/// </summary>
public class ToolCallResponse
{
    /// <summary>
    /// Ollama/OpenAI tool-call identifier (e.g. <c>call_abc123</c>). Preserved so
    /// the tool-result message's <c>tool_call_id</c> matches the assistant's
    /// tool_calls id, as required by the tool-use spec.
    /// </summary>
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("type")]
    public string Type { get; set; } = "function";

    [JsonPropertyName("function")]
    public ToolCallFunction Function { get; set; } = new();
}

/// <summary>
/// Function details within a tool call.
/// </summary>
public class ToolCallFunction
{
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("arguments")]
    public object Arguments { get; set; } = new();
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
