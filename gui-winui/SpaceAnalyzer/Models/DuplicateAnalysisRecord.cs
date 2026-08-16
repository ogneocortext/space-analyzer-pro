// Licensed under the MIT License.

using System.Collections.Generic;
using System.Text.Json;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A duplicate-file analysis persisted against a scan history record. Mirrors the
/// <c>duplicate_analysis</c> SQLite row. <see cref="DuplicateGroupsJson"/> holds the
/// canonical <c>dedup::DuplicateGroup</c> wire shape (matching the C# <see cref="DuplicateGroup"/>),
/// reconstituted on demand via <see cref="Groups"/>.
/// </summary>
public class DuplicateAnalysisRecord
{
    public long Id { get; set; }
    public long ScanId { get; set; }

    public string DuplicateGroupsJson { get; set; } = "[]";

    public ulong PotentialSavingsBytes { get; set; }
    public string Timestamp { get; set; } = string.Empty;

    /// <summary>Human-readable potential savings, e.g. "1.2 GB".</summary>
    public string PotentialSavingsDisplay => ByteFormatter.FormatBytes(PotentialSavingsBytes);

    /// <summary>The reconstituted duplicate groups (empty when the stored JSON is missing/invalid).</summary>
    public List<DuplicateGroup> Groups =>
        JsonSerializer.Deserialize<List<DuplicateGroup>>(DuplicateGroupsJson) ?? new List<DuplicateGroup>();

    /// <summary>Number of duplicate groups in this analysis.</summary>
    public int GroupCount => Groups.Count;
}
