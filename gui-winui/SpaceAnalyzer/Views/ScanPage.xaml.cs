// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class ScanPage : Page
{
    public ScanPage()
    {
        this.InitializeComponent();
    }

    private async void Scan_Click(object sender, RoutedEventArgs e)
    {
        await VM.ScanAsync();
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var path = await UiHelper.PickFolderAsync();
            if (path != null)
            {
                VM.ScanPath = path;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ScanPage] Browse failed: {ex}");
        }
    }
}
