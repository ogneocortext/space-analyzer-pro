// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class InstalledAppsPage : Page
{
    public InstalledAppsViewModel VM { get; }

    public InstalledAppsPage()
    {
        InitializeComponent();
        VM = new InstalledAppsViewModel();
        DataContext = VM;
        ViewModelRegistry.Register(VM);
        AppLog.Page("InstalledAppsPage ctor end");
    }

    private async void Analyze_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("InstalledAppsPage Analyze_Click");
        await VM.AnalyzeAsync();
    }
}
