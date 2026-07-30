using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Graphics;

namespace SpaceAnalyzer;

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        this.InitializeComponent();

        // Set window size via code (WinUI 3 Window doesn't support Width/Height in XAML)
        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
        var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd);
        var appWindow = AppWindow.GetFromWindowId(windowId);
        appWindow.Resize(new SizeInt32 { Width = 1400, Height = 900 });

        Title = "Space Analyzer Pro v3.7.0";
    }

    private void NavView_Loaded(object sender, RoutedEventArgs e)
    {
        ContentFrame.Navigate(typeof(Views.DashboardPage));
    }

    private void NavView_SelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (args.SelectedItem is NavigationViewItem item)
        {
            NavigateToPage(item.Tag?.ToString());
        }
    }

    private void NavigateToPage(string? tag)
    {
        Type? pageType = tag switch
        {
            "Dashboard" => typeof(Views.DashboardPage),
            "Scan" => typeof(Views.ScanPage),
            "History" => typeof(Views.HistoryPage),
            "SmartSearch" => typeof(Views.SmartSearchPage),
            "Workflows" => typeof(Views.WorkflowsPage),
            "AIChat" => typeof(Views.AIAssistantPage),
            "Dedup" => typeof(Views.DuplicatesPage),
            "System" => typeof(Views.SystemPage),
            "Settings" => typeof(Views.SettingsPage),
            _ => typeof(Views.DashboardPage)
        };

        ContentFrame.Navigate(pageType);
    }
}
