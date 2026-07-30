using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using WinRT.Interop;

namespace SpaceAnalyzer.Views;

public sealed partial class DuplicatesPage : Page
{
    public DuplicatesPage()
    {
        this.InitializeComponent();
    }

    private async void Analyze_Click(object sender, RoutedEventArgs e)
    {
        await VM.AnalyzeAsync();
    }

    private void Browse_Click(object sender, RoutedEventArgs e)
    {
        var picker = new Windows.Storage.Pickers.FolderPicker();
        picker.SuggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.Desktop;
        picker.FileTypeFilter.Add("*");

        var hwnd = WindowNative.GetWindowHandle(Window.Current);
        InitializeWithWindow.Initialize(picker, hwnd);

        var result = picker.PickSingleFolderAsync().GetAwaiter().GetResult();
        if (result != null)
        {
            VM.ScanPath = result.Path;
        }
    }
}
