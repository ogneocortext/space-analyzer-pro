// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class WorkflowsPage : Page
{
    public WorkflowsPage()
    {
        this.InitializeComponent();
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
            System.Diagnostics.Debug.WriteLine($"[WorkflowsPage] Browse failed: {ex}");
        }
    }

    private async void Run_Click(object sender, RoutedEventArgs e)
    {
        await VM.RunAsync();
    }
}
