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
        AppLog.Action("SettingsPage Browse_Click");
        var path = await UiHelper.PickFileAsync(".exe");
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
        AppLog.Action("SettingsPage Save_Click");
        VM.Save();
        AppNotifications.Success("Settings saved");
    }

    private async void TestOllama_Click(object sender, RoutedEventArgs e)
    {
        await VM.TestOllamaConnectionAsync();
    }

    private async void Reset_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("SettingsPage Reset_Click");
        var dialog = new ContentDialog
        {
            Title = "Reset settings",
            Content = "Reset all settings to their default values? This cannot be undone.",
            PrimaryButtonText = "Reset",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close,
        };
        dialog.XamlRoot = XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        VM.ResetToDefaults();
        AppNotifications.Success("Settings reset", "All settings restored to defaults");
    }
}
