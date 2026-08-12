// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Data;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Converts a <see cref="bool"/> to a chevron glyph for collapsible group headers
/// (<c>true</c> → expanded "▾", <c>false</c> → collapsed "▸").
/// </summary>
public sealed class BoolToChevronConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool expanded = value is bool b && b;
        return expanded ? "▾" : "▸";
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => null!;
}
