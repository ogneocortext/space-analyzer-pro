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
using System.Runtime.InteropServices;
using Windows.Graphics;

namespace SpaceAnalyzer;

public sealed partial class MainWindow : Window
{
    public static new MainWindow? Current { get; private set; }
    private bool _isNavigating;
    private AppWindow? _appWindow;
    private IntPtr _lastMonitor;

    /// <summary>
    /// Optional tab to open on first launch (set from the <c>--page</c> argument).
    /// Consumed once by <see cref="NavView_Loaded"/>; falls back to Dashboard.
    /// </summary>
    public string? InitialPage { get; set; }

    public MainWindow()
    {
        InitializeComponent();
        this.Closed += OnWindowClosed;
        Current = this;

        AppLog.Nav("MainWindow ctor start");

        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
        var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd);
        _appWindow = AppWindow.GetFromWindowId(windowId);
        _appWindow.Changed += OnAppWindowChanged;

        FitToCurrentMonitor();

        Title = "Space Analyzer Pro v4.0.0";
        AppLog.Nav($"MainWindow ctor end, Title={Title}");
    }

    private void OnAppWindowChanged(AppWindow sender, AppWindowChangedEventArgs args)
    {
        // Re-fit only when the window moves to a DIFFERENT monitor — not on ordinary
        // user resizes within the same display. That is detected by comparing the
        // monitor the window is on before/after the change.
        if (!args.DidPositionChange && !args.DidSizeChange)
            return;
        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
        var mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if (mon != IntPtr.Zero && mon != _lastMonitor)
            FitToCurrentMonitor();
    }

    /// <summary>
    /// Sizes the window to fill the work area (taskbar-excluded) of the monitor it
    /// is currently on, so the UI adapts to any display/DPI instead of a hardcoded
    /// 1400x900 rectangle that overflowed small screens and under-filled large ones.
    /// </summary>
    private void FitToCurrentMonitor()
    {
        try
        {
            var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
            var hmon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
            if (hmon == IntPtr.Zero) return;
            _lastMonitor = hmon;

            var mi = new MONITORINFO { cbSize = Marshal.SizeOf<MONITORINFO>() };
            if (!GetMonitorInfoW(hmon, ref mi)) return;

            uint dpi = GetDpiForWindow(hwnd);
            if (dpi == 0) dpi = 96;
            double scale = (double)dpi / 96.0;

            int workLeft = (int)(mi.rcWork.left / scale);
            int workTop = (int)(mi.rcWork.top / scale);
            int workWidth = (int)((mi.rcWork.right - mi.rcWork.left) / scale);
            int workHeight = (int)((mi.rcWork.bottom - mi.rcWork.top) / scale);

            // Keep a sane minimum so the layout never collapses on tiny displays.
            workWidth = Math.Max(800, workWidth);
            workHeight = Math.Max(600, workHeight);

            _appWindow?.Move(new PointInt32 { X = workLeft, Y = workTop });
            _appWindow?.Resize(new SizeInt32 { Width = workWidth, Height = workHeight });

            AppLog.Nav($"FitToCurrentMonitor scale={scale:F2} -> {workWidth}x{workHeight} @({workLeft},{workTop})");
        }
        catch (Exception ex)
        {
            AppLog.Error("FitToCurrentMonitor failed", ex);
        }
    }

    private const int MONITOR_DEFAULTTONEAREST = 2;

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern bool GetMonitorInfoW(IntPtr hMonitor, ref MONITORINFO lpmi);

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr hwnd);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int left;
        public int top;
        public int right;
        public int bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    private void OnWindowClosed(object sender, WindowEventArgs args)
    {
        _isClosed = true;
        _notificationTimer?.Stop();
        try
        {
            // Settings auto-persist through AppSettings on every edit; just ensure
            // any pending write is flushed before disposing.
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
    private Action? _notificationAction;

    /// <summary>
    /// Show a transient notification in the global InfoBar. Auto-hides after
    /// <paramref name="durationSeconds"/> (a new notification resets the timer).
    /// When <paramref name="actionButtonText"/> and <paramref name="action"/> are
    /// supplied, a clickable button is rendered on the toast that invokes the callback.
    /// </summary>
    public void ShowNotification(
        string title,
        string? message = null,
        InfoBarSeverity severity = InfoBarSeverity.Informational,
        double durationSeconds = 6,
        string? actionButtonText = null,
        Action? action = null)
    {
        if (_isClosed) return;

        GlobalInfoBar.Title = title;
        GlobalInfoBar.Message = message;
        GlobalInfoBar.Severity = severity;
        GlobalInfoBar.IsOpen = true;

        ClearNotificationAction();
        if (!string.IsNullOrEmpty(actionButtonText) && action is not null)
        {
            _notificationAction = action;
            var btn = new Button
            {
                Content = actionButtonText,
                Style = (Microsoft.UI.Xaml.Style?)Application.Current.Resources["SecondaryButton"],
            };
            btn.Click += OnNotificationActionClick;
            GlobalInfoBar.ActionButton = btn;
        }

        _notificationTimer?.Stop();
        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(Math.Max(2, durationSeconds)) };
        _notificationTimer = timer;
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            if (_isClosed) return;
            GlobalInfoBar.IsOpen = false;
            ClearNotificationAction();
        };
        timer.Start();
    }

    private void OnNotificationActionClick(object sender, RoutedEventArgs e)
    {
        // Fire once, then detach so a stale handler can't outlive its toast.
        var action = _notificationAction;
        ClearNotificationAction();
        action?.Invoke();
    }

    private void ClearNotificationAction()
    {
        _notificationAction = null;
        if (GlobalInfoBar.ActionButton is Button prev)
            prev.Click -= OnNotificationActionClick;
        GlobalInfoBar.ActionButton = null;
    }

    private void NavView_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            AppLog.Nav("NavView_Loaded start");
            var target = InitialPage ?? "Dashboard";
            NavigateToPage(target);
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
                "InstalledApps" => typeof(Views.InstalledAppsPage),
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
            "InstalledApps" => "Space Analyzer Pro — Installed Apps",
            "System" => "Space Analyzer Pro — System Resources",
            "Cleanup" => "Space Analyzer Pro — Cleanup",
            "UsnJournal" => "Space Analyzer Pro — USN Journal",
            "Settings" => "Space Analyzer Pro — Settings",
            "About" => "Space Analyzer Pro — About",
            _ => "Space Analyzer Pro"
        };
    }
}
