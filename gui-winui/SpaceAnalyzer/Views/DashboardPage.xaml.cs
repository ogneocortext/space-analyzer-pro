// Licensed under the MIT License.

using LiveChartsCore;
using LiveChartsCore.SkiaSharpView;
using LiveChartsCore.SkiaSharpView.Painting;
using LiveChartsCore.SkiaSharpView.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;
using SkiaSharp;

namespace SpaceAnalyzer.Views;

public sealed partial class DashboardPage : Page
{
    public DashboardViewModel VM { get; }
    private readonly AnimationTracker _animationTracker = new();

    private LineSeries<double>? _cpuSeries;
    private LineSeries<double>? _memSeries;
    private LineSeries<double>? _diskSeries;
    private CartesianChart? _cpuChart;
    private CartesianChart? _memChart;
    private CartesianChart? _diskChart;

    public DashboardPage()
    {
        InitializeComponent();
        VM = new DashboardViewModel();
        DataContext = VM;
        ViewModelRegistry.Register(VM);
        AppLog.Page("DashboardPage ctor end");
        Loaded += OnPageLoaded;
        SetupHoverEffects();
        Unloaded += (_, _) => _animationTracker.Dispose();
    }

    protected override void OnNavigatedTo(Microsoft.UI.Xaml.Navigation.NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        VM.DispatcherTimer.Start();
        VM.PropertyChanged += OnVmPropertyChanged;
        DrawAllCharts();
    }

    protected override void OnNavigatedFrom(Microsoft.UI.Xaml.Navigation.NavigationEventArgs e)
    {
        VM.DispatcherTimer.Stop();
        VM.PropertyChanged -= OnVmPropertyChanged;
        base.OnNavigatedFrom(e);
    }

    private async void OnPageLoaded(object sender, RoutedEventArgs e)
    {
        AppLog.Page("DashboardPage Loaded");
        await VM.LoadDashboardAsync();
        DrawAllCharts();
        await AnimateStatCards();
    }

    private void OnVmPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(DashboardViewModel.CpuHistory)
            or nameof(DashboardViewModel.MemoryHistory)
            or nameof(DashboardViewModel.DiskHistory))
        {
            UpdateSparklineValues();
        }
    }

    // ── Sparklines: create once, update values in-place ──

    private void DrawAllCharts()
    {
        CreateSparklineIfNeeded(CpuChartGrid, VM.CpuHistory, new SKColor(0, 120, 212),
            out _cpuChart, out _cpuSeries);
        CreateSparklineIfNeeded(MemChartGrid, VM.MemoryHistory, new SKColor(156, 39, 176),
            out _memChart, out _memSeries);
        CreateSparklineIfNeeded(DiskChartGrid, VM.DiskHistory, new SKColor(0, 150, 136),
            out _diskChart, out _diskSeries);
        UpdateSparklineValues();
        DrawDiskUsageDonut();
        DrawFileTypePie();
    }

    private static void CreateSparklineIfNeeded(
        Grid grid, IReadOnlyList<double> values, SKColor color,
        out CartesianChart chart, out LineSeries<double> series)
    {
        series = new LineSeries<double>
        {
            Values = values.ToArray(),
            Fill = new SolidColorPaint(new SKColor(color.Red, color.Green, color.Blue, 40)),
            Stroke = new SolidColorPaint(color) { StrokeThickness = 2 },
            GeometrySize = 0,
            LineSmoothness = 0.3,
            Name = "",
        };

        chart = new CartesianChart
        {
            Series = [series],
            Height = 72,
            XAxes = [new Axis { IsVisible = false }],
            YAxes =
            [
                new Axis
                {
                    IsVisible = false,
                    MinLimit = 0,
                    MaxLimit = 100,
                }
            ],
        };

        grid.Children.Clear();
        grid.Children.Add(chart);
    }

    private void UpdateSparklineValues()
    {
        if (_cpuSeries != null) _cpuSeries.Values = VM.CpuHistory.ToArray();
        if (_memSeries != null) _memSeries.Values = VM.MemoryHistory.ToArray();
        if (_diskSeries != null) _diskSeries.Values = VM.DiskHistory.ToArray();
    }

    // ── Donut charts: recreate only when data changes ──

    private void DrawDiskUsageDonut()
    {
        DiskUsageDonutGrid.Children.Clear();
        var volumes = VM.DiskVolumes;
        if (volumes == null || volumes.Count == 0)
        {
            DiskUsageDonutGrid.Children.Add(new TextBlock
            {
                Text = "No volume data",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 11,
                Opacity = 0.5
            });
            return;
        }

        var items = volumes.Select(v =>
        {
            var name = !string.IsNullOrWhiteSpace(v.Label) ? $"{v.Label} ({v.MountPoint.TrimEnd('\\')})" : v.MountPoint.TrimEnd('\\');
            var pct = v.UsagePercentDisplay;
            return ($"{name} · {pct}", (double)v.UsedBytes);
        }).ToList();
        var chart = LiveChartsFactory.CreateDonutChart(items);
        DiskUsageDonutGrid.Children.Add(chart);
    }

    private void DrawFileTypePie()
    {
        FileTypePieGrid.Children.Clear();
        var latestScan = VM.LatestScan;
        if (latestScan == null || latestScan.FileTypes == null || latestScan.FileTypes.Count == 0)
        {
            FileTypePieGrid.Children.Add(new TextBlock
            {
                Text = "Run a scan to see file types",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 11,
                Opacity = 0.5
            });
            return;
        }

        var top = latestScan.FileTypes
            .OrderByDescending(kv => kv.Value)
            .Take(8)
            .Select(kv => (Label: kv.Key, (double)kv.Value))
            .ToList();
        var chart = LiveChartsFactory.CreateDonutChart(top);
        FileTypePieGrid.Children.Add(chart);
    }

    private void SetupHoverEffects()
    {
        AnimationManager.SetupHoverEffects(_animationTracker,
            BtnNewScan, BtnViewHistory, BtnFindDuplicates, BtnAIAssistant, BtnCleanup, BtnSystem,
            BtnSmartSearch, BtnWorkflows, BtnSettings);
    }

    private async Task AnimateStatCards()
    {
        await AnimationManager.AnimateDashboardCardsAsync(
            StatCardTotalFiles, StatCardTotalSize, StatCardScanCount, StatCardDuplicateCount);
    }

    private async void Refresh_Click(object sender, RoutedEventArgs e)
    {
        await VM.LoadDashboardAsync();
        DrawAllCharts();
        await AnimateStatCards();
    }

    private void BtnNewScan_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("Dashboard BtnNewScan_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("Scan");
    }
    private void BtnViewHistory_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("Dashboard BtnViewHistory_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("History");
    }
    private void BtnFindDuplicates_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("Dashboard BtnFindDuplicates_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("Dedup");
    }
    private void BtnAIAssistant_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("Dashboard BtnAIAssistant_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("AIChat");
    }
    private void BtnCleanup_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("Dashboard BtnCleanup_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("Cleanup");
    }
    private void BtnSystem_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("Dashboard BtnSystem_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("System");
    }
    private void BtnSmartSearch_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("Dashboard BtnSmartSearch_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("SmartSearch");
    }
    private void BtnWorkflows_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("Dashboard BtnWorkflows_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("Workflows");
    }
    private void BtnSettings_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("Dashboard BtnSettings_Click");
        if (MainWindow.Current is not null) MainWindow.Current.NavigateToPage("Settings");
    }

    private async void QuickScanBrowse_Click(object sender, RoutedEventArgs e)
    {
        var path = await UiHelper.PickFolderAsync();
        if (path != null)
        {
            VM.QuickScanPath = path;
        }
    }

    private async void QuickScan_Click(object sender, RoutedEventArgs e)
    {
        await VM.QuickScanAsync();
    }
}
