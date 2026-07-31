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

    private async void OnPageLoaded(object sender, RoutedEventArgs e)
    {
        await VM.LoadDashboardAsync();
    }

    private void NavigateToTag(string tag)
    {
        var navView = UiHelper.FindNavigationView(this);
        if (navView != null)
        {
            foreach (var item in navView.MenuItems)
            {
                if (item is NavigationViewItem navItem && navItem.Tag?.ToString() == tag)
                {
                    navView.SelectedItem = navItem;
                    return;
                }
            }
            foreach (var item in navView.FooterMenuItems)
            {
                if (item is NavigationViewItem navItem && navItem.Tag?.ToString() == tag)
                {
                    navView.SelectedItem = navItem;
                    return;
                }
            }
        }
    }

    private void BtnNewScan_Click(object sender, RoutedEventArgs e) => NavigateToTag("Scan");
    private void BtnViewHistory_Click(object sender, RoutedEventArgs e) => NavigateToTag("History");
    private void BtnFindDuplicates_Click(object sender, RoutedEventArgs e) => NavigateToTag("Dedup");
    private void BtnAIAssistant_Click(object sender, RoutedEventArgs e) => NavigateToTag("AIChat");
    private void BtnCleanup_Click(object sender, RoutedEventArgs e) => NavigateToTag("Cleanup");
    private void BtnSystem_Click(object sender, RoutedEventArgs e) => NavigateToTag("System");
}
