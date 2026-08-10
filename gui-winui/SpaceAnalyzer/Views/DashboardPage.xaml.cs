// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
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
    private LineSeries<double>? _gpuSeries;
    private LineSeries<double>? _cpuScanBand;
    private LineSeries<double>? _memScanBand;
    private LineSeries<double>? _diskScanBand;
    private LineSeries<double>? _gpuScanBand;
    private LineSeries<double>? _cpuThreshWarn;
    private LineSeries<double>? _cpuThreshCrit;
    private LineSeries<double>? _memThreshWarn;
    private LineSeries<double>? _memThreshCrit;
    private LineSeries<double>? _gpuThreshWarn;
    private LineSeries<double>? _gpuThreshCrit;
    private LineSeries<double>? _diskThreshWarn;
    private LineSeries<double>? _diskThreshCrit;
    private CartesianChart? _cpuChart;
    private CartesianChart? _memChart;
    private CartesianChart? _diskChart;
    private CartesianChart? _gpuChart;

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
        // Charts are (re)drawn once the dashboard data has loaded, in OnPageLoaded,
        // so drawing here (before data exists) is redundant work.
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
            or nameof(DashboardViewModel.DiskHistory)
            or nameof(DashboardViewModel.GpuHistory))
        {
            UpdateSparklineValues();
        }
    }

    // ── Sparklines: create once, update values in-place ──

    private void DrawAllCharts()
    {
        CreateSparklineIfNeeded(CpuChartGrid, VM.CpuHistory, VM.ScanBandValues, new SKColor(0, 120, 212),
            out _cpuChart, out _cpuSeries, out _cpuScanBand, out _cpuThreshWarn, out _cpuThreshCrit);
        CreateSparklineIfNeeded(MemChartGrid, VM.MemoryHistory, VM.ScanBandValues, new SKColor(156, 39, 176),
            out _memChart, out _memSeries, out _memScanBand, out _memThreshWarn, out _memThreshCrit);
        CreateSparklineIfNeeded(GpuChartGrid, VM.GpuHistory, VM.ScanBandValues, new SKColor(255, 152, 0),
            out _gpuChart, out _gpuSeries, out _gpuScanBand, out _gpuThreshWarn, out _gpuThreshCrit);
        CreateSparklineIfNeeded(DiskChartGrid, VM.DiskHistory, VM.ScanBandValues, new SKColor(0, 150, 136),
            out _diskChart, out _diskSeries, out _diskScanBand, out _diskThreshWarn, out _diskThreshCrit);
        UpdateSparklineValues();
        DrawDiskUsageDonut();
        DrawFileTypeBars();
    }

    private static void CreateSparklineIfNeeded(
        Grid grid, IReadOnlyList<double> values, IReadOnlyList<double> bandValues, SKColor color,
        out CartesianChart chart, out LineSeries<double> series, out LineSeries<double> band,
        out LineSeries<double> warn, out LineSeries<double> crit)
    {
        // Translucent band pinned at the top of the chart while the scanner is
        // running. Drawn behind the value line so the activity window reads as a
        // shaded column rather than noise.
        band = new LineSeries<double>
        {
            Values = bandValues.ToArray(),
            Fill = new SolidColorPaint(new SKColor(255, 196, 0, 38)),
            Stroke = new SolidColorPaint(new SKColor(255, 196, 0, 110)) { StrokeThickness = 1 },
            GeometrySize = 0,
            LineSmoothness = 0,
            Name = "",
            ZIndex = 0,
        };

        // Static threshold guides at 70% (warning) and 90% (critical). They are
        // sized to the full history window in UpdateSparklineValues so they span
        // the whole chart rather than just the first two samples.
        warn = MakeThresholdLine(70, new SKColor(232, 163, 61, 220));
        crit = MakeThresholdLine(90, new SKColor(214, 67, 43, 220));

        series = new LineSeries<double>
        {
            Values = values.ToArray(),
            Fill = new SolidColorPaint(new SKColor(color.Red, color.Green, color.Blue, 40)),
            Stroke = new SolidColorPaint(color) { StrokeThickness = 2 },
            GeometrySize = 0,
            LineSmoothness = 0.3,
            Name = "",
            ZIndex = 1,
        };

        chart = new CartesianChart
        {
            Series = [band, warn, crit, series],
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

    private static LineSeries<double> MakeThresholdLine(double level, SKColor color) => new()
    {
        Values = [level, level],
        Fill = null,
        Stroke = new SolidColorPaint(color) { StrokeThickness = 1 },
        GeometrySize = 0,
        LineSmoothness = 0,
        Name = "",
        ZIndex = 0,
        IsHoverable = false,
    };

    private static double[] ConstantArray(int n, double v)
    {
        var arr = new double[n];
        if (n > 0) Array.Fill(arr, v);
        return arr;
    }

    private void UpdateSparklineValues()
    {
        int len = VM.CpuHistory.Count;
        if (_cpuSeries != null) _cpuSeries.Values = VM.CpuHistory.ToArray();
        if (_memSeries != null) _memSeries.Values = VM.MemoryHistory.ToArray();
        if (_diskSeries != null) _diskSeries.Values = VM.DiskHistory.ToArray();
        if (_gpuSeries != null) _gpuSeries.Values = VM.GpuHistory.ToArray();
        if (_cpuScanBand != null) _cpuScanBand.Values = VM.ScanBandValues.ToArray();
        if (_memScanBand != null) _memScanBand.Values = VM.ScanBandValues.ToArray();
        if (_diskScanBand != null) _diskScanBand.Values = VM.ScanBandValues.ToArray();
        if (_gpuScanBand != null) _gpuScanBand.Values = VM.ScanBandValues.ToArray();
        if (_cpuThreshWarn != null) _cpuThreshWarn.Values = ConstantArray(len, 70);
        if (_cpuThreshCrit != null) _cpuThreshCrit.Values = ConstantArray(len, 90);
        if (_memThreshWarn != null) _memThreshWarn.Values = ConstantArray(len, 70);
        if (_memThreshCrit != null) _memThreshCrit.Values = ConstantArray(len, 90);
        if (_gpuThreshWarn != null) _gpuThreshWarn.Values = ConstantArray(len, 70);
        if (_gpuThreshCrit != null) _gpuThreshCrit.Values = ConstantArray(len, 90);
        if (_diskThreshWarn != null) _diskThreshWarn.Values = ConstantArray(len, 70);
        if (_diskThreshCrit != null) _diskThreshCrit.Values = ConstantArray(len, 90);
        UpdateChartAnnotations();
    }

    // ── Peak / avg annotations for the resource-history sparklines ──

    private static string FormatPeakAvg(IReadOnlyList<double> history)
    {
        if (history == null || history.Count == 0) return "";
        double peak = history.Max();
        double avg = history.Average();
        return $"Peak {peak:F0}%  ·  Avg {avg:F0}%";
    }

    private void UpdateChartAnnotations()
    {
        if (CpuPeakAvg != null) CpuPeakAvg.Text = FormatPeakAvg(VM.CpuHistory);
        if (MemPeakAvg != null) MemPeakAvg.Text = FormatPeakAvg(VM.MemoryHistory);
        if (GpuPeakAvg != null) GpuPeakAvg.Text = FormatPeakAvg(VM.GpuHistory);
        if (DiskPeakAvg != null) DiskPeakAvg.Text = FormatPeakAvg(VM.DiskHistory);
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
            return (Label: $"{name} · {pct}", Value: (double)v.UsedBytes, DrillKey: v.MountPoint);
        }).ToList();
        var chart = LiveChartsFactory.CreateDonutChart(items, key => DrillToVolumeScan(key));
        DiskUsageDonutGrid.Children.Add(chart);
    }

    private void DrawFileTypeBars()
    {
        FileTypeBarsGrid.Children.Clear();
        var latestScan = VM.LatestScan;
        if (latestScan == null || latestScan.FileTypes == null || latestScan.FileTypes.Count == 0)
        {
            FileTypeBarsGrid.Children.Add(new TextBlock
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
        var chart = LiveChartsFactory.CreateFileTypeBarChart(top, DrillToFileType);
        FileTypeBarsGrid.Children.Add(chart);
    }

    // ── Click-to-drill navigation from the storage-breakdown charts ──

    /// <summary>
    /// Tapping a file-type bar jumps to Smart Search pre-filled with that extension
    /// and the most-recent scan's path, so the user can drill straight into matches.
    /// </summary>
    private void DrillToFileType(string ext)
    {
        if (MainWindow.Current is null) return;
        var path = VM.LatestScan?.Path;
        MainWindow.Current.NavigateToPage("SmartSearch", new SmartSearchPreset(Query: ext, Path: path));
    }

    /// <summary>
    /// Tapping a disk-usage donut slice re-scans that volume.
    /// </summary>
    private void DrillToVolumeScan(string? mountPoint)
    {
        if (MainWindow.Current is null || string.IsNullOrEmpty(mountPoint)) return;
        MainWindow.Current.NavigateToPage("Scan", mountPoint);
    }

    private void SetupHoverEffects()
    {
        AnimationManager.SetupHoverEffects(_animationTracker,
            BtnNewScan, BtnViewHistory, BtnFindDuplicates, BtnAIAssistant, BtnCleanup,
            BtnSmartSearch, BtnWorkflows);
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
