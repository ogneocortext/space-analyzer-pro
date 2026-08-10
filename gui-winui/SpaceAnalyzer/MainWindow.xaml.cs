// Licensed under the MIT License.

using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.ViewModels;
using System.Linq;
using Windows.Graphics;

namespace SpaceAnalyzer;

public sealed partial class MainWindow : Window
{
    public static new MainWindow? Current { get; private set; }
    private bool _isNavigating;

    public MainWindow()
    {
        InitializeComponent();
        this.Closed += OnWindowClosed;
        Current = this;

        AppLog.Nav("MainWindow ctor start");

        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
        var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd);
        var appWindow = AppWindow.GetFromWindowId(windowId);
        appWindow.Resize(new SizeInt32 { Width = 1400, Height = 900 });

        Title = "Space Analyzer Pro v4.0.0";
        AppLog.Nav($"MainWindow ctor end, Title={Title}");
    }

    private void OnWindowClosed(object sender, WindowEventArgs args)
    {
        _isClosed = true;
        _notificationTimer?.Stop();
        try
        {
            // Save settings before disposing
            if (ContentFrame.Content is Views.SettingsPage settingsPage)
                (settingsPage.DataContext as SettingsViewModel)?.Save();
            if (ContentFrame.Content is Views.ScanPage scanPage)
                (scanPage.DataContext as ScanViewModel)?.Save();

            // Flush any pending DB writes before the process exits
            _ = SettingsStore.FlushAsync();

            // Dispose ALL tracked ViewModels (not just the active page's)
            ViewModelRegistry.DisposeAll();
        }
        catch { /* swallow */ }
        AppLog.Nav("MainWindow closed");
    }

    private DispatcherTimer? _notificationTimer;
    private bool _isClosed;

    /// <summary>
    /// Show a transient notification in the global InfoBar. Auto-hides after
    /// <paramref name="durationSeconds"/> (a new notification resets the timer).
    /// </summary>
    public void ShowNotification(
        string title,
        string? message = null,
        InfoBarSeverity severity = InfoBarSeverity.Informational,
        double durationSeconds = 6)
    {
        if (_isClosed) return;

        GlobalInfoBar.Title = title;
        GlobalInfoBar.Message = message;
        GlobalInfoBar.Severity = severity;
        GlobalInfoBar.IsOpen = true;

        _notificationTimer?.Stop();
        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(Math.Max(2, durationSeconds)) };
        _notificationTimer = timer;
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            if (_isClosed) return;
            GlobalInfoBar.IsOpen = false;
        };
        timer.Start();
    }

    private void NavView_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            AppLog.Nav("NavView_Loaded start");
            NavView.SelectedItem = NavView.MenuItems.OfType<NavigationViewItem>().First();
            NavigateToPage("Dashboard");
            AppLog.Nav("NavView_Loaded end");
        }
        catch (Exception ex)
        {
            AppLog.Error("NavView_Loaded failed", ex);
        }
    }

    private void NavView_ItemInvoked(NavigationView sender, NavigationViewItemInvokedEventArgs args)
    {
        if (_isNavigating) return;
        if (args.InvokedItemContainer is not NavigationViewItem item) return;

        var tag = item.Tag?.ToString();
        if (string.IsNullOrEmpty(tag)) return;

        AppLog.Nav($"ItemInvoked tag={tag}");
        NavigateToPage(tag);
    }

    private void ContentFrame_NavigationFailed(object sender, NavigationFailedEventArgs e)
    {
        AppLog.Error($"Navigation failed: {e.SourcePageType.FullName}", e.Exception);
        e.Handled = true;
    }

    private void ContentFrame_Navigated(object sender, NavigationEventArgs e)
    {
        AppLog.Nav($"Navigated to {e.SourcePageType.FullName}, Content={ContentFrame.Content?.GetType().FullName ?? "null"}");
    }

    public void NavigateToPage(string? tag, object? parameter = null)
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
                "UsnJournal" => typeof(Views.UsnPage),
                "Settings" => typeof(Views.SettingsPage),
                "About" => typeof(Views.AboutPage),
                _ => typeof(Views.DashboardPage)
            };

            SelectNavItem(tag);
            var success = ContentFrame.Navigate(pageType, parameter);
            AppLog.Nav($"NavigateToPage({tag}, param={parameter}) -> {pageType.Name}, success={success}");
            UpdateTitle(tag);
        }
        catch (Exception ex)
        {
            AppLog.Error($"NavigateToPage({tag}) failed", ex);
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
            "UsnJournal" => "Space Analyzer Pro — USN Journal",
            "Settings" => "Space Analyzer Pro — Settings",
            "About" => "Space Analyzer Pro — About",
            _ => "Space Analyzer Pro"
        };
    }
}
