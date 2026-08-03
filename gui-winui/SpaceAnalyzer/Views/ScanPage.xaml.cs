// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class ScanPage : Page
{
    public ScanViewModel VM { get; }

    public ScanPage()
    {
        InitializeComponent();
        VM = new ScanViewModel();
        DataContext = VM;
        ViewModelRegistry.Register(VM);
        AppLog.Page("ScanPage ctor end");
    }

    protected override void OnNavigatedTo(Microsoft.UI.Xaml.Navigation.NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        AppLog.Page("ScanPage OnNavigatedTo");
        if (e.Parameter is string path && !string.IsNullOrWhiteSpace(path) && System.IO.Directory.Exists(path))
        {
            VM.ScanPath = path;
            AppLog.Action($"ScanPage OnNavigatedTo param path={path}");
        }
    }

    private async void Scan_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanPage Scan_Click");
        if (VM.IsScanning)
        {
            VM.StopScan();
        }
        else
        {
            await VM.ScanAsync();
        }
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanPage Browse_Click");
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
            AppLog.Error("ScanPage Browse_Click failed", ex);
        }
    }

    private void OpenScanFolder_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanPage OpenScanFolder_Click");
        if (!string.IsNullOrWhiteSpace(VM.ScanPath) && System.IO.Directory.Exists(VM.ScanPath))
        {
            UiHelper.OpenPath(VM.ScanPath);
        }
    }

    private async void Export_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanPage Export_Click");
        try
        {
            var picker = new Windows.Storage.Pickers.FileSavePicker();
            picker.SuggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.DocumentsLibrary;
            picker.SuggestedFileName = $"scan-{DateTime.Now:yyyy-MM-dd-HHmmss}.json";
            picker.FileTypeChoices.Add("JSON", new[] { ".json" });

            var window = MainWindow.Current as Window;
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
            AppLog.Error("ScanPage Export_Click failed", ex);
        }
    }

    private void DepthRadio_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanPage DepthRadio_Click");
        if (sender is not RadioButton rb) return;

        VM.SelectedDepthMode = rb.Tag?.ToString() switch
        {
            "Quick"   => ScannerService.DepthMode.Shallow,
            "Default" => ScannerService.DepthMode.Default,
            "Deep"    => ScannerService.DepthMode.Deep,
            _         => VM.SelectedDepthMode
        };
    }

    private void ClearFilter_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanPage ClearFilter_Click");
        VM.LargestFilesFilter = string.Empty;
    }

    private void OpenFile_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanPage OpenFile_Click");
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            UiHelper.OpenPath(path);
        }
    }

    private void OpenFolder_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanPage OpenFolder_Click");
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
