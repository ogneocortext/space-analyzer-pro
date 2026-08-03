// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class CleanupPage : Page
{
    public CleanupViewModel VM { get; }

    public CleanupPage()
    {
        InitializeComponent();
        VM = new CleanupViewModel();
        DataContext = VM;
        ViewModelRegistry.Register(VM);
        AppLog.Page("CleanupPage ctor end");
        VM.PropertyChanged += OnVmPropertyChanged;
    }

    private void OnVmPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(CleanupViewModel.HasResultVisibility))
        {
            DrawCharts();
        }
    }

    private void DrawCharts()
    {
        DrawCandidatesBar();
        DrawRiskDonut();
    }

    private void DrawCandidatesBar()
    {
        CandidatesBarChartGrid.Children.Clear();
        var candidates = VM.CleanupCandidates;
        if (candidates == null || candidates.Count == 0)
        {
            CandidatesBarChartGrid.Children.Add(new TextBlock
            {
                Text = "No data",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 11,
                Opacity = 0.5
            });
            return;
        }

        var top = candidates
            .OrderByDescending(c => c.Size)
            .Take(8)
            .Select(c => (Label: TruncatePath(c.Path), Value: (double)c.Size, (string?)c.SizeDisplay))
            .ToList();
        var chart = LiveChartsFactory.CreateBarChart(top);
        CandidatesBarChartGrid.Children.Add(chart);
    }

    private void DrawRiskDonut()
    {
        RiskDonutGrid.Children.Clear();
        var candidates = VM.CleanupCandidates;
        if (candidates == null || candidates.Count == 0)
        {
            RiskDonutGrid.Children.Add(new TextBlock
            {
                Text = "No data",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 11,
                Opacity = 0.5
            });
            return;
        }

        var riskGroups = candidates
            .GroupBy(c => c.RiskLevel)
            .Select(g => (Label: g.Key.ToString(), Value: g.Sum(c => (double)c.Size)))
            .OrderByDescending(x => x.Value)
            .ToList();
        var chart = LiveChartsFactory.CreateDonutChart(riskGroups);
        RiskDonutGrid.Children.Add(chart);
    }

    private static string TruncatePath(string path)
    {
        if (string.IsNullOrEmpty(path)) return "?";
        var name = System.IO.Path.GetFileName(path);
        if (string.IsNullOrEmpty(name)) name = path;
        return name.Length > 18 ? name[..16] + ".." : name;
    }

    private async void Analyze_Click(object sender, RoutedEventArgs e)
    {
        if (VM.PerformCleanup)
        {
            var dialog = new ContentDialog
            {
                Title = "Confirm cleanup",
                Content = "This will delete files and directories. Are you sure you want to proceed?",
                PrimaryButtonText = "Delete",
                CloseButtonText = "Cancel",
                DefaultButton = ContentDialogButton.Close
            };
            dialog.XamlRoot = this.XamlRoot;
            if (await dialog.ShowAsync() != ContentDialogResult.Primary)
                return;
        }

        await VM.AnalyzeAsync();
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var path = await UiHelper.PickFolderAsync();
            if (path != null)
            {
                VM.TargetPath = path;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CleanupPage] Browse failed: {ex}");
        }
    }

    private void OpenCandidateFolder_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            UiHelper.OpenPath(path);
        }
    }
}
