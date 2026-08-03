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
            var status = VM.StatusMessage;
            if (VM.LastResult != null)
            {
                AppNotifications.Success("Scan complete", $"{VM.LastResult.TotalFiles:N0} files, {VM.LastResult.TotalSizeMb:F1} MB");
            }
            else if (status?.Contains("cancelled", StringComparison.OrdinalIgnoreCase) == true)
            {
                AppNotifications.Show("Scan cancelled", null, InfoBarSeverity.Warning);
            }
            else if (status?.StartsWith("Scan failed", StringComparison.Ordinal) == true)
            {
                AppNotifications.Error("Scan failed", status);
            }
            else if (!string.IsNullOrEmpty(status))
            {
                AppNotifications.Show("Scan", status);
            }
        }
    }

    // ── Drag & drop a folder onto the page to set the scan path ──

    private void Page_DragOver(object sender, DragEventArgs e)
    {
        e.AcceptedOperation = Windows.ApplicationModel.DataTransfer.DataPackageOperation.Copy;
        e.DragUIOverride.Caption = "Scan this folder";
        e.DragUIOverride.IsCaptionVisible = true;
    }

    private async void Page_Drop(object sender, DragEventArgs e)
    {
        if (!e.DataView.Contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.StorageItems))
            return;

        var items = await e.DataView.GetStorageItemsAsync();
        var folder = items.OfType<Windows.Storage.StorageFolder>().FirstOrDefault();
        if (folder != null)
        {
            VM.ScanPath = folder.Path;
            AppNotifications.Success("Scan path set", folder.Path);
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
                var saved = await VM.ExportResultsAsync(file.Path);
                AppNotifications.Success("Export saved", saved);
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
