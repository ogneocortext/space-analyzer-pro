// Licensed under the MIT License.

using System;
using System.Collections.Generic;
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

    public OllamaClient(string baseUrl)
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromMinutes(5)
        };
    }

    /// <summary>
    /// Send a non-streaming chat request and return the assistant's reply text.
    /// </summary>
    public async Task<string> SendChatMessageAsync(
        string model,
        List<ChatMessage> messages,
        CancellationToken ct = default)
    {
        var request = new ChatRequest
        {
            Model = model,
            Messages = messages,
            Stream = false
        };

        var json = JsonSerializer.Serialize(request, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _http.PostAsync("api/chat", content, ct);
        response.EnsureSuccessStatusCode();

        var responseJson = await response.Content.ReadAsStringAsync(ct);
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
            var response = await _http.GetAsync("api/tags", ct);
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
