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
        VM.FilesSentToRecycleBin += OnFilesSentToRecycleBin;
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

    private async void Hardlink_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage Hardlink_Click");
        if (string.IsNullOrWhiteSpace(VM.ScanPath) || !Directory.Exists(VM.ScanPath)) return;

        var dialog = new ContentDialog
        {
            Title = "Hardlink duplicates",
            Content = "Replace duplicate copies with hard links to the original. This reclaims space without deleting any file content — every path still opens normally. Do you want to apply it to all duplicates in this directory?",
            PrimaryButtonText = "Hardlink",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close
        };
        dialog.XamlRoot = this.XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        await VM.ApplyHardlinksAsync();
    }

    private async void AnalyzeImpact_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage AnalyzeImpact_Click");
        await VM.AnalyzeImpactAsync();
    }

    private async void ImpactBrowse_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage ImpactBrowse_Click");
        try
        {
            var path = await UiHelper.PickFileAsync();
            if (path != null)
            {
                VM.ImpactPath = path;
            }
        }
        catch (Exception ex)
        {
            AppLog.Error("DuplicatesPage ImpactBrowse_Click failed", ex);
        }
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

    private void GroupCheck_Changed(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage GroupCheck_Changed");
        VM.NotifySelectionChanged();
    }

    private void SelectAll_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage SelectAll_Click");
        if (sender is CheckBox checkBox)
        {
            VM.SelectAll(checkBox.IsChecked == true);
        }
    }

    private async void RemoveSelected_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("DuplicatesPage RemoveSelected_Click");
        if (!VM.HasSelection) return;

        var dialog = new ContentDialog
        {
            Title = "Remove duplicate copies",
            Content = $"Move the extra copies from {VM.SelectedCount} duplicate group(s) to the Recycle Bin, keeping one copy of each file? Nothing is permanently deleted \u2014 you can restore files from the Recycle Bin afterwards.",
            PrimaryButtonText = "Move to Recycle Bin",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close
        };
        dialog.XamlRoot = this.XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        await VM.RemoveSelectedAsync();
    }

    private async void OnFilesSentToRecycleBin(object? sender, int count)
    {
        AppLog.Action($"DuplicatesPage recycle-bin: {count} file(s)");
        // Offer to empty the bin, but only when something is actually in it and the
        // user chooses to. Otherwise the files remain restorable via the Recycle Bin.
        if (!FileOperations.RecycleBinHasItems())
            return;

        var dialog = new ContentDialog
        {
            Title = "Empty the Recycle Bin?",
            Content = $"{count} file(s) were moved to the Recycle Bin. Empty it now to reclaim the space, or keep it so you can restore anything that was removed by mistake?",
            PrimaryButtonText = "Empty Recycle Bin",
            SecondaryButtonText = "Keep (restore later)",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close
        };
        dialog.XamlRoot = this.XamlRoot;
        var result = await dialog.ShowAsync();
        if (result == ContentDialogResult.Primary)
        {
            if (FileOperations.EmptyRecycleBin())
                AppNotifications.Show("Recycle Bin emptied", null, InfoBarSeverity.Success);
            else
                AppNotifications.Error("Could not empty Recycle Bin", "The Recycle Bin may be in use. Try again or empty it from Windows Explorer.");
        }
    }
}
