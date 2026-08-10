// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Navigation;
using SpaceAnalyzer.Controls;
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
        ViewModelRegistry.Register(VM);
        AppLog.Page("HistoryPage ctor end");
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        AppLog.Page("HistoryPage OnNavigatedTo");
        // (Re)subscribe here rather than in the ctor: the page is cached
        // (NavigationCacheMode=Required), so the ctor runs once but OnNavigatedFrom
        // unsubscribes. Subscribing on every navigation keeps the trend chart in sync.
        VM.PropertyChanged += OnVmPropertyChanged;
        _ = ReloadCurrentPageAsync();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        VM.PropertyChanged -= OnVmPropertyChanged;
        base.OnNavigatedFrom(e);
    }

    private async void HistoryPage_Loaded(object sender, RoutedEventArgs e)
    {
        AppLog.Page("HistoryPage Loaded");
        await ReloadCurrentPageAsync();
    }

    /// <summary>
    /// Reloads history so newly added scans appear even though the page is cached.
    /// Preserves the current page when history already exists.
    /// </summary>
    private async Task ReloadCurrentPageAsync()
    {
        // OnNavigatedTo and Loaded both invoke this on first visit; skip the overlap
        // so only one LoadPageAsync (one scanner subprocess) runs.
        if (VM.IsLoading) return;
        if (!VM.HasHistory)
        {
            AppLog.Page("HistoryPage ReloadCurrentPageAsync loading");
            await VM.LoadHistoryAsync();
            return;
        }
        await VM.LoadPageAsync();
    }

    private void OnVmPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(HistoryViewModel.History))
        {
            DrawTrendChart();
        }
    }

    private void DrawTrendChart()
    {
        TrendChartGrid.Children.Clear();
        var history = VM.History;
        if (history == null || history.Count < 2)
        {
            TrendChartGrid.Children.Add(new TextBlock
            {
                Text = "Need at least 2 scans to show trend",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 11,
                Opacity = 0.5
            });
            return;
        }

        var sorted = history.OrderBy(h => h.ScanDate).ToList();
        var items = sorted.Select(h => (h.DateDisplay, (double)h.TotalSizeBytes)).ToList();
        var chart = LiveChartsFactory.CreateSparkline(items);
        TrendChartGrid.Children.Add(chart);
    }

    // ── Pagination ──

    private async void PrevPage_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage PrevPage_Click");
        await VM.PreviousPageAsync();
    }

    private async void NextPage_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage NextPage_Click");
        await VM.NextPageAsync();
    }

    // ── Search ──

    private async void Search_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage Search_Click");
        await VM.SearchAsync();
    }

    private void ClearSearch_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage ClearSearch_Click");
        VM.ClearSearch();
    }

    private async void SearchBox_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == Windows.System.VirtualKey.Enter)
        {
            e.Handled = true;
            await VM.SearchAsync();
        }
    }

    // ── Sort ──

    private void SortDate_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage SortDate_Click");
        VM.ToggleSort("timestamp");
    }

    private void SortSize_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage SortSize_Click");
        VM.ToggleSort("total_size_bytes");
    }

    private void SortFiles_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage SortFiles_Click");
        VM.ToggleSort("total_files");
    }

    // ── Multi-select comparison ──

    private void CompareCheck_Changed(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage CompareCheck_Changed");
        VM.NotifyCompareSelectionChanged();
    }

    private void CompareCheck_Tapped(object sender, TappedRoutedEventArgs e)
    {
        // Stop the tap from bubbling to the card Border (which opens details).
        e.Handled = true;
    }

    private void Compare_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage Compare_Click");
        VM.OpenComparison();
    }

    private void ClearComparison_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage ClearComparison_Click");
        VM.ClearComparison();
    }

    // ── Navigation ──

    private async void Refresh_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage Refresh_Click");
        await VM.LoadHistoryAsync();
    }

    private void NewScan_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage NewScan_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("Scan");
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
        dialog.XamlRoot = this.XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        await VM.DeleteHistoryAsync(id);
    }

    private async void DeleteDuplicates_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage DeleteDuplicates_Click");
        var dialog = new ContentDialog
        {
            Title = "Delete duplicate scans",
            Content = "Remove duplicate scan records, keeping only the newest entry for each directory? This cannot be undone.",
            PrimaryButtonText = "Delete Duplicates",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close
        };
        dialog.XamlRoot = this.XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        await VM.PruneDuplicateScansAsync();
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
        VM.BackToList();
    }

    private void Escape_Invoked(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        if (VM.HasSelectedRecord)
        {
            args.Handled = true;
            VM.BackToList();
        }
    }

    private void CopyPath_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage CopyPath_Click");
        if (sender is not Button { Tag: string path } || string.IsNullOrEmpty(path))
            return;

        var data = new Windows.ApplicationModel.DataTransfer.DataPackage();
        data.SetText(path);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(data);
        AppNotifications.Success("Path copied", path);
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

    // ── File Explorer ──

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
            VM.ToggleFileSort(col);
        }
    }

    private void FileNameHeader_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage FileNameHeader_Click");
        if (sender is Button button && button.Tag is string tag && int.TryParse(tag, out var col))
        {
            VM.ToggleFileSort(col);
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
