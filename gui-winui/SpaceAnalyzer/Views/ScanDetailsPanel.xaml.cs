// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using SpaceAnalyzer.Controls.ScanBreakdown;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;
using Windows.ApplicationModel.DataTransfer;

namespace SpaceAnalyzer.Views;

/// <summary>
/// Self-contained "Scan Details" panel (the tabbed breakdown shown when a single
/// scan record is selected). Extracted from HistoryPage to keep that page focused
/// on list/search/maintenance composition.
/// </summary>
public sealed partial class ScanDetailsPanel : UserControl
{
    public static readonly DependencyProperty VMProperty = DependencyProperty.Register(
        nameof(VM), typeof(HistoryViewModel), typeof(ScanDetailsPanel), new PropertyMetadata(null));

    public HistoryViewModel VM
    {
        get => (HistoryViewModel)GetValue(VMProperty);
        set => SetValue(VMProperty, value);
    }

    public ScanDetailsPanel()
    {
        InitializeComponent();
    }

    private void BackToList_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanDetailsPanel BackToList_Click");
        VM.BackToList();
    }

    private void CopyPath_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanDetailsPanel CopyPath_Click");
        if (sender is not Button { Tag: string path } || string.IsNullOrEmpty(path))
            return;

        var data = new DataPackage();
        data.SetText(path);
        Clipboard.SetContent(data);
        AppNotifications.Success("Path copied", path);
    }

    private void OnLargestFilesSort(object? sender, SortRequestedEventArgs e)
    {
        AppLog.Action($"ScanDetailsPanel OnLargestFilesSort column={e.Column}");
        VM.ToggleFileSort(e.Column);
    }

    private async void RunDuplicateAnalysis_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("ScanDetailsPanel RunDuplicateAnalysis_Click");
        if (VM.SelectedRecord == null)
        {
            AppNotifications.Show("No scan selected", "Open a scan's details first.");
            return;
        }
        await VM.RunDuplicateAnalysisAsync();
    }
}
