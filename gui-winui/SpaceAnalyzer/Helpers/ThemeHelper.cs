// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Windows.UI.ViewManagement;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Shared helpers for resolving and detecting the application theme so the
/// startup path (<see cref="App"/>) and the live Settings picker
/// (<see cref="ViewModels.SettingsViewModel"/>) cannot drift apart.
/// </summary>
public static class ThemeHelper
{
    /// <summary>
    /// Converts the persisted theme string ("Dark"/"Light"/"System") into an
    /// <see cref="ApplicationTheme"/>. Any unrecognised value defaults to Dark.
    /// </summary>
    public static ApplicationTheme ResolveTheme(string? theme) => theme switch
    {
        "Light" => ApplicationTheme.Light,
        "System" => DetectSystemTheme(),
        _ => ApplicationTheme.Dark,
    };

    /// <summary>
    /// Detects whether Windows is currently in dark or light mode by sampling the
    /// system background colour, so the "System" theme choice can be honoured.
    /// </summary>
    public static ApplicationTheme DetectSystemTheme()
    {
        try
        {
            var color = new UISettings().GetColorValue(UIColorType.Background);
            var luminance = (color.R * 299 + color.G * 587 + color.B * 114) / 1000;
            return luminance < 128
                ? ApplicationTheme.Dark
                : ApplicationTheme.Light;
        }
        catch
        {
            return ApplicationTheme.Dark;
        }
    }
}
