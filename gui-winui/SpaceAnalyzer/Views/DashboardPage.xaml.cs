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
    public DashboardViewModel VM { get; } = new();

    public DashboardPage()
    {
        this.InitializeComponent();
        this.Loaded += OnPageLoaded;
        VM.PropertyChanged += OnVmPropertyChanged;
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        VM.DispatcherTimer.Start();
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
        await VM.LoadDashboardAsync();
        DrawAllCharts();
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

    private static void DrawChart(Canvas canvas, System.Collections.Generic.List<double> values, SolidColorBrush brush)
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

    private async void Refresh_Click(object sender, RoutedEventArgs e)
    {
        await VM.LoadDashboardAsync();
        DrawAllCharts();
    }

    private void BtnNewScan_Click(object sender, RoutedEventArgs e)
    {
        if (Window.Current is MainWindow mw) mw.NavigateToPage("Scan");
    }
    private void BtnViewHistory_Click(object sender, RoutedEventArgs e)
    {
        if (Window.Current is MainWindow mw) mw.NavigateToPage("History");
    }
    private void BtnFindDuplicates_Click(object sender, RoutedEventArgs e)
    {
        if (Window.Current is MainWindow mw) mw.NavigateToPage("Dedup");
    }
    private void BtnAIAssistant_Click(object sender, RoutedEventArgs e)
    {
        if (Window.Current is MainWindow mw) mw.NavigateToPage("AIChat");
    }
    private void BtnCleanup_Click(object sender, RoutedEventArgs e)
    {
        if (Window.Current is MainWindow mw) mw.NavigateToPage("Cleanup");
    }
    private void BtnSystem_Click(object sender, RoutedEventArgs e)
    {
        if (Window.Current is MainWindow mw) mw.NavigateToPage("System");
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
