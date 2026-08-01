// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Storage;

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
        System.Diagnostics.Debug.WriteLine($"[UnhandledException] {e.Exception}");
        System.Diagnostics.Debug.WriteLine(e.Exception.StackTrace);
        e.Handled = true;
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        ApplySavedTheme();
        m_window = new MainWindow();
        m_window.Activate();
    }

    private static void ApplySavedTheme()
    {
        try
        {
            var container = Windows.Storage.ApplicationData.Current.LocalSettings
                .CreateContainer("SpaceAnalyzer.Settings", Windows.Storage.ApplicationDataCreateDisposition.Always);

            if (container.Values.TryGetValue("Theme", out var v) && v is string theme)
            {
                if (theme == "Dark")
                    Application.Current.RequestedTheme = Microsoft.UI.Xaml.ApplicationTheme.Dark;
                else if (theme == "Light")
                    Application.Current.RequestedTheme = Microsoft.UI.Xaml.ApplicationTheme.Light;
            }
        }
        catch { /* non-fatal */ }
    }

    public Window? MainWindow => m_window;
    private Window? m_window;
}
