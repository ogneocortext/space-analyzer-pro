// Licensed under the MIT License.

using System.Collections.Generic;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Result of a directory scan, deserialized from the Rust CLI's JSON output.
/// </summary>
public class ScanResult
{
    public int TotalFiles { get; set; }
    public ulong TotalSizeBytes { get; set; }
    public double TotalSizeMb { get; set; }
    public double DurationSecs { get; set; }
    public Dictionary<string, int> FileTypes { get; set; } = new();
    public Dictionary<string, ulong> ExtensionSizes { get; set; } = new();
    // NOTE: The Rust CLI serializes `largest_files` as an array of [path, size] tuples,
    // e.g. [["C:\file", 1234], ...]. There is no matching object shape in C#, so we
    // intentionally omit this member; System.Text.Json ignores the unmapped key by default,
    // which keeps deserialization of the rest of the result from throwing.
    public List<string> Errors { get; set; } = new();
    public string Path { get; set; } = string.Empty;
    public ulong TotalDirs { get; set; }
    public List<DirEntry> TopDirectories { get; set; } = new();
    public List<string> EmptyDirs { get; set; } = new();
}

/// <summary>
/// A single directory entry with aggregated size and file/dir counts.
/// </summary>
public class DirEntry
{
    public string Path { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ulong TotalSize { get; set; }
    public ulong FileCount { get; set; }
    public ulong DirCount { get; set; }
}

/// <summary>
/// A single file entry with path and size.
/// </summary>
public class FileEntry
{
    public string Path { get; set; } = string.Empty;
    public ulong Size { get; set; }
}
