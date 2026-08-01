// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class HistoryPage : Page
{
    public HistoryPage()
    {
        this.InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        _ = RefreshIfNeededAsync();
    }

    private async void HistoryPage_Loaded(object sender, RoutedEventArgs e)
    {
        await RefreshIfNeededAsync();
    }

    private async Task RefreshIfNeededAsync()
    {
        if (!VM.HasHistory)
            await VM.LoadHistoryAsync();
    }

    private async void Refresh_Click(object sender, RoutedEventArgs e)
    {
        await VM.LoadHistoryAsync();
    }

    private async void Delete_Click(object sender, RoutedEventArgs e)
    {
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
        if (dialog.XamlRoot != null)
            dialog.XamlRoot = this.XamlRoot;
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
            return;

        await VM.DeleteHistoryAsync(id);
    }

    private async void ViewDetails_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button button || button.Tag is not long id)
            return;

        var record = VM.History.FirstOrDefault(r => r.Id == id);
        if (record != null)
        {
            await VM.LoadDetailsAsync(record);
        }
    }

    private void BackToList_Click(object sender, RoutedEventArgs e)
    {
        VM.SelectedRecord = null;
    }
}
