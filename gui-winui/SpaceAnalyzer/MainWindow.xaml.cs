// Licensed under the MIT License.

using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.ViewModels;
using System.Linq;
using Windows.Graphics;

namespace SpaceAnalyzer;

public sealed partial class MainWindow : Window
{
    private bool _isNavigating;

    public MainWindow()
    {
        this.InitializeComponent();
        this.Closed += OnWindowClosed;

        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
        var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd);
        var appWindow = AppWindow.GetFromWindowId(windowId);
        appWindow.Resize(new SizeInt32 { Width = 1400, Height = 900 });

        Title = "Space Analyzer Pro v4.0.0";
    }

    private void OnWindowClosed(object sender, WindowEventArgs args)
    {
        try
        {
            if (ContentFrame.Content is Views.SettingsPage settingsPage)
            {
                (settingsPage.DataContext as SettingsViewModel)?.Save();
            }
            if (ContentFrame.Content is Views.ScanPage scanPage)
            {
                (scanPage.DataContext as ScanViewModel)?.Save();
            }
        }
        catch { /* swallow */ }
    }

    private void NavView_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            NavigateToPage("Dashboard");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Nav] Dashboard load failed: {ex}");
        }
    }

    private void NavView_SelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (_isNavigating) return;
        if (args.SelectedItem is NavigationViewItem item)
        {
            NavigateToPage(item.Tag?.ToString());
        }
    }

    public void NavigateToPage(string? tag)
    {
        if (_isNavigating || string.IsNullOrEmpty(tag)) return;
        _isNavigating = true;

        try
        {
            Type pageType = tag switch
            {
                "Dashboard" => typeof(Views.DashboardPage),
                "Scan" => typeof(Views.ScanPage),
                "History" => typeof(Views.HistoryPage),
                "SmartSearch" => typeof(Views.SmartSearchPage),
                "AdvancedSearch" => typeof(Views.SmartSearchPage),
                "Workflows" => typeof(Views.WorkflowsPage),
                "AutomationWorkflows" => typeof(Views.WorkflowsPage),
                "AIChat" => typeof(Views.AIAssistantPage),
                "Dedup" => typeof(Views.DuplicatesPage),
                "System" => typeof(Views.SystemPage),
                "Cleanup" => typeof(Views.CleanupPage),
                "Settings" => typeof(Views.SettingsPage),
                "About" => typeof(Views.AboutPage),
                _ => typeof(Views.DashboardPage)
            };

            SelectNavItem(tag);
            ContentFrame.Navigate(pageType);
            UpdateTitle(tag);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Nav] {tag} navigation failed: {ex}");
        }
        finally
        {
            _isNavigating = false;
        }
    }

    private void SelectNavItem(string tag)
    {
        foreach (var item in NavView.MenuItems.OfType<NavigationViewItem>())
        {
            if (item.Tag?.ToString() == tag)
            {
                NavView.SelectedItem = item;
                return;
            }
        }
        foreach (var item in NavView.FooterMenuItems.OfType<NavigationViewItem>())
        {
            if (item.Tag?.ToString() == tag)
            {
                NavView.SelectedItem = item;
                return;
            }
        }
    }

    private void UpdateTitle(string? tag)
    {
        Title = tag switch
        {
            "Dashboard" => "Space Analyzer Pro — Dashboard",
            "Scan" => "Space Analyzer Pro — New Scan",
            "History" => "Space Analyzer Pro — Scan History",
            "SmartSearch" or "AdvancedSearch" => "Space Analyzer Pro — Smart Search",
            "Workflows" or "AutomationWorkflows" => "Space Analyzer Pro — Workflows",
            "AIChat" => "Space Analyzer Pro — AI Assistant",
            "Dedup" => "Space Analyzer Pro — Duplicates",
            "System" => "Space Analyzer Pro — System Resources",
            "Cleanup" => "Space Analyzer Pro — Cleanup",
            "Settings" => "Space Analyzer Pro — Settings",
            "About" => "Space Analyzer Pro — About",
            _ => "Space Analyzer Pro"
        };
    }
}
