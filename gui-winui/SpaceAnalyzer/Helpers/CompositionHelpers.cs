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
/// Provides fade-in/fade-out, staggered entrance, and hover-opacity effects
/// as drop-in replacements for the UWP-era theme transitions that were never
/// ported to WinUI 3.
///
/// All hover effects are tracked via <see cref="AnimationTracker"/> and
/// automatically cleaned up when the hosting page is unloaded.
/// </summary>
public static class CompositionHelpers
{
    // ── Core fade operations ──

    /// <summary>
    /// Fade an element in (opacity 0 → 1) and make it visible.
    /// </summary>
    public static async Task FadeInAsync(FrameworkElement element, double durationMs = AnimationConstants.DurationNormal)
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

    /// <summary>
    /// Fade an element out (opacity 1 → 0) and collapse it.
    /// </summary>
    public static async Task FadeOutAsync(FrameworkElement element, double durationMs = AnimationConstants.DurationNormal)
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

    /// <summary>
    /// Sequentially fade in a collection of elements with a configurable delay
    /// between each item. Returns a task that completes when all items have
    /// been animated.
    /// </summary>
    public static async Task StaggeredFadeInAsync(
        IEnumerable<FrameworkElement> elements,
        double durationMs = AnimationConstants.DurationNormal,
        double staggerMs = AnimationConstants.StaggerDelay)
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

    /// <summary>
    /// Fade an element to a specific opacity value (targetOpacity).
    /// Useful for dimming or highlighting without toggling visibility.
    /// </summary>
    public static void AnimateToOpacity(FrameworkElement element, float targetOpacity, double durationMs = AnimationConstants.DurationFast)
    {
        if (element is null) return;
        var visual = ElementCompositionPreview.GetElementVisual(element);
        var compositor = visual.Compositor;

        var animation = compositor.CreateScalarKeyFrameAnimation();
        animation.InsertKeyFrame(1f, targetOpacity);
        animation.Duration = TimeSpan.FromMilliseconds(durationMs);
        visual.StartAnimation("Opacity", animation);
    }

    // ── Hover effects (tracked for cleanup) ──

    /// <summary>
    /// Attach a hover-opacity effect to an element. The effect is tracked
    /// by <paramref name="tracker"/> and automatically removed when the
    /// tracker is cleaned up (typically on page unload).
    /// </summary>
    public static void AddHoverFade(
        FrameworkElement element,
        AnimationTracker tracker,
        float hoverOpacity = AnimationConstants.HoverOpacity,
        double durationMs = AnimationConstants.DurationFast)
    {
        if (element is null) return;

        var visual = ElementCompositionPreview.GetElementVisual(element);
        var compositor = visual.Compositor;

        var enterAnimation = compositor.CreateScalarKeyFrameAnimation();
        enterAnimation.InsertKeyFrame(1f, hoverOpacity);
        enterAnimation.Duration = TimeSpan.FromMilliseconds(durationMs);

        var exitAnimation = compositor.CreateScalarKeyFrameAnimation();
        exitAnimation.InsertKeyFrame(1f, AnimationConstants.RestOpacity);
        exitAnimation.Duration = TimeSpan.FromMilliseconds(durationMs);

        void OnPointerEntered(object s, Microsoft.UI.Xaml.Input.PointerRoutedEventArgs e)
            => visual.StartAnimation("Opacity", enterAnimation);

        void OnPointerExited(object s, Microsoft.UI.Xaml.Input.PointerRoutedEventArgs e)
            => visual.StartAnimation("Opacity", exitAnimation);

        element.PointerEntered += OnPointerEntered;
        element.PointerExited += OnPointerExited;

        // Track for cleanup
        tracker?.Track(element, () =>
        {
            element.PointerEntered -= OnPointerEntered;
            element.PointerExited -= OnPointerExited;
        });
    }

    /// <summary>
    /// Legacy overload — attaches hover effect without tracking.
    /// Prefer the tracked overload for page-scoped animations.
    /// </summary>
    public static void AddHoverFade(FrameworkElement element, float hoverOpacity = AnimationConstants.HoverOpacity, double durationMs = AnimationConstants.DurationFast)
    {
        AddHoverFade(element, null!, hoverOpacity, durationMs);
    }
}

/// <summary>
/// Tracks animation subscriptions (event handlers, composition objects)
/// for a scope (typically a page) so they can be bulk-cleaned on unload.
/// Use <see cref="AnimationTracker"/> in code-behind to avoid leaks.
/// </summary>
public sealed class AnimationTracker : IDisposable
{
    private readonly List<(WeakReference Element, Action Cleanup)> _tracked = new();
    private bool _disposed;

    /// <summary>
    /// Register a cleanup action for an element. When the tracker is
    /// disposed, the cleanup action is invoked (if the element is still alive).
    /// </summary>
    public void Track(FrameworkElement element, Action cleanup)
    {
        if (_disposed)
        {
            cleanup();
            return;
        }
        _tracked.Add((new WeakReference(element), cleanup));
    }

    /// <summary>
    /// Wire up the tracker to a page's Unloaded event so cleanup
    /// happens automatically when the page is removed from the visual tree.
    /// </summary>
    public void AttachToPage(Page page)
    {
        if (page is null) return;
        page.Unloaded += (_, _) => Dispose();
    }

    /// <summary>
    /// Invoke all registered cleanup actions and clear the list.
    /// </summary>
    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        foreach (var (elementRef, cleanup) in _tracked)
        {
            try { cleanup(); } catch { /* best-effort */ }
        }
        _tracked.Clear();
    }
}
