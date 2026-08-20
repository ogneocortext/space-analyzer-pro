// Licensed under the MIT License.

using Microsoft.UI;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// WinUI presentation layer over <see cref="FileCategoryCore"/>: the same
/// extension → category classification, plus category colors for charts.
/// The pure classification lives in <see cref="FileCategoryCore"/> (free of
/// Windows/WinUI types) so it can be shared with the headless unit tests.
/// </summary>
public static class FileCategory
{
    public static IReadOnlyList<string> ExtensionsForCategory(string category)
        => FileCategoryCore.ExtensionsForCategory(category);

    public static string CategoryForExtension(string? extension)
        => FileCategoryCore.CategoryForExtension(extension);

    public static SolidColorBrush CategoryBrush(string category)
    {
        if (!FileCategoryCore.CategoryColors.TryGetValue(category, out var c))
            c = (180, 180, 180);
        return new SolidColorBrush(ColorHelper.FromArgb(255, c.R, c.G, c.B));
    }
}
