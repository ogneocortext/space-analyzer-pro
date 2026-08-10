// Licensed under the MIT License.

using System.Collections.Generic;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A group of duplicate files sharing the same content hash.
/// </summary>
public class DuplicateGroup
{
    public string Hash { get; set; } = string.Empty;
    public ulong Size { get; set; }
    public long FileCount { get; set; }
    public List<string> Files { get; set; } = new();
    public ulong WastedBytes { get; set; }

    /// <summary>Transient UI flag: whether this group is selected for removal.</summary>
    public bool IsSelected { get; set; }

    public string WastedDisplay => ByteFormatter.FormatBytes(WastedBytes);
    public string SizeDisplay => ByteFormatter.FormatBytes(Size);

    /// <summary>A human-friendly representative name (first file's filename) for the group header.</summary>
    public string PrimaryName => System.IO.Path.GetFileName(Files.FirstOrDefault() ?? Hash);

    /// <summary>Short hash prefix for compact display.</summary>
    public string HashShort => Hash.Length > 8 ? Hash[..8] : Hash;
}

/// <summary>
/// Aggregated result of a deduplication analysis.
/// </summary>
public class DedupResult
{
    public List<DuplicateGroup> DuplicateGroups { get; set; } = new();
    public long TotalDuplicateFiles { get; set; }
    public ulong PotentialSavingsBytes { get; set; }
    public string PotentialSavingsDisplay => ByteFormatter.FormatBytes(PotentialSavingsBytes);

    // Populated only when deduplication is applied (hard links created).
    public int? FilesProcessed { get; set; }
    public ulong? SpaceSavedBytes { get; set; }
    public List<string>? Errors { get; set; }
    public string? SpaceSavedDisplay =>
        SpaceSavedBytes.HasValue ? ByteFormatter.FormatBytes(SpaceSavedBytes.Value) : null;
}
