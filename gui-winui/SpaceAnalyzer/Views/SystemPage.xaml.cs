// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Views
{
    public sealed partial class SystemPage : Page
    {
        public SystemPage()
        {
            this.InitializeComponent();
        }

        protected override void OnNavigatedTo(NavigationEventArgs e)
        {
            base.OnNavigatedTo(e);
            VM.DispatcherTimer.Start();
        }

        protected override void OnNavigatedFrom(NavigationEventArgs e)
        {
            VM.DispatcherTimer.Stop();
            base.OnNavigatedFrom(e);
        }
    }
}
