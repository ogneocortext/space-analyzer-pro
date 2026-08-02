// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class AboutPage : Page
{
    public AboutPage()
    {
        this.InitializeComponent();
        AppLog.Page("AboutPage ctor end");
    }

    private void ViewLicense_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AboutPage ViewLicense_Click");
        try
        {
            var exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName
                ?? AppContext.BaseDirectory;
            var baseDir = string.IsNullOrEmpty(exePath)
                ? AppContext.BaseDirectory
                : System.IO.Path.GetDirectoryName(exePath)!;
            var licensePath = System.IO.Path.Combine(baseDir, "LICENSE.txt");
            if (System.IO.File.Exists(licensePath))
            {
                UiHelper.OpenPath(licensePath);
            }
        }
        catch
        {
            // Ignore — license file may not be present in all builds.
        }
    }

    private void OpenProjectFolder_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("AboutPage OpenProjectFolder_Click");
        try
        {
            var exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName
                ?? AppContext.BaseDirectory;
            var projectRoot = string.IsNullOrEmpty(exePath)
                ? AppContext.BaseDirectory
                : System.IO.Path.GetDirectoryName(exePath)!;
            if (!string.IsNullOrEmpty(projectRoot))
            {
                UiHelper.OpenPath(projectRoot);
            }
        }
        catch
        {
            // Ignore — path resolution may fail in packaged deployments.
        }
    }
}
