// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class DuplicatesPage : Page
{
    public DuplicatesViewModel VM { get; }

    public DuplicatesPage()
    {
        InitializeComponent();
        VM = new DuplicatesViewModel();
        DataContext = VM;
        AppLog.Page("DuplicatesPage ctor end");
    }

    private async void Analyze_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage Analyze_Click");
        await VM.AnalyzeAsync();
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage Browse_Click");
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
            AppLog.Error("DuplicatesPage Browse_Click failed", ex);
        }
    }

    private void OpenScanPath_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage OpenScanPath_Click");
        if (!string.IsNullOrWhiteSpace(VM.ScanPath) && System.IO.Directory.Exists(VM.ScanPath))
        {
            UiHelper.OpenPath(VM.ScanPath);
        }
    }

    private void OpenDuplicateFile_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage OpenDuplicateFile_Click");
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            UiHelper.OpenPath(path);
        }
    }

    private void OpenDuplicateFolder_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage OpenDuplicateFolder_Click");
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            var parent = System.IO.Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(parent))
            {
                UiHelper.OpenPath(parent);
            }
        }
    }
}
