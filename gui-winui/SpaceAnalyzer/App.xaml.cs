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
            var theme = SettingsStore.Get("theme");
            var requested = theme switch
            {
                "Light" => Microsoft.UI.Xaml.ApplicationTheme.Light,
                "System" => DetectSystemTheme(),
                _ => Microsoft.UI.Xaml.ApplicationTheme.Dark,
            };
            Application.Current.RequestedTheme = requested;
        }
        catch { /* non-fatal */ }
    }

    private static Microsoft.UI.Xaml.ApplicationTheme DetectSystemTheme()
    {
        try
        {
            var color = new Windows.UI.ViewManagement.UISettings()
                .GetColorValue(Windows.UI.ViewManagement.UIColorType.Background);
            var luminance = (color.R * 299 + color.G * 587 + color.B * 114) / 1000;
            return luminance < 128
                ? Microsoft.UI.Xaml.ApplicationTheme.Dark
                : Microsoft.UI.Xaml.ApplicationTheme.Light;
        }
        catch
        {
            return Microsoft.UI.Xaml.ApplicationTheme.Dark;
        }
    }

    public Window? MainWindow => m_window;
    private Window? m_window;
}
