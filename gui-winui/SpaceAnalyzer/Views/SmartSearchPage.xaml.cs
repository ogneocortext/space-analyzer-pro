// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;
using System;

namespace SpaceAnalyzer.Views;

public sealed partial class SmartSearchPage : Page
{
    public SmartSearchViewModel VM { get; }

    public SmartSearchPage()
    {
        InitializeComponent();
        VM = new SmartSearchViewModel();
        DataContext = VM;
        ViewModelRegistry.Register(VM);
        AppLog.Page("SmartSearchPage ctor end");
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        if (e.Parameter is SmartSearchPreset preset)
        {
            if (!string.IsNullOrWhiteSpace(preset.Query)) VM.SearchQuery = preset.Query;
            if (!string.IsNullOrWhiteSpace(preset.Path)) VM.SearchPath = preset.Path;

            if (!string.IsNullOrWhiteSpace(preset.Category))
            {
                // Drill from the Library Composition donut: map the chosen category
                // to its known extensions and run an OR-wildcard search so the user
                // lands on the actual files. The matcher's '|' OR and the VM's own
                // guards do the rest; if the category has no mapped extensions we
                // simply no-op rather than searching blindly.
                var exts = FileCategory.ExtensionsForCategory(preset.Category);
                if (exts.Count > 0)
                {
                    VM.SearchQuery = string.Join("|", exts.Select(ext => "*" + ext));
                    VM.UseWildcards = true;
                    if (string.IsNullOrWhiteSpace(VM.SearchPath))
                        VM.SearchPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                    _ = VM.SearchAsync();
                }
            }
            else if (!string.IsNullOrWhiteSpace(VM.SearchQuery) && !string.IsNullOrWhiteSpace(VM.SearchPath))
            {
                // Complete the file-type drill: run the search so the user lands on
                // matches rather than an empty results grid.
                _ = VM.SearchAsync();
            }
        }
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

    private async void Index_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("SmartSearchPage Index_Click");
        await VM.IndexAsync();
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
