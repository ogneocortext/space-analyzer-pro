// Licensed under the MIT License.

namespace SpaceAnalyzer;

/// <summary>
/// Single source of truth for the WinUI frontend's display version.
/// The Rust core (Cargo.toml) is the canonical release version; for a
/// coordinated release keep this in sync with it. Packaging derives the
/// distributed filename from Cargo.toml automatically, so only this constant
/// and Cargo.toml need to be edited when bumping the version.
/// </summary>
public static class AppInfo
{
    public const string Version = "4.2.0";
    public static string VersionDisplay => "Version " + Version;
    public static string WindowTitle => "Space Analyzer Pro v" + Version;
}
