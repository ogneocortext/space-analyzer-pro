// Licensed under the MIT License.

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Shared animation timing constants used across all pages.
/// Centralizes duration and stagger values so they can be tuned in one place.
/// </summary>
public static class AnimationConstants
{
    // ── Durations (ms) ──

    /// <summary>Fast animation for micro-interactions (hover, button press).</summary>
    public const double DurationFast = 100;

    /// <summary>Normal animation for content transitions (fade-in, fade-out).</summary>
    public const double DurationNormal = 200;

    /// <summary>Slow animation for page-level entrance effects.</summary>
    public const double DurationSlow = 350;

    // ── Stagger delays (ms) ──

    /// <summary>Delay between consecutive items in a staggered animation.</summary>
    public const double StaggerDelay = 40;

    /// <summary>Delay for fast staggered animations (stat cards).</summary>
    public const double StaggerDelayFast = 30;

    // ── Hover effects ──

    /// <summary>Opacity when hovering over interactive elements.</summary>
    public const float HoverOpacity = 0.90f;

    /// <summary>Default opacity for elements at rest.</summary>
    public const float RestOpacity = 1.0f;

    // ── Page entrance offsets (for EntranceThemeTransition) ──

    /// <summary>Default vertical offset for entrance animations (points).</summary>
    public const double EntranceOffsetY = 20;

    /// <summary>Default horizontal offset for entrance animations (points).</summary>
    public const double EntranceOffsetX = 0;
}
