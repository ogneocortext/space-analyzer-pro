// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class WorkflowsPage : Page
{
    public WorkflowsViewModel VM { get; }

    public WorkflowsPage()
    {
        InitializeComponent();
        VM = new WorkflowsViewModel();
        DataContext = VM;
        ViewModelRegistry.Register(VM);
        AppLog.Page("WorkflowsPage ctor end");
    }

    private async void Browse_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("WorkflowsPage Browse_Click");
        try
        {
            var path = await UiHelper.PickFolderAsync();
            if (path != null)
            {
                VM.TargetPath = path;
            }
        }
        catch (Exception ex)
        {
            AppLog.Error("WorkflowsPage Browse_Click failed", ex);
        }
    }

    private void OpenTargetPath_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("WorkflowsPage OpenTargetPath_Click");
        if (!string.IsNullOrWhiteSpace(VM.TargetPath) && System.IO.Directory.Exists(VM.TargetPath))
        {
            UiHelper.OpenPath(VM.TargetPath);
        }
    }

    private async void Run_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("WorkflowsPage Run_Click");
        await VM.RunAsync();
    }

    private void OpenResultFile_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("WorkflowsPage OpenResultFile_Click");
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            UiHelper.OpenPath(path);
        }
    }

    private void OpenResultFolder_Click(object sender, RoutedEventArgs e)
    {
        AppLog.Action("WorkflowsPage OpenResultFolder_Click");
        if (sender is Button btn && btn.Tag is string path && !string.IsNullOrEmpty(path))
        {
            var parent = System.IO.Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(parent))
            {
                UiHelper.OpenPath(parent);
            }
        }
    }
}
