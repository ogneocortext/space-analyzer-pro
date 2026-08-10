// Licensed under the MIT License.

using System.Collections.Generic;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A single file related to a target (same stem, sibling, symlink source, or
/// potential duplicate). Mirrors the Rust <c>RelatedFile</c> from
/// <c>file_relations::analyze_file_dependencies</c>.
/// </summary>
public class RelatedFile
{
    public string Path { get; set; } = string.Empty;
    public string Relation { get; set; } = string.Empty;
    public ulong Size { get; set; }
    public string Modified { get; set; } = string.Empty;
}

/// <summary>
/// Deletion-impact report for a single file. Returned by the Rust
/// <c>dependencies</c> CLI subcommand (file_relations::DependencyReport).
/// </summary>
public class DependencyReport
{
    public string TargetPath { get; set; } = string.Empty;
    public bool TargetExists { get; set; }
    public bool TargetIsDir { get; set; }
    public ulong TargetSize { get; set; }
    public string TargetModified { get; set; } = string.Empty;
    public bool IsSymlink { get; set; }
    public string? SymlinkTarget { get; set; }
    public ulong HardlinkCount { get; set; }
    public List<RelatedFile> SameStemFiles { get; set; } = new();
    public List<RelatedFile> SiblingFiles { get; set; } = new();
    public List<RelatedFile> SymlinkSources { get; set; } = new();
    public int TotalRelated { get; set; }
    public string Summary { get; set; } = string.Empty;
}

/// <summary>NTFS USN journal metadata for a volume. Rust <c>UsnJournalInfo</c>.</summary>
public class UsnJournalInfo
{
    public string VolumePath { get; set; } = string.Empty;
    public ulong UsnJournalId { get; set; }
    public long NextUsn { get; set; }
    public long LowestUsn { get; set; }
    public long MaxUsn { get; set; }
    public ulong JournalSize { get; set; }
    public ulong AllocationDelta { get; set; }
}

/// <summary>A single USN change record. Rust <c>UsnRecord</c>.</summary>
public class UsnRecord
{
    public ulong FileReference { get; set; }
    public ulong ParentFileReference { get; set; }
    public long Usn { get; set; }
    public ulong Timestamp { get; set; }
    public uint Reason { get; set; }
    public uint FileAttributes { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string ChangeType { get; set; } = string.Empty;
}

/// <summary>A batch of USN change records read from a volume. Rust <c>ChangeSet</c>.</summary>
public class ChangeSet
{
    public string VolumePath { get; set; } = string.Empty;
    public long StartUsn { get; set; }
    public long EndUsn { get; set; }
    public List<UsnRecord> Changes { get; set; } = new();
    public ulong Timestamp { get; set; }
    public int TotalChanges { get; set; }
}

/// <summary>Result of the <c>embed</c> CLI subcommand.</summary>
public class EmbedResult
{
    public long ScanId { get; set; }
    public int Embedded { get; set; }
    public string Model { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
}

/// <summary>A single semantic search hit (file + cosine similarity).</summary>
public class SemanticSearchResult
{
    public string FilePath { get; set; } = string.Empty;
    public ulong FileSize { get; set; }
    public string FileExtension { get; set; } = string.Empty;
    public float Similarity { get; set; }
    public string SizeDisplay => ByteFormatter.FormatBytes(FileSize);
    public string SimilarityDisplay => $"{Similarity * 100.0f:F1}%";
    public string Name => System.IO.Path.GetFileName(FilePath);
}
