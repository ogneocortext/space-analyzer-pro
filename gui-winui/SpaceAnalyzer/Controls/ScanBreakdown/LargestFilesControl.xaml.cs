// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Controls.ScanBreakdown;

/// <summary>
/// Reusable Largest-Files list used by both the Scan result panel (compact mode)
/// and the History detail "Largest Files" tab (detailed mode with sort headers and
/// a size-proportion bar). Encapsulates the Open/Folder launch logic and the filter
/// Clear button so the two pages no longer duplicate that code.
/// </summary>
public sealed partial class LargestFilesControl : UserControl
{
    public LargestFilesControl()
    {
        InitializeComponent();
        FileRepeater.ItemTemplate = (DataTemplate)Resources["CompactTemplate"];
    }

    public object ItemsSource
    {
        get => GetValue(ItemsSourceProperty);
        set => SetValue(ItemsSourceProperty, value);
    }
    public static readonly DependencyProperty ItemsSourceProperty =
        DependencyProperty.Register(nameof(ItemsSource), typeof(object), typeof(LargestFilesControl), new PropertyMetadata(null));

    public string Filter
    {
        get => (string)GetValue(FilterProperty);
        set => SetValue(FilterProperty, value);
    }
    public static readonly DependencyProperty FilterProperty =
        DependencyProperty.Register(nameof(Filter), typeof(string), typeof(LargestFilesControl),
            new PropertyMetadata(string.Empty, OnFilterChanged));

    private static void OnFilterChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is LargestFilesControl c)
            c.HasFilter = !string.IsNullOrWhiteSpace(c.Filter);
    }

    public bool HasFilter
    {
        get => (bool)GetValue(HasFilterProperty);
        set => SetValue(HasFilterProperty, value);
    }
    public static readonly DependencyProperty HasFilterProperty =
        DependencyProperty.Register(nameof(HasFilter), typeof(bool), typeof(LargestFilesControl), new PropertyMetadata(false));

    public string FilterPlaceholder
    {
        get => (string)GetValue(FilterPlaceholderProperty);
        set => SetValue(FilterPlaceholderProperty, value);
    }
    public static readonly DependencyProperty FilterPlaceholderProperty =
        DependencyProperty.Register(nameof(FilterPlaceholder), typeof(string), typeof(LargestFilesControl), new PropertyMetadata("Filter..."));

    public bool DetailedMode
    {
        get => (bool)GetValue(DetailedModeProperty);
        set => SetValue(DetailedModeProperty, value);
    }
    public static readonly DependencyProperty DetailedModeProperty =
        DependencyProperty.Register(nameof(DetailedMode), typeof(bool), typeof(LargestFilesControl),
            new PropertyMetadata(false, OnDetailedModeChanged));

    private static void OnDetailedModeChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is LargestFilesControl c)
            c.FileRepeater.ItemTemplate = (DataTemplate)c.Resources[(bool)e.NewValue ? "DetailedTemplate" : "CompactTemplate"];
    }

    public bool ShowSortHeaders
    {
        get => (bool)GetValue(ShowSortHeadersProperty);
        set => SetValue(ShowSortHeadersProperty, value);
    }
    public static readonly DependencyProperty ShowSortHeadersProperty =
        DependencyProperty.Register(nameof(ShowSortHeaders), typeof(bool), typeof(LargestFilesControl), new PropertyMetadata(false));

    public string SizeSortIndicator
    {
        get => (string)GetValue(SizeSortIndicatorProperty);
        set => SetValue(SizeSortIndicatorProperty, value);
    }
    public static readonly DependencyProperty SizeSortIndicatorProperty =
        DependencyProperty.Register(nameof(SizeSortIndicator), typeof(string), typeof(LargestFilesControl), new PropertyMetadata(string.Empty));

    public string NameSortIndicator
    {
        get => (string)GetValue(NameSortIndicatorProperty);
        set => SetValue(NameSortIndicatorProperty, value);
    }
    public static readonly DependencyProperty NameSortIndicatorProperty =
        DependencyProperty.Register(nameof(NameSortIndicator), typeof(string), typeof(LargestFilesControl), new PropertyMetadata(string.Empty));

    public double ListMaxHeight
    {
        get => (double)GetValue(ListMaxHeightProperty);
        set => SetValue(ListMaxHeightProperty, value);
    }
    public static readonly DependencyProperty ListMaxHeightProperty =
        DependencyProperty.Register(nameof(ListMaxHeight), typeof(double), typeof(LargestFilesControl), new PropertyMetadata(320.0));

    public Visibility EmptyStateVisibility
    {
        get => (Visibility)GetValue(EmptyStateVisibilityProperty);
        set => SetValue(EmptyStateVisibilityProperty, value);
    }
    public static readonly DependencyProperty EmptyStateVisibilityProperty =
        DependencyProperty.Register(nameof(EmptyStateVisibility), typeof(Visibility), typeof(LargestFilesControl), new PropertyMetadata(Visibility.Collapsed));

    public string EmptyStateText
    {
        get => (string)GetValue(EmptyStateTextProperty);
        set => SetValue(EmptyStateTextProperty, value);
    }
    public static readonly DependencyProperty EmptyStateTextProperty =
        DependencyProperty.Register(nameof(EmptyStateText), typeof(string), typeof(LargestFilesControl), new PropertyMetadata("No files found."));

    public event System.EventHandler<SortRequestedEventArgs>? SortRequested;

    private void ClearFilter_Click(object sender, RoutedEventArgs e) => Filter = string.Empty;

    private void SortHeader_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button b && b.Tag is string tag && int.TryParse(tag, out var col))
            SortRequested?.Invoke(this, new SortRequestedEventArgs(col));
    }

    private void OpenFile_Click(object sender, RoutedEventArgs e)
    {
        if (((FrameworkElement)sender).DataContext is FileSizeEntry f && !string.IsNullOrEmpty(f.Path))
            UiHelper.OpenPath(f.Path);
    }

    private void OpenFolder_Click(object sender, RoutedEventArgs e)
    {
        if (((FrameworkElement)sender).DataContext is FileSizeEntry f && !string.IsNullOrEmpty(f.ParentPath))
            UiHelper.OpenPath(f.ParentPath);
    }
}
