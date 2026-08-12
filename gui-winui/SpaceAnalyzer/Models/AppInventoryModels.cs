// Licensed under the MIT License.

using System.Collections.Generic;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A single discovered installation (one registry entry, package version, or toolchain).
/// Mirrors the JSON emitted by the Rust `app-inventory` subcommand.
/// </summary>
public class AppInstance
{
    public string Key { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Version { get; set; }
    public string? InstallLocation { get; set; }
    public string? Drive { get; set; }
    public ulong EstimatedSizeBytes { get; set; }
    public string? Publisher { get; set; }
    public string? UninstallString { get; set; }
    public string Source { get; set; } = string.Empty;

    public string VersionDisplay => string.IsNullOrWhiteSpace(Version) ? "?" : Version!;
    public string SizeDisplay => ByteFormatter.FormatBytes(EstimatedSizeBytes);
    public string LocationDisplay => InstallLocation ?? "<registry entry>";
    public bool HasUninstall => !string.IsNullOrWhiteSpace(UninstallString);
}

/// <summary>
/// A group of installations that share the same normalized identity.
/// </summary>
public class AppGroup
{
    public string Key { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public List<AppInstance> Instances { get; set; } = new();
    public int DistinctLocations { get; set; }
    public bool IsDuplicateLocation { get; set; }
    public List<string> Versions { get; set; } = new();
    public bool HasMultipleVersions { get; set; }
    public List<AppInstance> OlderVersions { get; set; } = new();
    public ulong TotalSizeBytes { get; set; }
    public string Safety { get; set; } = string.Empty;
    public bool Recoverable { get; set; }
    public string DeletionGuidance { get; set; } = string.Empty;

    public string TotalSizeDisplay => ByteFormatter.FormatBytes(TotalSizeBytes);
    public bool HasRedundancy => IsDuplicateLocation || HasMultipleVersions;
    public string RedundancyLabel =>
        IsDuplicateLocation && HasMultipleVersions ? "DUPLICATE LOCATION + MULTIPLE VERSIONS"
        : IsDuplicateLocation ? "DUPLICATE LOCATION"
        : HasMultipleVersions ? "MULTIPLE VERSIONS" : "";
}

/// <summary>
/// Top-level report from the `app-inventory` subcommand.
/// </summary>
public class AppInventoryReport
{
    public string GeneratedAt { get; set; } = string.Empty;
    public int TotalApps { get; set; }
    public List<AppGroup> Groups { get; set; } = new();
    public int DuplicateLocationGroups { get; set; }
    public int MultiVersionGroups { get; set; }
    public ulong TotalWastedBytes { get; set; }

    public string TotalWastedDisplay => ByteFormatter.FormatBytes(TotalWastedBytes);
    /// <summary>Groups worth surfacing first: anything with redundancy.</summary>
    public List<AppGroup> RedundantGroups => Groups.Where(g => g.HasRedundancy).ToList();
    public bool HasRedundancy => Groups.Any(g => g.HasRedundancy);
}
