// Licensed under the MIT License.

using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A duplicate-file analysis persisted against a scan history record. Mirrors the
/// <c>duplicate_analysis</c> SQLite row. <see cref="DuplicateGroupsJson"/> holds the
/// canonical <c>dedup::DuplicateGroup</c> wire shape (snake_case, matching the C#
/// <see cref="DuplicateGroup"/> under <see cref="s_groupOptions"/>), reconstituted
/// on demand via <see cref="Groups"/>.
/// </summary>
public class DuplicateAnalysisRecord
{
    // The stored groups JSON uses snake_case keys (the Rust `dedup::DuplicateGroup`
    // wire shape), so we must apply SnakeCaseLower — the same policy the rest of the
    // scanner JSON contract uses. Deserializing with default options would leave every
    // group's Hash/Size/Files blank.
    private static readonly JsonSerializerOptions s_groupOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public long Id { get; set; }
    public long ScanId { get; set; }

    private string _duplicateGroupsJson = "[]";
    public string DuplicateGroupsJson
    {
        get => _duplicateGroupsJson;
        set
        {
            if (_duplicateGroupsJson == value)
                return;
            _duplicateGroupsJson = value;
            _groups = null;
        }
    }

    public ulong PotentialSavingsBytes { get; set; }
    public string Timestamp { get; set; } = string.Empty;

    /// <summary>Human-readable potential savings, e.g. "1.2 GB".</summary>
    public string PotentialSavingsDisplay => ByteFormatter.FormatBytes(PotentialSavingsBytes);

    private List<DuplicateGroup>? _groups;

    /// <summary>
    /// The reconstituted duplicate groups. Returns an empty list when the stored JSON
    /// is missing or invalid (instead of throwing), so a single corrupt row can never
    /// break the Duplicates UI. Cached and invalidated when
    /// <see cref="DuplicateGroupsJson"/> changes.
    /// </summary>
    public List<DuplicateGroup> Groups
    {
        get
        {
            if (_groups is null)
            {
                try
                {
                    _groups = JsonSerializer.Deserialize<List<DuplicateGroup>>(_duplicateGroupsJson, s_groupOptions)
                              ?? new List<DuplicateGroup>();
                }
                catch (JsonException)
                {
                    _groups = new List<DuplicateGroup>();
                }
            }
            return _groups;
        }
    }

    /// <summary>Number of duplicate groups in this analysis.</summary>
    public int GroupCount => Groups.Count;
}
