// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class SystemPage : Page
{
    public SystemViewModel VM { get; }

    public SystemPage()
    {
        InitializeComponent();
        VM = new SystemViewModel();
        DataContext = VM;
        AppLog.Page("SystemPage ctor end");
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        AppLog.Page("SystemPage OnNavigatedTo");
        VM.DispatcherTimer.Start();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        VM.DispatcherTimer.Stop();
        base.OnNavigatedFrom(e);
    }

    private void Refresh_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("SystemPage Refresh_Click");
        VM.Refresh();
    }

    private void OpenVolume_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("SystemPage OpenVolume_Click");
        if (sender is Button btn && btn.Tag is string mountPoint && !string.IsNullOrEmpty(mountPoint))
        {
            UiHelper.OpenPath(mountPoint);
        }
    }
}
