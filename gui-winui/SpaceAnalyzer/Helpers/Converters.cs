// Licensed under the MIT License.

using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Data;
using Microsoft.UI.Xaml.Media;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Converts a <see cref="bool"/> to <see cref="Visibility"/>.
/// <c>true</c> becomes <see cref="Visibility.Visible"/>.
/// </summary>
public sealed class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value == null) return Visibility.Collapsed;
        bool visible = value is bool b && b;
        return visible ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        if (value is Visibility v)
        {
            return v == Visibility.Visible;
        }

        return false;
    }
}

/// <summary>
/// Inverse of <see cref="BoolToVisibilityConverter"/>.
/// <c>true</c> becomes <see cref="Visibility.Collapsed"/>.
/// </summary>
public sealed class InverseBoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value == null) return Visibility.Visible;
        bool visible = value is bool b && b;
        return !visible ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        if (value is Visibility v)
        {
            return v != Visibility.Visible;
        }

        return false;
    }
}

/// <summary>
/// Converts a <see cref="bool"/> to a <see cref="SolidColorBrush"/>.
/// <c>false</c> returns the error brush (invalid/missing value); <c>true</c>
/// returns a neutral muted brush.
/// </summary>
public sealed class BoolToErrorBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool isError = value is not bool b || !b;
        if (isError)
        {
            return Application.Current.Resources["ErrorBrush"] as SolidColorBrush
                ?? new SolidColorBrush(Microsoft.UI.Colors.Red);
        }
        return Application.Current.Resources["MutedBrush"] as SolidColorBrush
            ?? new SolidColorBrush(Microsoft.UI.Colors.Gray);
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        return false;
    }
}

/// <summary>
/// Converts a <see cref="bool"/> to the appropriate scan button text.
/// <c>true</c> returns "Stop"; <c>false</c> returns "Start Scan".
/// </summary>
public sealed class BoolToScanButtonTextConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool isScanning = value is bool b && b;
        return isScanning ? "Stop" : "Start Scan";
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        return false;
    }
}

/// <summary>
/// Converts a <see cref="bool"/> to a <see cref="HorizontalAlignment"/>.
/// <c>true</c> returns <see cref="HorizontalAlignment.Right"/>; <c>false</c> returns <see cref="HorizontalAlignment.Left"/>.
/// </summary>
public sealed class BoolToHorizontalAlignmentConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool alignRight = value is bool b && b;
        return alignRight ? HorizontalAlignment.Right : HorizontalAlignment.Left;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        return false;
    }
}

/// <summary>
/// Converts an <see cref="int"/> to <see cref="Visibility"/>.
/// Greater than the parameter threshold becomes Visible; otherwise Collapsed.
/// Parameter defaults to 0 when not provided.
/// </summary>
public sealed class IntToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        int threshold = 0;
        if (parameter is string s && int.TryParse(s, out var parsed))
            threshold = parsed;
        if (value is int i && i > threshold)
            return Visibility.Visible;
        return Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        return false;
    }
}

/// <summary>
/// Converts an <see cref="int"/> result count to a display string.
/// </summary>
public sealed class IntToResultsTextConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value is int count)
            return count == 1 ? "1 result" : $"{count} results";
        return "0 results";
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        return false;
    }
}

/// <summary>
/// Maps a recommendation priority (1 = high, 2 = medium, 3 = low) to a
/// <see cref="Microsoft.UI.Colors"/> value suitable for a badge background.
/// </summary>
public sealed class PriorityToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        int priority = value is int p ? p : 3;
        return priority switch
        {
            1 => Microsoft.UI.Colors.IndianRed,
            2 => Microsoft.UI.Colors.DarkOrange,
            _ => Microsoft.UI.Colors.SteelBlue,
        };
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        return 3;
    }
}

/// <summary>
/// Compares the bound selected-template id to <see cref="ConverterParameter"/> and returns
/// the accent surface tint when they match (selected) or the default card background otherwise.
/// </summary>
public sealed class SelectedIdBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool match = value is string s && parameter is string p
            && string.Equals(s, p, StringComparison.OrdinalIgnoreCase);
        var key = match ? "AccentSurfaceBrush" : "CardBackgroundFillColorDefaultBrush";
        return Application.Current.Resources[key] as SolidColorBrush
            ?? new SolidColorBrush(match ? Microsoft.UI.Colors.DodgerBlue : Microsoft.UI.Colors.Transparent);
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => null!;
}

/// <summary>
/// Compares the bound selected-template id to <see cref="ConverterParameter"/> and returns the
/// solid accent border when they match (selected) or the default card stroke otherwise.
/// </summary>
public sealed class SelectedIdBorderConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool match = value is string s && parameter is string p
            && string.Equals(s, p, StringComparison.OrdinalIgnoreCase);
        var key = match ? "AccentButtonBackground" : "CardStrokeColorDefaultBrush";
        return Application.Current.Resources[key] as SolidColorBrush
            ?? new SolidColorBrush(match ? Microsoft.UI.Colors.DodgerBlue : Microsoft.UI.Colors.Gray);
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => null!;
}

/// <summary>
/// Returns <see cref="Visibility.Visible"/> when the bound selected-template id matches
/// <see cref="ConverterParameter"/> (the active workflow card).
/// </summary>
public sealed class SelectedIdVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool match = value is string s && parameter is string p
            && string.Equals(s, p, StringComparison.OrdinalIgnoreCase);
        return match ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => null!;
}

/// <summary>
/// Converts a selected-count <see cref="int"/> to a "Remove Selected (N)" button label.
/// </summary>
public sealed class SelectedCountToLabelConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        int count = value is int i ? i : 0;
        return count > 0 ? $"Remove Selected ({count})" : "Remove Selected";
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => 0;
}
