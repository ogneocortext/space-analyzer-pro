// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Navigation;
using Microsoft.UI.Xaml.Shapes;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class DashboardPage : Page
{
    public DashboardViewModel VM { get; }

    public DashboardPage()
    {
        InitializeComponent();
        VM = new DashboardViewModel();
        DataContext = VM;
        AppLog.Page("DashboardPage ctor end");
        Loaded += OnPageLoaded;
        VM.PropertyChanged += OnVmPropertyChanged;
        SetupHoverEffects();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        VM.DispatcherTimer.Start();
        VM.PropertyChanged += OnVmPropertyChanged;
        DrawAllCharts();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
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
            DrawAllCharts();
        }
    }

    private void DrawAllCharts()
    {
        DrawChart(CpuChart, VM.CpuHistory, VM.CpuBrush);
        DrawChart(MemChart, VM.MemoryHistory, VM.MemoryBrush);
        DrawChart(DiskChart, VM.DiskHistory, VM.DiskBrush);
    }

    private static void DrawChart(Canvas canvas, System.Collections.Generic.IReadOnlyList<double> values, SolidColorBrush brush)
    {
        canvas.Children.Clear();
        if (values.Count < 2 || canvas.ActualWidth <= 0 || canvas.ActualHeight <= 0)
            return;

        double maxVal = values.Max();
        if (maxVal <= 0) maxVal = 1;

        double width = canvas.ActualWidth;
        double height = canvas.ActualHeight;
        double xStep = width / (values.Count - 1);
        double padding = 2;

        for (int i = 0; i < values.Count - 1; i++)
        {
            double y1 = height - padding - (values[i] / maxVal) * (height - padding * 2);
            double y2 = height - padding - (values[i + 1] / maxVal) * (height - padding * 2);

            var line = new Line
            {
                X1 = i * xStep,
                Y1 = y1,
                X2 = (i + 1) * xStep,
                Y2 = y2,
                Stroke = brush,
                StrokeThickness = 2,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round,
            };
            canvas.Children.Add(line);
        }
    }

    private void SetupHoverEffects()
    {
        var hoverElements = new List<FrameworkElement>
        {
            BtnNewScan, BtnViewHistory, BtnFindDuplicates, BtnAIAssistant, BtnCleanup, BtnSystem,
            BtnSmartSearch, BtnWorkflows, BtnSettings
        };
        foreach (var el in hoverElements)
            CompositionHelpers.AddHoverFade(el, hoverOpacity: 0.90f, durationMs: 100);
    }

    private async Task AnimateStatCards()
    {
        var statCards = new[] { StatCardTotalFiles, StatCardTotalSize, StatCardScanCount, StatCardDuplicateCount };
        await CompositionHelpers.StaggeredFadeInAsync(statCards, durationMs: 200, staggerMs: 40);
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
