// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace SpaceAnalyzer.Views;

public sealed partial class SmartSearchPage : Page
{
    public SmartSearchPage()
    {
        this.InitializeComponent();
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        await VM.BrowseForPathAsync();
    }

    private async void Search_Click(object sender, RoutedEventArgs e)
    {
        await VM.SearchAsync();
    }
}
