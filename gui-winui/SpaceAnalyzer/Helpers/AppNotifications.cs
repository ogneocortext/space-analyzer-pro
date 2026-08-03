// Licensed under the MIT License.

using System;
using Microsoft.UI.Xaml.Controls;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Shows transient status toasts via the global <see cref="InfoBar"/> hosted in
/// <see cref="MainWindow"/>. Callable from any page or view model; marshals to
/// the UI thread automatically.
/// </summary>
public static class AppNotifications
{
    public static void Show(string title, string? message = null, InfoBarSeverity severity = InfoBarSeverity.Informational, double durationSeconds = 6)
    {
        var window = MainWindow.Current;
        if (window is null) return;
        window.DispatcherQueue.TryEnqueue(() => window.ShowNotification(title, message, severity, durationSeconds));
    }

    public static void Success(string title, string? message = null)
        => Show(title, message, InfoBarSeverity.Success);

    public static void Error(string title, string? message = null)
        => Show(title, message, InfoBarSeverity.Error);

    public static void Warning(string title, string? message = null)
        => Show(title, message, InfoBarSeverity.Warning);
}
