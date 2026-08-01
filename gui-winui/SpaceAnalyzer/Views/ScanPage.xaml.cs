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

    private async void Stop_Click(object sender, RoutedEventArgs e)
    {
        VM.StopScan();
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

    private async void Export_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var picker = new Windows.Storage.Pickers.FileSavePicker();
            picker.SuggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.DocumentsLibrary;
            picker.SuggestedFileName = $"scan-{DateTime.Now:yyyy-MM-dd-HHmmss}.json";
            picker.FileTypeChoices.Add("JSON", new[] { ".json" });

            var window = Microsoft.UI.Xaml.Window.Current;
            var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(window);
            WinRT.Interop.InitializeWithWindow.Initialize(picker, hwnd);

            var file = await picker.PickSaveFileAsync();
            if (file != null)
            {
                await VM.ExportResultsAsync(file.Path);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ScanPage] Export failed: {ex}");
        }
    }

    private void ClearFilter_Click(object sender, RoutedEventArgs e)
    {
        VM.LargestFilesFilter = string.Empty;
    }

    private void OpenFile_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            UiHelper.OpenPath(path);
        }
    }

    private void OpenFolder_Click(object sender, RoutedEventArgs e)
    {
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
