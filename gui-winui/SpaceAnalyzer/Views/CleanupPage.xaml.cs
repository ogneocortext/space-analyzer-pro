// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class CleanupPage : Page
{
    public CleanupViewModel VM { get; }

    public CleanupPage()
    {
        InitializeComponent();
        VM = new CleanupViewModel();
        DataContext = VM;
        AppLog.Page("CleanupPage ctor end");
    }

    private async void Analyze_Click(object sender, RoutedEventArgs e)
    {
        if (VM.PerformCleanup)
        {
            var dialog = new ContentDialog
            {
                Title = "Confirm cleanup",
                Content = "This will delete files and directories. Are you sure you want to proceed?",
                PrimaryButtonText = "Delete",
                CloseButtonText = "Cancel",
                DefaultButton = ContentDialogButton.Close
            };
            if (dialog.XamlRoot != null)
                dialog.XamlRoot = this.XamlRoot;
            if (await dialog.ShowAsync() != ContentDialogResult.Primary)
                return;
        }

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

    private void OpenCandidateFolder_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            UiHelper.OpenPath(path);
        }
    }
}
