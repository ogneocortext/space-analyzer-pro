// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Navigation;
using SpaceAnalyzer.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.ViewModels;
using System.Linq;
using System.Text;
using WinRT.Interop;

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
        UpdateComparisonMetricButtons();
        AppLog.Page("HistoryPage ctor end");
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        AppLog.Page("HistoryPage OnNavigatedTo");
        VM.PropertyChanged += OnVmPropertyChanged;
        if (e.Parameter is long id)
        {
            _ = VM.SelectRecordByIdAsync(id);
        }
        else
        {
            VM.BackToList();
        }
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
        if (VM.IsLoading) return;
        if (!VM.HasHistory)
        {
            AppLog.Page("HistoryPage ReloadCurrentPageAsync loading");
            await VM.LoadHistoryAsync();
        }
        else
        {
            await VM.LoadPageAsync();
            await VM.LoadTrendAsync();
            await VM.LoadCategoryHistoryAsync();
            VM.ClearComparison();
        }
        await VM.LoadDatabaseInfoAsync();
    }

    private void OnVmPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(HistoryViewModel.History)
            or nameof(HistoryViewModel.TrendRecords))
        {
            DrawTrendChart();
        }
        if (e.PropertyName is nameof(HistoryViewModel.CategoryHistory))
        {
            DrawCategoryDonut();
        }
        if (e.PropertyName is nameof(HistoryViewModel.Comparisons)
            or nameof(HistoryViewModel.ShowComparison)
            or nameof(HistoryViewModel.HasComparisonVisibility))
        {
            DrawComparisonChart();
        }
    }

    private void DrawTrendChart()
    {
        TrendChartGrid.Children.Clear();
        var trend = VM.TrendRecords;
        if (trend == null || trend.Count < 2)
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

        var sorted = trend.OrderBy(t => t.Timestamp).ToList();
        var items = sorted.Select(t => (FormatTrendLabel(t.Timestamp), (double)t.TotalSizeBytes)).ToList();
        var chart = LiveChartsFactory.CreateSparkline(items);
        TrendChartGrid.Children.Add(chart);
    }

    private static string FormatTrendLabel(string timestamp)
    {
        if (DateTime.TryParse(timestamp, out var dt))
            return dt.ToString("MMM d");
        return timestamp;
    }

    private void DrawCategoryDonut()
    {
        CategoryDonutGrid.Children.Clear();
        var cats = VM.CategoryHistory;
        if (cats == null || cats.Count == 0)
        {
            CategoryDonutGrid.Children.Add(new TextBlock
            {
                Text = "No category data yet",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 11,
                Opacity = 0.5
            });
            return;
        }

        var items = cats.Select(c => (c.Category, (double)c.Size, c.Category)).ToList();
        CategoryDonutGrid.Children.Add(LiveChartsFactory.CreateDonutChart(items, onDrillKeyClick: OnCategoryDrill));
    }

    private void OnCategoryDrill(string category)
    {
        AppLog.Action($"HistoryPage CategoryDrill category={category}");
        var latest = VM.TrendRecords
            .OrderByDescending(t => t.Timestamp)
            .FirstOrDefault();
        var path = latest?.Path;
        if (MainWindow.Current is not null)
            MainWindow.Current.NavigateToPage("SmartSearch", new SmartSearchPreset(Path: path, Category: category));
    }

    private async void ExportTrend_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage ExportTrend_Click");
        try
        {
            var trend = VM.TrendRecords;
            if (trend == null || trend.Count == 0)
            {
                AppNotifications.Show("Nothing to export", "Run at least one scan to build a trend.");
                return;
            }

            var picker = new Windows.Storage.Pickers.FileSavePicker();
            picker.SuggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.DocumentsLibrary;
            picker.SuggestedFileName = $"size-trend-{DateTime.Now:yyyy-MM-dd}";
            picker.FileTypeChoices.Add("CSV", new[] { ".csv" });

            var window = MainWindow.Current as Window;
            var hwnd = WindowNative.GetWindowHandle(window);
            InitializeWithWindow.Initialize(picker, hwnd);

            var file = await picker.PickSaveFileAsync();
            if (file == null) return;

            var sb = new StringBuilder();
            sb.AppendLine("id,path,timestamp,total_size_bytes");
            foreach (var t in trend.OrderBy(t => t.Timestamp))
                sb.AppendLine($"{t.Id},\"{t.Path}\",{t.Timestamp},{t.TotalSizeBytes}");

            await Windows.Storage.FileIO.WriteTextAsync(file, sb.ToString());
            AppNotifications.Success("Trend exported", file.Path);
        }
        catch (Exception ex)
        {
            AppLog.Error("HistoryPage ExportTrend_Click failed", ex);
        }
    }

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

    private void SortDuplicates_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage SortDuplicates_Click");
        VM.ToggleSort("duplicate");
    }

    private void DuplicatesOnly_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage DuplicatesOnly_Click");
        VM.ToggleOnlyDuplicates();
    }

    private void CompareCheck_Changed(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage CompareCheck_Changed");
        VM.NotifyCompareSelectionChanged();
    }

    private void CompareCheck_Tapped(object sender, TappedRoutedEventArgs e)
    {
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

    private enum ComparisonMetric { Size, Files, Duration }
    private ComparisonMetric _comparisonMetric = ComparisonMetric.Size;

    private void CompareMetric_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage CompareMetric_Click");
        if (sender is not Button button || button.Tag is not string tag)
            return;
        _comparisonMetric = tag switch
        {
            "Files" => ComparisonMetric.Files,
            "Duration" => ComparisonMetric.Duration,
            _ => ComparisonMetric.Size
        };
        UpdateComparisonMetricButtons();
        DrawComparisonChart();
    }

    private void UpdateComparisonMetricButtons()
    {
        var active = (Brush)Application.Current.Resources["AccentTextFillColorPrimaryBrush"];
        var normal = (Brush)Application.Current.Resources["TextFillColorPrimaryBrush"];
        CompareMetricSize.Foreground = _comparisonMetric == ComparisonMetric.Size ? active : normal;
        CompareMetricFiles.Foreground = _comparisonMetric == ComparisonMetric.Files ? active : normal;
        CompareMetricDuration.Foreground = _comparisonMetric == ComparisonMetric.Duration ? active : normal;
        CompareMetricSize.FontWeight = _comparisonMetric == ComparisonMetric.Size ? Microsoft.UI.Text.FontWeights.SemiBold : Microsoft.UI.Text.FontWeights.Normal;
        CompareMetricFiles.FontWeight = _comparisonMetric == ComparisonMetric.Files ? Microsoft.UI.Text.FontWeights.SemiBold : Microsoft.UI.Text.FontWeights.Normal;
        CompareMetricDuration.FontWeight = _comparisonMetric == ComparisonMetric.Duration ? Microsoft.UI.Text.FontWeights.SemiBold : Microsoft.UI.Text.FontWeights.Normal;
    }

    private void DrawComparisonChart()
    {
        ComparisonChartGrid.Children.Clear();
        var cards = VM.Comparisons;
        if (cards == null || cards.Count < 1)
        {
            ComparisonChartGrid.Children.Add(new TextBlock
            {
                Text = "Select at least two scans to compare",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 11,
                Opacity = 0.5
            });
            return;
        }

        Func<double, string> yLabeler;
        switch (_comparisonMetric)
        {
            case ComparisonMetric.Files:
                yLabeler = v => v.ToString("N0");
                break;
            case ComparisonMetric.Duration:
                yLabeler = v => v.ToString("F1") + "s";
                break;
            default:
                yLabeler = v => ByteFormatter.FormatBytes((ulong)v);
                break;
        }

        var items = cards.Select((c, i) =>
        {
            double value = _comparisonMetric switch
            {
                ComparisonMetric.Files => c.Record.TotalFiles,
                ComparisonMetric.Duration => c.Record.DurationSecs,
                _ => (double)c.Record.TotalSizeBytes
            };
            string display = _comparisonMetric switch
            {
                ComparisonMetric.Files => $"{c.Record.TotalFiles:N0} files",
                ComparisonMetric.Duration => $"{c.Record.DurationSecs:F1}s",
                _ => ByteFormatter.FormatBytes(c.Record.TotalSizeBytes)
            };
            return ((i + 1).ToString(), value, (string?)display);
        }).ToList();

        ComparisonChartGrid.Children.Add(LiveChartsFactory.CreateBarChart(items, yLabeler: yLabeler, onIndexClick: idx =>
        {
            if (idx >= 0 && idx < cards.Count)
                _ = VM.LoadDetailsAsync(cards[idx].Record);
        }));
    }

    private void Refresh_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage Refresh_Click");
        _ = VM.LoadHistoryAsync();
    }

    private void NewScan_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage NewScan_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("Scan");
    }

    private void ToggleView_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("HistoryPage ToggleView_Click");
        VM.IsGroupedView = !VM.IsGroupedView;
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

    private void Escape_Invoked(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        if (VM.HasSelectedRecord)
        {
            args.Handled = true;
            VM.BackToList();
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
