// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

/// <summary>
/// Self-contained maintenance / cleanup / database tools panel. Extracted from
/// HistoryPage so the page file stays focused on history browsing composition.
/// </summary>
public sealed partial class MaintenancePanel : UserControl
{
    public static readonly DependencyProperty VMProperty = DependencyProperty.Register(
        nameof(VM), typeof(HistoryViewModel), typeof(MaintenancePanel), new PropertyMetadata(null));

    public HistoryViewModel VM
    {
        get => (HistoryViewModel)GetValue(VMProperty);
        set => SetValue(VMProperty, value);
    }

    public MaintenancePanel()
    {
        InitializeComponent();
    }

    private async void RefreshDbInfo_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("MaintenancePanel RefreshDbInfo_Click");
        await VM.LoadDatabaseInfoAsync();
    }

    private async void PruneEmpty_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("MaintenancePanel PruneEmpty_Click");
        var dialog = new ContentDialog
        {
            Title = "Remove empty scans",
            Content = "Delete all scan records that captured zero files (e.g. temporary directories)? This cannot be undone.",
            PrimaryButtonText = "Remove",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close
        };
        dialog.XamlRoot = this.XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        await VM.PruneEmptyScansAsync();
    }

    private async void PruneRelative_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("MaintenancePanel PruneRelative_Click");
        var dialog = new ContentDialog
        {
            Title = "Remove invalid-path scans",
            Content = "Delete scan records whose path is not absolute (relative scans that don't resolve to a real directory)? This cannot be undone.",
            PrimaryButtonText = "Remove",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close
        };
        dialog.XamlRoot = this.XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        await VM.PruneRelativeScansAsync();
    }

    private async void Backfill_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("MaintenancePanel Backfill_Click");
        await VM.BackfillCategoriesAsync();
    }

    private async void Vacuum_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("MaintenancePanel Vacuum_Click");
        await VM.VacuumDatabaseAsync();
    }

    private async void PruneFileCache_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("MaintenancePanel PruneFileCache_Click");
        await VM.PruneFileCacheAsync();
    }

    private async void PruneWorkflows_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("MaintenancePanel PruneWorkflows_Click");
        await VM.PruneWorkflowsAsync();
    }

    private async void PruneDiskSpace_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("MaintenancePanel PruneDiskSpace_Click");
        var dialog = new ContentDialog
        {
            Title = "Prune disk-space history",
            Content = "Delete disk-space snapshots older than 24 hours? Recent snapshots are kept so the storage-trend chart still works. This cannot be undone.",
            PrimaryButtonText = "Prune",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close
        };
        dialog.XamlRoot = this.XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        await VM.PruneDiskSpaceAsync(24);
    }

    private async void ClearHistory_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("MaintenancePanel ClearHistory_Click");
        var dialog = new ContentDialog
        {
            Title = "Clear all history",
            Content = "Delete EVERY scan record, including their embedded metrics and analysis? This cannot be undone.",
            PrimaryButtonText = "Clear Everything",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close
        };
        dialog.XamlRoot = this.XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        await VM.ClearHistoryAsync();
    }
}
