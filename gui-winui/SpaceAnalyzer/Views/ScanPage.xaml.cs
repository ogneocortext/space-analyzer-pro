using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using WinRT.Interop;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views;

public sealed partial class ScanPage : Page
{
    public ScanPage()
    {
        this.InitializeComponent();
    }

    private async void Scan_Click(object sender, RoutedEventArgs e)
    {
        await VM.ScanAsync();
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
