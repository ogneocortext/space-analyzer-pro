// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace SpaceAnalyzer.Views;

public sealed partial class AIAssistantPage : Page
{
    public AIAssistantPage()
    {
        this.InitializeComponent();
    }

    private async void Send_Click(object sender, RoutedEventArgs e)
    {
        await VM.SendMessageAsync();
    }
}
