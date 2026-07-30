using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Navigation;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views
{
    public sealed partial class DashboardPage : Page
    {
        public DashboardViewModel VM { get; } = new();

        public DashboardPage()
        {
            this.InitializeComponent();
            this.Loaded += OnPageLoaded;
        }

        protected override void OnNavigatedFrom(NavigationEventArgs e)
        {
            base.OnNavigatedFrom(e);
            VM.Dispose();
        }

        private async void OnPageLoaded(object sender, RoutedEventArgs e)
        {
            await VM.LoadDiskVolumesAsync();
        }

        private void NavigateToTag(string tag)
        {
            var navView = FindNavigationView(this);
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

        private static NavigationView? FindNavigationView(DependencyObject element)
        {
            if (element == null) return null;
            if (element is NavigationView navView) return navView;

            int count = VisualTreeHelper.GetChildrenCount(element);
            for (int i = 0; i < count; i++)
            {
                var child = VisualTreeHelper.GetChild(element, i);
                var result = FindNavigationView(child);
                if (result != null) return result;
            }
            return null;
        }

        private void BtnNewScan_Click(object sender, RoutedEventArgs e) => NavigateToTag("Scan");
        private void BtnViewHistory_Click(object sender, RoutedEventArgs e) => NavigateToTag("History");
        private void BtnFindDuplicates_Click(object sender, RoutedEventArgs e) => NavigateToTag("Dedup");
        private void BtnAIAssistant_Click(object sender, RoutedEventArgs e) => NavigateToTag("AIChat");
    }
}
