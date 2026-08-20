// Licensed under the MIT License.
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

public partial class AIAssistantViewModel
{
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

        string? selectedModel = null;

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

            selectedModel = SelectModelForTask(userMessage);
            var apiMessages = BuildApiMessages();
            List<ToolDefinition>? tools = null;
            string resolvedToolChoice = "auto";

            if (AgenticToolsEnabled)
            {
                tools = GetToolDefinitions();
                resolvedToolChoice = ResolveToolChoice(userMessage, tools);
            }

            bool gotFinalAnswer = false;
            // Tracks the exact (tool name + serialized arguments) signature of every
            // tool call executed this turn. Used to break runaway loops where a model
            // re-issues an identical call and never converges on a final answer.
            var executedToolSignatures = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int iteration = 0; iteration < MaxToolIterations; iteration++)
            {
                ct.ThrowIfCancellationRequested();

                ThinkingStatus = iteration == 0
                    ? "Thinking..."
                    : $"Executing tools (step {iteration + 1})...";

                // Force a tool call on the first turn only (when the question is a
                // domain query). After the model has gathered data, switch to "auto"
                // so it is free to synthesize a final text answer instead of being
                // forced into another tool call (which produced empty "(no response)"
                // answers and redundant multi-tool loops like list_workflows ->
                // run_workflow -> run_scan -> search_files for a single query).
                var effectiveToolChoice = iteration == 0 ? resolvedToolChoice : "auto";

                // Regression guard for winui:c4d7b1e9a2f0: forcing tool_choice="required"
                // on any iteration after the first reintroduces empty "(no response)" answers
                // and redundant multi-tool loops. Only the first turn may force a tool call.
                System.Diagnostics.Debug.Assert(
                    iteration == 0 || effectiveToolChoice == "auto",
                    "tool_choice must be 'auto' after the first iteration; only turn 0 may force a tool.");

                // Stream the model response token-by-token. `liveAssistant` is the
                // on-screen bubble that grows as text arrives; `finalMessage` is the
                // assembled message used for tool-execution / final-answer logic.
                StringBuilder? streamedContent = null;
                AIChatMessage? liveAssistant = null;
                List<ToolCallResponse>? accumulatedToolCalls = null;
                ChatMessage? finalMessage = null;

                await foreach (var chunk in _client.SendChatMessageStreamAsync(
                    selectedModel, apiMessages, tools, effectiveToolChoice, ct, think: OllamaThink))
                {
                    ct.ThrowIfCancellationRequested();

                    var cm = chunk.Message;
                    if (cm != null)
                    {
                        if (!string.IsNullOrEmpty(cm.Content))
                        {
                            streamedContent ??= new StringBuilder();
                            if (liveAssistant is null)
                            {
                                liveAssistant = new AIChatMessage(ChatRole.Assistant, string.Empty);
                                _messages.Add(liveAssistant);
                                OnPropertyChanged(nameof(ShowSuggestions));
                                ThinkingStatus = string.Empty;
                            }
                            streamedContent.Append(cm.Content);
                            liveAssistant.Content = streamedContent.ToString();
                        }
                        if (cm.ToolCalls is { Count: > 0 })
                        {
                            accumulatedToolCalls = cm.ToolCalls;
                            // A tool turn must not leave a partial text bubble behind.
                            if (liveAssistant is not null)
                            {
                                _messages.Remove(liveAssistant);
                                liveAssistant = null;
                            }
                        }
                    }

                    if (chunk.Done)
                    {
                        finalMessage = new ChatMessage
                        {
                            Role = ChatRole.Assistant,
                            Content = streamedContent?.ToString() ?? cm?.Content ?? string.Empty,
                            ToolCalls = accumulatedToolCalls
                        };
                    }
                }

                if (finalMessage is null)
                {
                    AddMessage(ChatRole.Assistant, "Received empty response from model.");
                    gotFinalAnswer = true;
                    break;
                }

                var message = finalMessage;

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
                        var toolSig = fnName + "|" + JsonSerializer.Serialize(args, s_toolArgJson);
                        bool isRepeatCall = !executedToolSignatures.Add(toolSig);

                        // Use the tool-call id returned by Ollama so the tool result
                        // message's tool_call_id matches the assistant's tool_calls id
                        // (OpenAI/Ollama tool-use spec). Fall back to a generated id
                        // when the model omits one. Computed before the live progress
                        // bubble so the bubble can carry the id from the start.
                        var toolCallId = !string.IsNullOrWhiteSpace(toolCall.Id)
                            ? toolCall.Id
                            : $"call_{Guid.NewGuid():N}";

                        ThinkingStatus = $"Running {fnName}...";
                        System.Diagnostics.Debug.WriteLine($"[AI] Tool call: {fnName}");

                        // Live tool-progress bubble: a Tool-role chat entry that fills
                        // in with streamed progress text as the tool runs, mirroring the
                        // final-answer token streaming. This surfaces scan progress (and
                        // a simple "Running…" placeholder for instant tools) directly in
                        // the conversation instead of only the status bar.
                        var toolBubble = new AIChatMessage(
                            ChatRole.Tool, $"[{fnName}] Running…",
                            new List<ToolCallResponse> { toolCall }, toolCallId);
                        _messages.Add(toolBubble);
                        while (_messages.Count > MaxMessages)
                            _messages.RemoveAt(0);
                        OnPropertyChanged(nameof(ShowSuggestions));

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
                            var status = p.Percentage > 0
                                ? $"Running {fnName} — {p.Percentage:0}% · {p.FilesScanned:N0} files…"
                                : p.FilesScanned > 0
                                    ? $"Running {fnName} — {p.FilesScanned:N0} files…"
                                    : $"Running {fnName}…";
                            toolBubble.Content = $"[{fnName}] {status}";
                            ThinkingStatus = status;
                        });

                        var result = await (_toolExecutor ?? throw new InvalidOperationException("ToolExecutor not initialized"))
                            .ExecuteAsync(fnName, args, ct, userMessage, progress);

                        // Cap the result fed back into the model context so a
                        // large tool payload (e.g. a full scan JSON) cannot blow
                        // up the prompt over a long agentic conversation. The
                        // display message keeps the shorter 500-char preview.
                        // When the same tool+arguments repeats, append a nudge so
                        // the model converges on an answer instead of looping.
                        var modelContext = isRepeatCall
                            ? result + SelfCorrectionNudge
                            : result;
                        apiMessages.Add(new ChatMessage
                        {
                            Role = ChatRole.Tool,
                            Content = TruncateResult(modelContext, ToolResultApiMaxChars),
                            ToolCallId = toolCallId,
                        });

                        // The display bubble was created above and streamed live; swap
                        // the progress text for the final (truncated) tool result.
                        toolBubble.Content = $"[{fnName}] {TruncateResult(result)}";
                    }

                    // Continue loop — model should now synthesize a text response
                    continue;
                }

                // No tool calls — this is the final text response. The live assistant
                // bubble already shows the streamed text; only add a message when the
                // model produced no streamed text at all (e.g. an empty "(no response)").
                if (liveAssistant is null)
                    AddMessage(ChatRole.Assistant, message.Content ?? "(no response)");
                else
                    liveAssistant.Content = message.Content ?? liveAssistant.Content;
                StatusText = "Ready.";
                gotFinalAnswer = true;
                break;
            }

            // Only surface the exhaustion notice if the model never produced a final
            // answer (i.e. it kept requesting tools until the iteration cap was hit).
            if (!gotFinalAnswer)
            {
                AddMessage(ChatRole.Assistant,
                    $"Reached the maximum of {MaxToolIterations} tool steps without a final answer. " +
                    "Try rephrasing your question or narrowing the target directory.");
                StatusText = "Max steps reached.";
            }
        }
        catch (OperationCanceledException)
        {
            StatusText = "Cancelled.";
        }
        catch (Exception ex)
        {
            var msg = ex.Message;
            // An unknown/uninstalled model returns a 404 with an explicit Ollama
            // error body ("model 'x' not found"); surface that clearly instead of
            // the misleading "could not reach Ollama".
            var isModelError = msg.Contains("model", StringComparison.OrdinalIgnoreCase)
                && (msg.Contains("not found", StringComparison.OrdinalIgnoreCase)
                    || msg.Contains("does not exist", StringComparison.OrdinalIgnoreCase)
                    || msg.Contains("404", StringComparison.OrdinalIgnoreCase));
            var friendly = isModelError
                ? $"The model '{selectedModel}' is not available on the Ollama server. " +
                  "Install it (e.g. 'ollama pull <model>') or choose a different model in Settings."
                : $"I could not reach Ollama. Make sure it is running and the model is loaded. ({msg})";
            AddMessage(ChatRole.Assistant, friendly);
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

    /// <summary>
    /// Maximum characters of a tool result fed back into the model context.
    /// Large payloads (e.g. a full scan JSON) are truncated here to keep the
    /// prompt bounded over long agentic conversations; the UI display uses the
    /// shorter 500-char <see cref="TruncateResult"/> default.
    /// </summary>
    private const int ToolResultApiMaxChars = 12000;

    /// <summary>
    /// Appended to a tool result when the model repeats an identical tool call
    /// (same name and arguments) it already executed this turn. Encourages the
    /// model to synthesize a final answer or try different arguments instead of
    /// looping until the iteration cap, without cluttering the on-screen message.
    /// </summary>
    private const string SelfCorrectionNudge =
        "\n\n[System note: you already called this exact tool with these exact arguments earlier and got the same result. " +
        "Do not call it again. Either answer the user's question now or call a different tool with different arguments.]";

}
