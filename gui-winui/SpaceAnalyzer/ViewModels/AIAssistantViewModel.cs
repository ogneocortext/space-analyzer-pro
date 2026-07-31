// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Windows.Storage;
using Windows.Storage.Pickers;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the AI Assistant page. Sends user queries to the local
/// Ollama server via <see cref="OllamaClient"/> and displays the conversation.
/// </summary>
public class AIAssistantViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly OllamaClient? _client;
    private readonly CancellationTokenSource _cts = new();
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

    // ── Settings (from local settings) ──

    private string _ollamaUrl = "http://localhost:11434";
    public string OllamaUrl
    {
        get => _ollamaUrl;
        set { _ollamaUrl = value; OnPropertyChanged(); }
    }

    private string _ollamaModel = "gemma3:1b";
    public string OllamaModel
    {
        get => _ollamaModel;
        set { _ollamaModel = value; OnPropertyChanged(); }
    }

    public AIAssistantViewModel()
    {
        LoadSettings();
        _client = new OllamaClient(OllamaUrl);
        AddMessage(ChatRole.Assistant,
            "Hello! I am your AI assistant for Space Analyzer Pro. " +
            "I can help you understand your disk usage and find space-saving opportunities. " +
            "Ask me anything!");
    }

    private void LoadSettings()
    {
        try
        {
            var container = Windows.Storage.ApplicationData.Current.LocalSettings
                .CreateContainer("SpaceAnalyzer.Settings", Windows.Storage.ApplicationDataCreateDisposition.Always);

            if (container.Values.TryGetValue("OllamaUrl", out var v))
                OllamaUrl = (string)v;
            if (container.Values.TryGetValue("OllamaModel", out v))
                OllamaModel = (string)v;
        }
        catch
        {
            // Defaults are fine.
        }
    }

    private void AddMessage(ChatRole role, string content)
    {
        _messages.Add(new AIChatMessage(role, content));
    }

    public async Task SendMessageAsync()
    {
        if (IsBusy || string.IsNullOrWhiteSpace(InputText))
            return;

        var userMessage = InputText.Trim();
        AddMessage(ChatRole.User, userMessage);
        InputText = string.Empty;

        var assistantMsg = new AIChatMessage(ChatRole.Assistant, string.Empty);
        _messages.Add(assistantMsg);

        IsBusy = true;
        StatusText = "Thinking...";

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

            var response = await _client.SendChatMessageAsync(OllamaModel, apiMessages, _cts.Token);
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


