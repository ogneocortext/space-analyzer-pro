// Licensed under the MIT License.

using System;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Shows transient status toasts via the global <see cref="InfoBar"/> hosted in
/// <see cref="MainWindow"/>. Callable from any page or view model; marshals to
/// the UI thread automatically.
/// </summary>
public static class AppNotifications
{
    /// <summary>
    /// Show a transient notification.
    /// </summary>
    /// <param name="title">Headline text.</param>
    /// <param name="message">Optional detail line.</param>
    /// <param name="severity">Visual tone. <see cref="InfoBarSeverity.Warning"/> and
    /// <see cref="InfoBarSeverity.Error"/> are always shown; <see cref="InfoBarSeverity.Informational"/>
    /// and <see cref="InfoBarSeverity.Success"/> are suppressed when the user has turned off
    /// routine notifications in Settings (so failures can never be hidden silently).</param>
    /// <param name="durationSeconds">How long the toast stays before auto-hiding.</param>
    /// <param name="actionButtonText">When set with <paramref name="action"/>, renders a clickable
    /// button on the toast (e.g. "View").</param>
    /// <param name="action">Callback invoked when the action button is clicked.</param>
    public static void Show(string title, string? message = null,
        InfoBarSeverity severity = InfoBarSeverity.Informational, double durationSeconds = 6,
        string? actionButtonText = null, Action? action = null)
    {
        var window = MainWindow.Current;
        if (window is null) return;

        // Routine alerts (success / info) respect the user's notification preference.
        // Problems (warning / error) are never suppressed so failures stay visible.
        if (!AppSettings.NotificationsEnabled
            && severity is InfoBarSeverity.Informational or InfoBarSeverity.Success)
            return;

        window.DispatcherQueue.TryEnqueue(
            () => window.ShowNotification(title, message, severity, durationSeconds, actionButtonText, action));
    }

    public static void Success(string title, string? message = null, string? actionButtonText = null, Action? action = null)
        => Show(title, message, InfoBarSeverity.Success, actionButtonText: actionButtonText, action: action);

    public static void Error(string title, string? message = null, string? actionButtonText = null, Action? action = null)
        => Show(title, message, InfoBarSeverity.Error, actionButtonText: actionButtonText, action: action);

    public static void Warning(string title, string? message = null, string? actionButtonText = null, Action? action = null)
        => Show(title, message, InfoBarSeverity.Warning, actionButtonText: actionButtonText, action: action);
}
