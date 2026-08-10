// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class UsnPage : Page
{
    public UsnJournalViewModel VM { get; }

    public UsnPage()
    {
        InitializeComponent();
        VM = new UsnJournalViewModel();
        DataContext = VM;
        ViewModelRegistry.Register(VM);
        AppLog.Page("UsnPage ctor end");
    }

    private async void Volumes_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("UsnPage Volumes_Click");
        await VM.RefreshVolumesAsync();
    }

    private async void Status_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("UsnPage Status_Click");
        await VM.LoadStatusAsync();
    }

    private async void Changes_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("UsnPage Changes_Click");
        await VM.LoadChangesAsync();
    }
}
