// Licensed under the MIT License.

using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Centralized animation orchestrator for pages.
/// Provides one-call methods that apply consistent animation patterns
/// across the entire app. Pages call into this instead of directly using
/// <see cref="CompositionHelpers"/> to ensure uniform behavior.
/// </summary>
public static class AnimationManager
{
    // ── Dashboard stat cards ──

    /// <summary>
    /// Animate the dashboard stat cards with a staggered fade-in.
    /// Called after data loads and on manual refresh.
    /// </summary>
    public static Task AnimateDashboardCardsAsync(
        FrameworkElement card1,
        FrameworkElement card2,
        FrameworkElement card3,
        FrameworkElement card4)
    {
        return CompositionHelpers.StaggeredFadeInAsync(
            new[] { card1, card2, card3, card4 },
            AnimationConstants.DurationNormal,
            AnimationConstants.StaggerDelayFast);
    }

    // ── Page content entrance ──

    /// <summary>
    /// Animate a collection of content sections (Borders, StackPanels, etc.)
    /// with a staggered fade-in when they first appear on the page.
    /// </summary>
    public static Task AnimateContentEntranceAsync(params FrameworkElement[] elements)
    {
        return CompositionHelpers.StaggeredFadeInAsync(
            elements,
            AnimationConstants.DurationNormal,
            AnimationConstants.StaggerDelay);
    }

    // ── Results panel ──

    /// <summary>
    /// Animate a results panel that just became visible (e.g. scan results,
    /// analysis results). Uses a single fade-in since it's one container.
    /// </summary>
    public static Task AnimateResultsAppearAsync(FrameworkElement resultsPanel)
    {
        return CompositionHelpers.FadeInAsync(resultsPanel, AnimationConstants.DurationSlow);
    }

    // ── Hover effects batch ──

    /// <summary>
    /// Attach hover-opacity effects to a batch of interactive elements
    /// (buttons, cards) with tracking for cleanup on page unload.
    /// </summary>
    public static void SetupHoverEffects(AnimationTracker tracker, params FrameworkElement[] elements)
    {
        foreach (var el in elements)
        {
            CompositionHelpers.AddHoverFade(el, tracker,
                AnimationConstants.HoverOpacity,
                AnimationConstants.DurationFast);
        }
    }

    // ── Refresh animation ──

    /// <summary>
    /// Quick re-entrance animation for a refresh action. Fades out then
    /// fades back in to signal the data was refreshed.
    /// </summary>
    public static async Task AnimateRefreshAsync(FrameworkElement element)
    {
        await CompositionHelpers.FadeOutAsync(element, AnimationConstants.DurationFast);
        await CompositionHelpers.FadeInAsync(element, AnimationConstants.DurationFast);
    }
}
