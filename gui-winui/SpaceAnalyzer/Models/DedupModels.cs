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
    public int FileCount { get; set; }
    public List<string> Files { get; set; } = new();
    public ulong WastedBytes { get; set; }
    public string WastedDisplay => ByteFormatter.FormatBytes(WastedBytes);
    public string SizeDisplay => ByteFormatter.FormatBytes(Size);
}

/// <summary>
/// Aggregated result of a deduplication analysis.
/// </summary>
public class DedupResult
{
    public List<DuplicateGroup> DuplicateGroups { get; set; } = new();
    public int TotalDuplicateFiles { get; set; }
    public ulong PotentialSavingsBytes { get; set; }
    public string PotentialSavingsDisplay => ByteFormatter.FormatBytes(PotentialSavingsBytes);
}
