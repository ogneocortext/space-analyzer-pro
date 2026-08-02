// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class SettingsPage : Page
{
    public SettingsViewModel VM { get; }

    public SettingsPage()
    {
        InitializeComponent();
        VM = new SettingsViewModel();
        DataContext = VM;
        AppLog.Page("SettingsPage ctor end");
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        var path = await UiHelper.PickFolderAsync();
        if (path != null)
        {
            VM.ScannerPath = path;
        }
    }

    private void OpenScannerFolder_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrWhiteSpace(VM.ScannerPath))
        {
            var folder = System.IO.Path.GetDirectoryName(VM.ScannerPath);
            if (!string.IsNullOrEmpty(folder) && System.IO.Directory.Exists(folder))
            {
                UiHelper.OpenPath(folder);
            }
        }
    }

    private void Save_Click(object sender, RoutedEventArgs e)
    {
        VM.Save();
    }

    private async void TestOllama_Click(object sender, RoutedEventArgs e)
    {
        await VM.TestOllamaConnectionAsync();
    }

    private void Reset_Click(object sender, RoutedEventArgs e)
    {
        VM.ResetToDefaults();
    }
}
