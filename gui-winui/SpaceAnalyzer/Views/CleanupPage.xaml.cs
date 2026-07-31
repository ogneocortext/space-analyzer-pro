using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class CleanupPage : Page
{
    public CleanupPage()
    {
        this.InitializeComponent();
    }

    private async void Analyze_Click(object sender, RoutedEventArgs e)
    {
        await VM.AnalyzeAsync();
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var path = await UiHelper.PickFolderAsync();
            if (path != null)
            {
                VM.TargetPath = path;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CleanupPage] Browse failed: {ex}");
        }
    }
}
