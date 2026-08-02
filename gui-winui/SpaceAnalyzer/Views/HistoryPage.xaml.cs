// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Navigation;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.ViewModels;
using System.Linq;

namespace SpaceAnalyzer.Views;

public sealed partial class HistoryPage : Page
{
    public HistoryViewModel VM { get; }

    public HistoryPage()
    {
        InitializeComponent();
        VM = new HistoryViewModel();
        DataContext = VM;
        AppLog.Page("HistoryPage ctor end");
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        AppLog.Page("HistoryPage OnNavigatedTo");
        _ = RefreshIfNeededAsync();
    }

    private async void HistoryPage_Loaded(object sender, RoutedEventArgs e)
    {
        AppLog.Page("HistoryPage Loaded");
        await RefreshIfNeededAsync();
    }

    private async Task RefreshIfNeededAsync()
    {
        if (!VM.HasHistory)
        {
            AppLog.Page("HistoryPage RefreshIfNeededAsync loading");
            await VM.LoadHistoryAsync();
        }
    }

    private async void Refresh_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage Refresh_Click");
        await VM.LoadHistoryAsync();
    }

    private void NewScan_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage NewScan_Click");
        if (Window.Current is MainWindow mw) mw.NavigateToPage("Scan");
    }

    private void Rescan_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage Rescan_Click");
        if (sender is not Button button || button.Tag is not string path || string.IsNullOrWhiteSpace(path))
            return;

        AppLog.Action($"HistoryPage Rescan_Click path={path}");
        if (MainWindow.Current is not null)
        {
            MainWindow.Current.NavigateToPage("Scan", path);
        }
    }

    private async void Delete_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage Delete_Click");
        if (sender is not Button button || button.Tag is not long id)
            return;

        var record = VM.History.FirstOrDefault(r => r.Id == id);
        var path = record?.Path ?? id.ToString();

        var dialog = new ContentDialog
        {
            Title = "Delete scan record",
            Content = $"Delete the scan record for \"{path}\"? This cannot be undone.",
            PrimaryButtonText = "Delete",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close
        };
        if (dialog.XamlRoot != null)
            dialog.XamlRoot = this.XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        await VM.DeleteHistoryAsync(id);
    }

    private async void ViewDetails_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage ViewDetails_Click");
        if (sender is not Button button || button.Tag is not long id)
            return;

        var record = VM.History.FirstOrDefault(r => r.Id == id);
        if (record != null)
        {
            await VM.LoadDetailsAsync(record);
        }
    }

    private void BackToList_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage BackToList_Click");
        VM.SelectedRecord = null;
    }

    private async void ScanCard_Tapped(object sender, TappedRoutedEventArgs e)
    {
        if (sender is not Border border || border.Tag is not long id)
            return;

        AppLog.Action($"HistoryPage ScanCard_Tapped Id={id}");
        var record = VM.History.FirstOrDefault(r => r.Id == id);
        if (record != null)
        {
            await VM.LoadDetailsAsync(record);
        }
    }

    private void ClearFileExplorerFilter_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage ClearFileExplorerFilter_Click");
        VM.FileExplorerFilter = string.Empty;
    }

    private void FileSizeHeader_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage FileSizeHeader_Click");
        if (sender is Button button && button.Tag is string tag && int.TryParse(tag, out var col))
        {
            VM.ToggleSort(col);
        }
    }

    private void FileNameHeader_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage FileNameHeader_Click");
        if (sender is Button button && button.Tag is string tag && int.TryParse(tag, out var col))
        {
            VM.ToggleSort(col);
        }
    }

    private void OpenFile_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage OpenFile_Click");
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            UiHelper.OpenPath(path);
        }
    }

    private void OpenFolder_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage OpenFolder_Click");
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            UiHelper.OpenPath(path);
        }
    }
}
