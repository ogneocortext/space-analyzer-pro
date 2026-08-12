// Licensed under the MIT License.

using LiveChartsCore;
using LiveChartsCore.SkiaSharpView;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;
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
            AppLog.Exception(e.ExceptionObject as Exception ?? new Exception(e.ExceptionObject?.ToString()), "AppDomain.UnhandledException");
        TaskScheduler.UnobservedTaskException += (s, e) =>
        {
            AppLog.Exception(e.Exception, "TaskScheduler.UnobservedTaskException");
            e.SetObserved();
        };
    }

    private static void OnUnhandledException(object sender, Microsoft.UI.Xaml.UnhandledExceptionEventArgs e)
    {
        AppLog.Exception(e.Exception, "UnhandledException (UI thread)");
        e.Handled = true;
    }

    protected override async void OnLaunched(LaunchActivatedEventArgs args)
    {
        LiveCharts.Configure(config => config
            .AddSkiaSharp()
            .AddDefaultMappers()
            .AddDefaultTheme()
            .UseDefaults());

        await SettingsStore.EnsureLoadedAsync();
        ApplySavedTheme();
        m_window = new MainWindow();
        m_window.Activate();
    }

    private static void ApplySavedTheme()
    {
        try
        {
            Application.Current.RequestedTheme = ThemeHelper.ResolveTheme(SettingsStore.Get("theme"));
        }
        catch { /* non-fatal */ }
    }

    public Window? MainWindow => m_window;
    private Window? m_window;
}
