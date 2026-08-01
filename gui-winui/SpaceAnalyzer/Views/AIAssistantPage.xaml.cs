// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class AIAssistantPage : Page
{
    public AIAssistantPage()
    {
        this.InitializeComponent();
        MessageScroll.SizeChanged += (_, _) => ScrollToBottom();
        VM.Messages.CollectionChanged += (_, _) => ScrollToBottom();
    }

    private void ScrollToBottom()
    {
        MessageScroll.ChangeView(null, MessageScroll.ScrollableHeight, null);
    }

    private void Input_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == Windows.System.VirtualKey.Enter)
        {
            e.Handled = true;
            _ = VM.SendMessageAsync();
        }
    }

    private async void Send_Click(object sender, RoutedEventArgs e)
    {
        await VM.SendMessageAsync();
    }
}
