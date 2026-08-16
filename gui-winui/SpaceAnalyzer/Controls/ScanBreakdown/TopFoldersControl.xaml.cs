// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Controls.ScanBreakdown;

/// <summary>
/// Visual layout for a row in <see cref="TopFoldersControl"/>.
/// </summary>
public enum TopFoldersDisplayMode
{
    /// <summary>Scan result "Largest Directories" — name + size · file count.</summary>
    Compact,
    /// <summary>History detail "Folders" — name/path/size/counts + Open button + bar.</summary>
    Detailed,
    /// <summary>History Overview "Top Folders" rollup — name/path + size + proportion bar.</summary>
    Rollup
}

/// <summary>
/// Reusable Top-Folders / Top-Directories list. Compact mode backs the Scan result
/// panel; detailed mode (with path, counts, proportion bar and an Open button) backs
/// the History detail "Folders" tab; rollup mode backs the Overview "Top Folders" rollup.
/// </summary>
public sealed partial class TopFoldersControl : UserControl
{
    public TopFoldersControl()
    {
        InitializeComponent();
        FolderRepeater.ItemTemplate = (DataTemplate)Resources["CompactTemplate"];
    }

    public object ItemsSource
    {
        get => GetValue(ItemsSourceProperty);
        set => SetValue(ItemsSourceProperty, value);
    }
    public static readonly DependencyProperty ItemsSourceProperty =
        DependencyProperty.Register(nameof(ItemsSource), typeof(object), typeof(TopFoldersControl), new PropertyMetadata(null));

    public TopFoldersDisplayMode DisplayMode
    {
        get => (TopFoldersDisplayMode)GetValue(DisplayModeProperty);
        set => SetValue(DisplayModeProperty, value);
    }
    public static readonly DependencyProperty DisplayModeProperty =
        DependencyProperty.Register(nameof(DisplayMode), typeof(TopFoldersDisplayMode), typeof(TopFoldersControl),
            new PropertyMetadata(TopFoldersDisplayMode.Compact, OnDisplayModeChanged));

    private static void OnDisplayModeChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is TopFoldersControl c)
            c.FolderRepeater.ItemTemplate = (DataTemplate)c.Resources[
                ((TopFoldersDisplayMode)e.NewValue) switch
                {
                    TopFoldersDisplayMode.Detailed => "DetailedTemplate",
                    TopFoldersDisplayMode.Rollup => "RollupTemplate",
                    _ => "CompactTemplate"
                }];
    }

    private void OpenFolder_Click(object sender, RoutedEventArgs e)
    {
        if (((FrameworkElement)sender).DataContext is DirEntry dir && !string.IsNullOrEmpty(dir.Path))
            UiHelper.OpenPath(dir.Path);
    }
}
