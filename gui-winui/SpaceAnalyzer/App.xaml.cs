// Licensed under the MIT License.

using LiveChartsCore;
using LiveChartsCore.SkiaSharpView;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;
using System;
using System.Threading.Tasks;

namespace SpaceAnalyzer;

public partial class App : Application
{
    public App()
    {
        this.InitializeComponent();
        this.UnhandledException += OnUnhandledException;

        // Catch failures that escape the UI thread or unobserved async tasks.
        AppDomain.CurrentDomain.UnhandledException += (s, e) =>
        {
            AppLog.Fatal(e.ExceptionObject as Exception ?? new Exception(e.ExceptionObject?.ToString()), "AppDomain.UnhandledException");
            AppLog.Flush();
        };
        TaskScheduler.UnobservedTaskException += (s, e) =>
        {
            AppLog.Fatal(e.Exception, "TaskScheduler.UnobservedTaskException");
            AppLog.Flush();
            e.SetObserved();
        };
        // Breadcrumb: WinUI sometimes rethrows faults with a NULL Exception, which
        // drops the stack. Capture the stack of the first few null-deref style
        // exceptions so the real fault site is diagnosable from the log alone.
        AppDomain.CurrentDomain.FirstChanceException += (s, e) =>
        {
            if (_firstChanceCount >= 5) return;
            if (e.Exception is NullReferenceException or InvalidOperationException or ArgumentNullException)
            {
                Interlocked.Increment(ref _firstChanceCount);
                // Use Environment.StackTrace: the handler runs synchronously at the
                // throw site, so this captures the real fault location even when
                // WinUI later rethrows with a null Exception.StackTrace.
                AppLog.Write(AppLog.Level.Error, "FIRSTCHANCE",
                    $"{e.Exception.GetType().Name}: {e.Exception.Message}\n{Environment.StackTrace}");
            }
        };
        // Log process exit so a clean shutdown is always recorded. Its absence
        // (paired with a last NAV/BOOT line) signals an abnormal native crash.
        AppDomain.CurrentDomain.ProcessExit += (s, e) => AppLog.Shutdown("process exit");
    }

    private static int _firstChanceCount;

    private static void OnUnhandledException(object sender, Microsoft.UI.Xaml.UnhandledExceptionEventArgs e)
    {
        // WinUI sometimes delivers a null Exception (e.g. XAML parse / layout
        // faults during measure/arrange). Capture e.Message so the failure is
        // never silent in the log.
        var ctx = $"UnhandledException (UI thread): {e.Message}";
        if (e.Exception is { } ex)
            AppLog.Fatal(ex, ctx);
        else
            AppLog.Write(AppLog.Level.Fatal, "FATAL", ctx);
        AppLog.Flush();
        e.Handled = true;
    }

    protected override async void OnLaunched(LaunchActivatedEventArgs args)
    {
        AppLog.Boot($"app launched pid={Environment.ProcessId}");

        LiveCharts.Configure(config => config
            .AddSkiaSharp()
            .AddDefaultMappers()
            .AddDefaultTheme()
            .UseDefaults());

        await SettingsStore.EnsureLoadedAsync();
        ApplySavedTheme();

        var initialPage = ParseInitialPage(Environment.GetCommandLineArgs());

        var mainWindow = new MainWindow();
        if (!string.IsNullOrEmpty(initialPage))
            mainWindow.InitialPage = initialPage;
        m_window = mainWindow;
        m_window.Activate();
    }

    /// <summary>
    /// Parse the optional <c>--page &lt;tag&gt;</c> / <c>--page=&lt;tag&gt;</c> launch
    /// argument so the app can open directly on a given tab (used for automated
    /// capture/verification where UI Automation is unavailable). Matching is
    /// case-insensitive against the known navigation tags.
    /// </summary>
    private static readonly Dictionary<string, string> s_pageAliases =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["dashboard"] = "Dashboard",
            ["scan"] = "Scan",
            ["history"] = "History",
            ["smartsearch"] = "SmartSearch",
            ["advancedsearch"] = "AdvancedSearch",
            ["search"] = "SmartSearch",
            ["workflows"] = "Workflows",
            ["automationworkflows"] = "AutomationWorkflows",
            ["aichat"] = "AIChat",
            ["chat"] = "AIChat",
            ["dedup"] = "Dedup",
            ["duplicates"] = "Dedup",
            ["installedapps"] = "InstalledApps",
            ["apps"] = "InstalledApps",
            ["system"] = "System",
            ["cleanup"] = "Cleanup",
            ["usnjournal"] = "UsnJournal",
            ["usn"] = "UsnJournal",
            ["settings"] = "Settings",
            ["about"] = "About",
        };

    private static string? ParseInitialPage(string[] argv)
    {
        string? raw = null;
        for (int i = 0; i < argv.Length; i++)
        {
            var a = argv[i];
            if (a.Equals("--page", StringComparison.OrdinalIgnoreCase))
            {
                if (i + 1 < argv.Length) { raw = argv[i + 1]; break; }
            }
            else if (a.StartsWith("--page=", StringComparison.OrdinalIgnoreCase))
            {
                raw = a.Substring("--page=".Length);
                break;
            }
        }
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return s_pageAliases.TryGetValue(raw.Trim(), out var canonical) ? canonical : null;
    }

    private static void ApplySavedTheme()
    {
        try
        {
            Application.Current.RequestedTheme = ThemeHelper.ResolveTheme(AppSettings.Theme);
        }
        catch { /* non-fatal */ }
    }

    public Window? MainWindow => m_window;
    private Window? m_window;
}
