// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Risk level for a cleanup candidate.
/// </summary>
public enum RiskLevel { Low, Medium, High }

/// <summary>
/// Which cleanup engine the Cleanup page is using.
/// </summary>
public enum CleanupMode { NodeModules, TempCaches }

/// <summary>
/// A top-level entry (directory or loose file) discovered in a temp/cache folder,
/// presented for manual selection before deletion.
/// </summary>
public class TempCleanupEntry : INotifyPropertyChanged
{
    private bool _isSelected;
    public string Path { get; set; } = string.Empty;
    public string Name => System.IO.Path.GetFileName(Path.TrimEnd('\\', '/'));
    public bool IsDirectory { get; set; }
    public ulong SizeBytes { get; set; }
    public DateTime LastWrite { get; set; }
    public bool IsSelected
    {
        get => _isSelected;
        set { _isSelected = value; OnPropertyChanged(); }
    }
    public string SizeDisplay => ByteFormatter.FormatBytes(SizeBytes);
    public string LastWriteDisplay => LastWrite.ToLocalTime().ToString("yyyy-MM-dd HH:mm");

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

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
        RiskLevel.Low => GetThemeBrush("SuccessBrush"),
        RiskLevel.Medium => GetThemeBrush("WarningBrush"),
        RiskLevel.High => GetThemeBrush("ErrorBrush"),
        _ => GetThemeBrush("MutedBrush"),
    };

    private static SolidColorBrush GetThemeBrush(string key)
        => Application.Current.Resources[key] as SolidColorBrush
           ?? new SolidColorBrush(Microsoft.UI.Colors.Gray);
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
        checked(CleanupCandidates.Aggregate(0UL, (sum, c) => sum + c.Size)));
}
