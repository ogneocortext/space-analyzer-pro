// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class DuplicatesPage : Page
{
    public DuplicatesViewModel VM { get; }

    public DuplicatesPage()
    {
        InitializeComponent();
        VM = new DuplicatesViewModel();
        DataContext = VM;
        ViewModelRegistry.Register(VM);
        AppLog.Page("DuplicatesPage ctor end");
        VM.PropertyChanged += OnVmPropertyChanged;
    }

    private void OnVmPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(DuplicatesViewModel.HasResult))
        {
            DrawCharts();
        }
    }

    private void DrawCharts()
    {
        DrawTopGroupsBar();
        DrawWastedSpaceDonut();
    }

    private void DrawTopGroupsBar()
    {
        TopGroupsBarChartGrid.Children.Clear();
        var groups = VM.DuplicateGroups;
        if (groups == null || groups.Count == 0)
        {
            TopGroupsBarChartGrid.Children.Add(new TextBlock
            {
                Text = "No data",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 11,
                Opacity = 0.5
            });
            return;
        }

        var top = groups
            .OrderByDescending(g => g.WastedBytes)
            .Take(8)
            .Select(g => (Label: $"Group {g.Hash[..8]}", Value: (double)g.WastedBytes, (string?)g.WastedDisplay))
            .ToList();
        var chart = LiveChartsFactory.CreateBarChart(top);
        TopGroupsBarChartGrid.Children.Add(chart);
    }

    private void DrawWastedSpaceDonut()
    {
        WastedSpaceDonutGrid.Children.Clear();
        var groups = VM.DuplicateGroups;
        if (groups == null || groups.Count == 0)
        {
            WastedSpaceDonutGrid.Children.Add(new TextBlock
            {
                Text = "No data",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 11,
                Opacity = 0.5
            });
            return;
        }

        var top = groups
            .OrderByDescending(g => g.WastedBytes)
            .Take(6)
            .Select(g => (Label: g.Hash[..12], Value: (double)g.WastedBytes))
            .ToList();
        var chart = LiveChartsFactory.CreateDonutChart(top);
        WastedSpaceDonutGrid.Children.Add(chart);
    }

    private async void Analyze_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage Analyze_Click");
        await VM.AnalyzeAsync();
    }

    private void Page_DragOver(object sender, DragEventArgs e)
    {
        e.AcceptedOperation = Windows.ApplicationModel.DataTransfer.DataPackageOperation.Copy;
        e.DragUIOverride.Caption = "Analyze this folder for duplicates";
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
        }
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage Browse_Click");
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
            AppLog.Error("DuplicatesPage Browse_Click failed", ex);
        }
    }

    private void OpenScanPath_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage OpenScanPath_Click");
        if (!string.IsNullOrWhiteSpace(VM.ScanPath) && System.IO.Directory.Exists(VM.ScanPath))
        {
            UiHelper.OpenPath(VM.ScanPath);
        }
    }

    private void OpenDuplicateFile_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage OpenDuplicateFile_Click");
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            UiHelper.OpenPath(path);
        }
    }

    private void OpenDuplicateFolder_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage OpenDuplicateFolder_Click");
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
