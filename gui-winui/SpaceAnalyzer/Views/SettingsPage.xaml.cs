// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class SettingsPage : Page
{
    public SettingsPage()
    {
        this.InitializeComponent();
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        var path = await UiHelper.PickFolderAsync();
        if (path != null)
        {
            ((ViewModels.SettingsViewModel)DataContext).ScannerPath = path;
        }
    }

    private void Save_Click(object sender, RoutedEventArgs e)
    {
        ((ViewModels.SettingsViewModel)DataContext).Save();
    }
}

