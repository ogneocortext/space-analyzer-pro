// Licensed under the MIT License.

using System.Text.Json;
using System.Text.Json.Serialization;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Tests;

/// <summary>
/// Guards the JSON contract between the Rust CLI and the C# models. The WinUI 3
/// GUI consumes the scanner exclusively as a subprocess that emits snake_case
/// JSON; a field rename or type drift on either side would otherwise deserialize
/// to all-default (silent zeros). These tests pin the expected wire shape and the
/// exact serializer options ScannerService uses, so drift fails loudly in CI.
/// </summary>
public class ScannerContractTests
{
    // Mirrors ScannerService.s_jsonOptions / ScanHistoryRecord.ScannerJsonOptions.
    private static readonly JsonSerializerOptions s_options = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        Converters = { new JsonStringEnumConverter() },
    };

    private const string ScanJson = """
    {
      "total_files": 3,
      "total_size_bytes": 1500000,
      "total_size_mb": 1.43,
      "duration_secs": 0.5,
      "file_types": { "jpg": 1000000, "png": 500000 },
      "extension_sizes": { "jpg": 1000000, "png": 500000 },
      "category_sizes": { "Images": 1500000 },
      "largest_files": [ { "path": "C:/a.jpg", "size": 1000000 } ],
      "errors": [],
      "path": "C:/",
      "total_dirs": 2,
      "top_directories": [ { "path": "C:/sub", "name": "sub", "total_size": 1500000, "file_count": 3, "dir_count": 1 } ],
      "empty_dirs": [],
      "potential_cleanup_bytes": 100,
      "timestamp": "2026-08-11T00:00:00Z",
      "scanned_files": { "C:/a.jpg": [1000000, 1700000000] }
    }
    """;

    [Fact]
    public void ScanResult_Deserializes_FullContract()
    {
        var result = JsonSerializer.Deserialize<ScanResult>(ScanJson, s_options);

        Assert.NotNull(result);
        Assert.Equal(3, result!.TotalFiles);
        Assert.Equal(1500000UL, result.TotalSizeBytes);
        Assert.Equal(1.43, result.TotalSizeMb, 2);
        Assert.Equal("C:/", result.Path);
        Assert.Equal(2UL, result.TotalDirs);
        Assert.Equal(100UL, result.PotentialCleanupBytes);

        // file_types must not silently zero on large byte totals (was Dictionary<string,int>).
        Assert.Equal(1000000L, result.FileTypes["jpg"]);
        Assert.Equal(500000L, result.FileTypes["png"]);

        Assert.Equal(1500000UL, result.CategorySizes["Images"]);
        Assert.Equal(1000000UL, result.ExtensionSizes["jpg"]);
        Assert.Single(result.LargestFiles);
        Assert.Equal(1000000UL, result.LargestFiles[0].Size);
        Assert.Single(result.TopDirectories);
        Assert.Equal(1500000UL, result.TopDirectories[0].TotalSize);
    }

    [Fact]
    public void ScanResult_ScannedFiles_UsesArrayConverter()
    {
        var result = JsonSerializer.Deserialize<ScanResult>(ScanJson, s_options);

        Assert.NotNull(result);
        Assert.True(result!.ScannedFiles.ContainsKey("C:/a.jpg"));
        var entry = result.ScannedFiles["C:/a.jpg"];
        Assert.Equal(1000000UL, entry.Size);
        Assert.Equal(1700000000L, entry.Mtime);
    }

    [Fact]
    public void StreamComplete_FileTypes_DoesNotOverflow_OnLargeTotals()
    {
        // 3_000_000_000 exceeds int.MaxValue; with the old Dictionary<string,int>
        // this threw during JSON parse and the streaming reader swallowed it,
        // dropping the final scan result. Long must hold it.
        const string completeJson = """
        {
          "type": "complete",
          "total_files": 3,
          "total_size_bytes": 3000000000,
          "total_size_mb": 2861.0,
          "duration_secs": 1.0,
          "file_types": { "big": 3000000000 },
          "extension_sizes": { "big": 3000000000 },
          "category_sizes": { "Other": 3000000000 },
          "largest_files": [],
          "errors": [],
          "path": "C:/",
          "total_dirs": 1,
          "top_directories": [],
          "empty_dirs": [],
          "potential_cleanup_bytes": 0,
          "timestamp": "2026-08-11T00:00:00Z"
        }
        """;

        var complete = JsonSerializer.Deserialize<StreamComplete>(completeJson, s_options);

        Assert.NotNull(complete);
        Assert.Equal(3000000000L, complete!.FileTypes["big"]);
        Assert.Equal(3000000000UL, complete.TotalSizeBytes);
    }
}
