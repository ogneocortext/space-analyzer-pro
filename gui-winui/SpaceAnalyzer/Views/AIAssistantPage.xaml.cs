// Licensed under the MIT License.

using System.ComponentModel;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Navigation;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class AIAssistantPage : Page
{
    public AIAssistantViewModel VM { get; }

    public AIAssistantPage()
    {
        InitializeComponent();
        VM = new AIAssistantViewModel();
        DataContext = VM;
        ViewModelRegistry.Register(VM);
        AppLog.Page("AIAssistantPage ctor end");
        MessageScroll.SizeChanged += (_, _) => ScrollToBottom();
        MessageScroll.ViewChanged += (_, _) => UpdateFollowTail();
        VM.Messages.CollectionChanged += (_, _) => ScrollToBottom();
    }

    /// <summary>
    /// Re-read shared settings whenever the page is navigated to, so Ollama
    /// changes made on the Settings page take effect without an app restart.
    /// </summary>
    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        VM.ReloadSettings();
    }

    /// <summary>
    /// Tracks whether the user is pinned to the bottom of the transcript. New messages
    /// only auto-scroll when this is true, so reading history is never yanked away by an
    /// incoming reply. Also drives the "New messages" jump button.
    /// </summary>
    private bool _followTail = true;

    private void UpdateFollowTail()
    {
        var sv = MessageScroll;
        _followTail = sv.ScrollableHeight <= 0 || sv.VerticalOffset >= sv.ScrollableHeight - 24;
        JumpToLatest.Visibility = _followTail ? Visibility.Collapsed : Visibility.Visible;
    }

    private void ScrollToBottom()
    {
        if (_followTail)
            MessageScroll.ChangeView(null, MessageScroll.ScrollableHeight, null);
    }

    private void JumpToLatest_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage JumpToLatest_Click");
        _followTail = true;
        MessageScroll.ChangeView(null, MessageScroll.ScrollableHeight, null);
        JumpToLatest.Visibility = Visibility.Collapsed;
    }

    private void Input_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage Input_KeyDown");
        if (e.Key == Windows.System.VirtualKey.Enter)
        {
            // Chat convention: Enter (or Ctrl+Enter) sends; Shift+Enter inserts a newline.
            var shift = Microsoft.UI.Input.InputKeyboardSource
                .GetKeyStateForCurrentThread(Windows.System.VirtualKey.Shift)
                .HasFlag(Windows.UI.Core.CoreVirtualKeyStates.Down);
            if (!shift)
            {
                e.Handled = true;
                _ = SendAsync();
            }
        }
    }

    private async Task SendAsync()
    {
        // User-initiated send: pin to the tail so their message and the reply stay in view.
        _followTail = true;
        await VM.SendMessageAsync();
    }

    private async void Send_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage Send_Click");
        await SendAsync();
    }

    private void ClearChat_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage ClearChat_Click");
        VM.Messages.Clear();
        VM.AddMessage(ChatRole.Assistant,
            "Hello! I am your AI assistant for Space Analyzer Pro. " +
            "I can help you understand your disk usage and find space-saving opportunities. " +
            "Ask me anything!");
        _followTail = true;
        ScrollToBottom();
    }

    private void Stop_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage Stop_Click");
        VM.Abort();
    }

    private void CopyMessage_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage CopyMessage_Click");
        if (sender is Button btn && btn.Tag is string content)
        {
            var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();
            dataPackage.SetText(content);
            Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(dataPackage);
        }
    }

    private async void SuggestedPrompt_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage SuggestedPrompt_Click");
        if (sender is Button btn && btn.Tag is string prompt)
        {
            VM.InputText = prompt;
            await SendAsync();
        }
    }

    private void RetryConnection_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage RetryConnection_Click");
        VM.RetryConnection();
    }
}
