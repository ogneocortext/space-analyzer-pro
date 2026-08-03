// Licensed under the MIT License.

using LiveChartsCore;
using LiveChartsCore.SkiaSharpView;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer;

public partial class App : Application
{
    public App()
    {
        this.InitializeComponent();
        this.UnhandledException += OnUnhandledException;
    }

    private static void OnUnhandledException(object sender, Microsoft.UI.Xaml.UnhandledExceptionEventArgs e)
    {
        var ex = e.Exception;
        System.Diagnostics.Debug.WriteLine($"[UnhandledException] {ex}");
        System.Diagnostics.Debug.WriteLine(ex.StackTrace);
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
            if (theme == "Light")
                Application.Current.RequestedTheme = Microsoft.UI.Xaml.ApplicationTheme.Light;
        }
        catch { /* non-fatal */ }
    }

    public Window? MainWindow => m_window;
    private Window? m_window;
}
