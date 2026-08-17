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
/// Maps a scan-type label ("Deep", "Shallow", "Custom", "Default") to a theme-aware
/// <see cref="SolidColorBrush"/> so each history card can show a color-coded type badge
/// (Deep = accent, Shallow = success, Custom = attention, Default = muted).
/// </summary>
public sealed class ScanTypeToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        string type = value?.ToString() ?? string.Empty;
        string key = type switch
        {
            "Deep" => "AccentTextFillColorPrimaryBrush",
            "Shallow" => "SystemFillColorSuccessBrush",
            "Custom" => "SystemFillColorAttentionBrush",
            _ => "TextFillColorSecondaryBrush"
        };
        return Application.Current.Resources[key] as SolidColorBrush
            ?? new SolidColorBrush(Microsoft.UI.Colors.Gray);
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => null!;
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
/// Card fill for an item that carries its own <c>IsSelected</c> flag (data-templated pickers
/// where the view cannot compare against the parent view model's selection).
/// Accent surface tint when selected, default card background otherwise.
/// </summary>
public sealed class SelectedFlagBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool selected = value is bool b && b;
        var key = selected ? "AccentSurfaceBrush" : "CardBackgroundFillColorDefaultBrush";
        return Application.Current.Resources[key] as SolidColorBrush
            ?? new SolidColorBrush(selected ? Microsoft.UI.Colors.DodgerBlue : Microsoft.UI.Colors.Transparent);
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => null!;
}

/// <summary>
/// Card stroke counterpart to <see cref="SelectedFlagBrushConverter"/>: solid accent border
/// when selected, default card stroke otherwise.
/// </summary>
public sealed class SelectedFlagBorderConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool selected = value is bool b && b;
        var key = selected ? "AccentButtonBackground" : "CardStrokeColorDefaultBrush";
        return Application.Current.Resources[key] as SolidColorBrush
            ?? new SolidColorBrush(selected ? Microsoft.UI.Colors.DodgerBlue : Microsoft.UI.Colors.Gray);
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

/// <summary>
/// Two-way binds an enum property to a ToggleButton: true when the enum equals the
/// <see cref="ConverterParameter"/> value, and sets the enum when toggled on.
/// </summary>
public sealed class EnumEqualsConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value == null || parameter == null) return false;
        return string.Equals(value.ToString(), parameter.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        if (value is bool b && b && parameter != null && targetType.IsEnum)
            return Enum.Parse(targetType, parameter.ToString()!, true);
        return null!;
    }
}

/// <summary>
/// Formats a progress percentage for display. Values &lt; 0 (indeterminate) render as an
/// empty string so an indeterminate scan shows no misleading "0%".
/// </summary>
public sealed class DoubleToPercentTextConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value is double d && d >= 0)
            return $"{Math.Round(d)}%";
        return string.Empty;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => 0.0;
}

/// <summary>
/// Maps an inventory <c>Source</c> token (registry, scoop, chocolatey, rustup,
/// vscode-ext, wsl, docker) to a human-readable label for the Installed Apps page.
/// Unknown tokens pass through unchanged.
/// </summary>
public sealed class SourceToLabelConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        string source = value?.ToString() ?? string.Empty;
        return source switch
        {
            "registry" => "Registry",
            "scoop" => "Scoop",
            "chocolatey" => "Chocolatey",
            "rustup" => "Rustup",
            "vscode-ext" => "VS Code",
            "wsl" => "WSL",
            "docker" => "Docker",
            _ => string.IsNullOrWhiteSpace(source) ? "Other" : source
        };
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => null!;
}

/// <summary>
/// Active sort-button surface: accent fill when the bound sort/option is active,
/// otherwise a subtle secondary fill. Highlights the currently-applied history
/// sort so users can see which ordering is in effect at a glance.
/// </summary>
public sealed class BoolToAccentBackgroundConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool active = value is bool b && b;
        var key = active ? "AccentButtonBackground" : "CardBackgroundFillColorSecondaryBrush";
        return Application.Current.Resources[key] as SolidColorBrush
            ?? new SolidColorBrush(active ? Microsoft.UI.Colors.DodgerBlue : Microsoft.UI.Colors.Gray);
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => null!;
}

/// <summary>
/// Active sort-button foreground: on-accent text when active, otherwise the
/// default primary text. Pairs with <see cref="BoolToAccentBackgroundConverter"/>.
/// </summary>
public sealed class BoolToAccentForegroundConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        bool active = value is bool b && b;
        var key = active ? "TextOnAccentFillColorPrimaryBrush" : "TextFillColorPrimaryBrush";
        return Application.Current.Resources[key] as SolidColorBrush
            ?? new SolidColorBrush(Microsoft.UI.Colors.White);
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => null!;
}

/// <summary>
/// Maps an inventory <c>Source</c> token to a theme-aware badge accent brush so
/// each install group can show a color-coded source chip.
/// </summary>
public sealed class SourceToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        string source = value?.ToString() ?? string.Empty;
        string key = source switch
        {
            "registry" => "SystemFillColorImportantBrush",
            "scoop" => "SystemFillColorSuccessBrush",
            "chocolatey" => "SystemFillColorAttentionBrush",
            "rustup" => "SystemFillColorCautionBrush",
            "vscode-ext" => "SystemFillColorCautionBrush",
            "wsl" => "SystemFillColorAttractionBrush",
            "docker" => "SystemFillColorAttractionBrush",
            _ => "TextFillColorSecondaryBrush"
        };
        return Application.Current.Resources[key] as SolidColorBrush
            ?? new SolidColorBrush(Microsoft.UI.Colors.Gray);
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) => null!;
}
