// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
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
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        VM.DispatcherTimer.Start();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        VM.DispatcherTimer.Stop();
        base.OnNavigatedFrom(e);
    }

    private async void OnPageLoaded(object sender, RoutedEventArgs e)
    {
        await VM.LoadDashboardAsync();
    }

    private async void Refresh_Click(object sender, RoutedEventArgs e)
    {
        await VM.LoadDashboardAsync();
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
}
