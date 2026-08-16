// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace SpaceAnalyzer.Controls.ScanBreakdown;

/// <summary>
/// Model-agnostic breakdown list (file types, storage by category, categories,
/// extensions). The host supplies a <see cref="RowTemplate"/> so the same control
/// renders every breakdown without duplicating the ItemsRepeater boilerplate.
/// </summary>
public sealed partial class BreakdownListControl : UserControl
{
    public BreakdownListControl()
    {
        InitializeComponent();
    }

    public object ItemsSource
    {
        get => GetValue(ItemsSourceProperty);
        set => SetValue(ItemsSourceProperty, value);
    }
    public static readonly DependencyProperty ItemsSourceProperty =
        DependencyProperty.Register(nameof(ItemsSource), typeof(object), typeof(BreakdownListControl), new PropertyMetadata(null));

    public DataTemplate RowTemplate
    {
        get => (DataTemplate)GetValue(RowTemplateProperty);
        set => SetValue(RowTemplateProperty, value);
    }
    public static readonly DependencyProperty RowTemplateProperty =
        DependencyProperty.Register(nameof(RowTemplate), typeof(DataTemplate), typeof(BreakdownListControl), new PropertyMetadata(null));
}
