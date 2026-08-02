// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.UI.Composition;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Hosting;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Composition-based animation helpers for Windows App SDK 2.3 / WinUI 3.
/// Provides fade-in/fade-out and hover-opacity effects as drop-in
/// replacements for the UWP-era <c>FadeThemeTransition</c> and
/// <c>PointerOverThemeTransition</c> which were never ported to WinUI 3.
/// </summary>
public static class CompositionHelpers
{
    // ── Fade in ──────────────────────────────────────────────────────

    /// <summary>
    /// Animates <paramref name="element"/> opacity from 0 to 1 over <paramref name="durationMs"/>.
    /// </summary>
    public static async Task FadeInAsync(FrameworkElement element, double durationMs = 150)
    {
        if (element is null) return;

        var visual = ElementCompositionPreview.GetElementVisual(element);
        var compositor = visual.Compositor;

        element.Visibility = Visibility.Visible;
        visual.Opacity = 0f;

        var animation = compositor.CreateScalarKeyFrameAnimation();
        animation.InsertKeyFrame(1f, 1f);
        animation.Duration = TimeSpan.FromMilliseconds(durationMs);

        visual.StartAnimation("Opacity", animation);
        await Task.Delay(TimeSpan.FromMilliseconds(durationMs));
    }

    // ── Fade out ────────────────────────────────────────────────────

    /// <summary>
    /// Animates <paramref name="element"/> opacity from 1 to 0 over <paramref name="durationMs"/>
    /// and collapses it when finished.
    /// </summary>
    public static async Task FadeOutAsync(FrameworkElement element, double durationMs = 150)
    {
        if (element is null) return;

        var visual = ElementCompositionPreview.GetElementVisual(element);
        var compositor = visual.Compositor;

        visual.Opacity = 1f;

        var animation = compositor.CreateScalarKeyFrameAnimation();
        animation.InsertKeyFrame(1f, 0f);
        animation.Duration = TimeSpan.FromMilliseconds(durationMs);

        visual.StartAnimation("Opacity", animation);
        await Task.Delay(TimeSpan.FromMilliseconds(durationMs));

        element.Visibility = Visibility.Collapsed;
        visual.Opacity = 0f;
    }

    // ── Staggered fade ───────────────────────────────────────────────

    /// <summary>
    /// Fades in each element sequentially with a <paramref name="staggerMs"/> delay
    /// between starts, producing a cascading entrance effect.
    /// </summary>
    public static async Task StaggeredFadeInAsync(
        IEnumerable<FrameworkElement> elements,
        double durationMs = 150,
        double staggerMs = 30)
    {
        var list = elements.Where(e => e is not null).ToList();

        for (int i = 0; i < list.Count; i++)
        {
            var element = list[i];
            if (element is null) continue;

            if (i > 0)
                await Task.Delay(TimeSpan.FromMilliseconds(staggerMs));

            await FadeInAsync(element, durationMs);
        }
    }

    // ── Hover opacity ────────────────────────────────────────────────

    /// <summary>
    /// Adds a fade-to-opacity hover effect to <paramref name="element"/>.
    /// On pointer-enter the element fades to <paramref name="hoverOpacity"/>,
    /// on pointer-exit it fades back to full opacity.
    /// </summary>
    public static void AddHoverFade(FrameworkElement element, float hoverOpacity = 0.85f, double durationMs = 100)
    {
        if (element is null) return;

        var visual = ElementCompositionPreview.GetElementVisual(element);
        var compositor = visual.Compositor;

        var enterAnimation = compositor.CreateScalarKeyFrameAnimation();
        enterAnimation.InsertKeyFrame(1f, hoverOpacity);
        enterAnimation.Duration = TimeSpan.FromMilliseconds(durationMs);

        var exitAnimation = compositor.CreateScalarKeyFrameAnimation();
        exitAnimation.InsertKeyFrame(1f, 1f);
        exitAnimation.Duration = TimeSpan.FromMilliseconds(durationMs);

        element.PointerEntered += (s, e) => visual.StartAnimation("Opacity", enterAnimation);
        element.PointerExited += (s, e) => visual.StartAnimation("Opacity", exitAnimation);
    }
}
