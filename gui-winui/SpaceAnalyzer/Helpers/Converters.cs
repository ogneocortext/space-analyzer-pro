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
