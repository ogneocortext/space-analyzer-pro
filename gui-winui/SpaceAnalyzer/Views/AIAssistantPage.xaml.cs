// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
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
        AppLog.Page("AIAssistantPage ctor end");
        MessageScroll.SizeChanged += (_, _) => ScrollToBottom();
        VM.Messages.CollectionChanged += (_, _) => ScrollToBottom();
    }

    private void ScrollToBottom()
    {
        MessageScroll.ChangeView(null, MessageScroll.ScrollableHeight, null);
    }

    private void Input_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage Input_KeyDown");
        if (e.Key == Windows.System.VirtualKey.Enter)
        {
            e.Handled = true;
            _ = VM.SendMessageAsync();
        }
    }

    private async void Send_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage Send_Click");
        await VM.SendMessageAsync();
    }

    private void ClearChat_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AIAssistantPage ClearChat_Click");
        VM.Messages.Clear();
        VM.AddMessage(ChatRole.Assistant,
            "Hello! I am your AI assistant for Space Analyzer Pro. " +
            "I can help you understand your disk usage and find space-saving opportunities. " +
            "Ask me anything!");
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
            await VM.SendMessageAsync();
        }
    }
}
