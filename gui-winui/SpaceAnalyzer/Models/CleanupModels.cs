// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Risk level for a cleanup candidate.
/// </summary>
public enum RiskLevel { Low, Medium, High }

/// <summary>
/// A candidate directory flagged for potential cleanup.
/// </summary>
public class CleanupCandidate
{
    public string Path { get; set; } = string.Empty;
    public ulong Size { get; set; }
    public string Reason { get; set; } = string.Empty;
    public RiskLevel RiskLevel { get; set; }
    public string RiskLevelDisplay => RiskLevel.ToString();
    public string SizeDisplay => ByteFormatter.FormatBytes(Size);
    public SolidColorBrush RiskLevelBrush => RiskLevel switch
    {
        RiskLevel.Low => new SolidColorBrush(Microsoft.UI.Colors.Green),
        RiskLevel.Medium => new SolidColorBrush(Microsoft.UI.Colors.Gold),
        RiskLevel.High => new SolidColorBrush(Microsoft.UI.Colors.Red),
        _ => new SolidColorBrush(Microsoft.UI.Colors.Gray),
    };
}

/// <summary>
/// A package (e.g. a NuGet/npm package) found in multiple versions.
/// </summary>
public class DuplicatePackage
{
    public string Name { get; set; } = string.Empty;
    public List<string> Versions { get; set; } = new();
    public ulong TotalSize { get; set; }
    public List<string> Locations { get; set; } = new();
    public string TotalSizeDisplay => ByteFormatter.FormatBytes(TotalSize);
}

/// <summary>
/// Metadata for a discovered node_modules directory.
/// </summary>
public class ModuleInfo
{
    public string Path { get; set; } = string.Empty;
    public ulong Size { get; set; }
    public ulong FileCount { get; set; }
    public ulong DirectoryCount { get; set; }
    public DateTime? LastModified { get; set; }
    public string? PackageName { get; set; }
    public string? Version { get; set; }
    public string? CleanupReason { get; set; }
    public RiskLevel RiskLevel { get; set; }
    public string SizeDisplay => ByteFormatter.FormatBytes(Size);
    public string LastModifiedDisplay => LastModified.HasValue
        ? LastModified.Value.ToLocalTime().ToString("yyyy-MM-dd HH:mm")
        : "Unknown";
}

/// <summary>
/// Aggregated result of a node_modules cleanup analysis.
/// </summary>
public class CleanupAnalysis
{
    public ulong TotalSize { get; set; }
    public ulong TotalFiles { get; set; }
    public ulong TotalDirectories { get; set; }
    public ulong NodeModulesCount { get; set; }
    public List<ModuleInfo> LargestModules { get; set; } = new();
    public List<CleanupCandidate> CleanupCandidates { get; set; } = new();
    public List<DuplicatePackage> DuplicatePackages { get; set; } = new();
    public DateTime AnalysisTime { get; set; }
    public string TotalSizeDisplay => ByteFormatter.FormatBytes(TotalSize);
    public string TotalCleanupSizeDisplay => ByteFormatter.FormatBytes(
        (ulong)CleanupCandidates.Sum(c => (long)c.Size));
}
