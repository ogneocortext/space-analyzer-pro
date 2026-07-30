using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace SpaceAnalyzer.Views;

public sealed partial class HistoryPage : Page
{
    public HistoryPage()
    {
        this.InitializeComponent();
    }

    private async void Refresh_Click(object sender, RoutedEventArgs e)
    {
        await VM.LoadHistoryAsync();
    }
}
