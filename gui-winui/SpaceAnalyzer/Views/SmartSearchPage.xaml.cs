// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class SmartSearchPage : Page
{
    public SmartSearchViewModel VM { get; }

    public SmartSearchPage()
    {
        InitializeComponent();
        VM = new SmartSearchViewModel();
        DataContext = VM;
        AppLog.Page("SmartSearchPage ctor end");
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("SmartSearchPage Browse_Click");
        await VM.BrowseForPathAsync();
    }

    private void OpenSearchPath_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("SmartSearchPage OpenSearchPath_Click");
        if (!string.IsNullOrWhiteSpace(VM.SearchPath) && System.IO.Directory.Exists(VM.SearchPath))
        {
            UiHelper.OpenPath(VM.SearchPath);
        }
    }

    private async void Search_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("SmartSearchPage Search_Click");
        await VM.SearchAsync();
    }

    private void OpenResultFile_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("SmartSearchPage OpenResultFile_Click");
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            UiHelper.OpenPath(path);
        }
    }

    private void OpenResultFolder_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("SmartSearchPage OpenResultFolder_Click");
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
