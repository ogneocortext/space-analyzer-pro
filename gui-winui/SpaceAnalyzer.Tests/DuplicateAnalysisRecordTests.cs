// Licensed under the MIT License.

using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Tests;

/// <summary>
/// Regression tests for <see cref="DuplicateAnalysisRecord.Groups"/>: the stored
/// <c>duplicate_groups_json</c> uses snake_case keys (the Rust dedup wire shape), so
/// deserialization must apply <see cref="System.Text.Json.Serialization.JsonNamingPolicy.SnakeCaseLower"/>;
/// it must also tolerate corrupt JSON and cache/invalidate correctly.
/// </summary>
public class DuplicateAnalysisRecordTests
{
    private const string SampleSnakeCase =
        "[{\"hash\":\"abc123\",\"size\":1024,\"file_count\":3," +
        "\"files\":[\"C:/a.txt\",\"C:/b.txt\",\"C:/c.txt\"],\"wasted_bytes\":2048}]";

    [Fact]
    public void Groups_Deserializes_SnakeCase_Keys()
    {
        var rec = new DuplicateAnalysisRecord { DuplicateGroupsJson = SampleSnakeCase };

        Assert.Equal(1, rec.GroupCount);
        var g = rec.Groups[0];
        Assert.Equal("abc123", g.Hash);
        Assert.Equal(1024UL, g.Size);
        Assert.Equal(3, g.FileCount);
        Assert.Equal(3, g.Files.Count);
        Assert.Equal(2048UL, g.WastedBytes);
    }

    [Fact]
    public void Groups_ReturnsEmpty_OnInvalidJson_InsteadOfThrowing()
    {
        var rec = new DuplicateAnalysisRecord { DuplicateGroupsJson = "{not valid json" };

        var ex = Record.Exception(() => _ = rec.Groups);
        Assert.Null(ex);
        Assert.Empty(rec.Groups);
        Assert.Equal(0, rec.GroupCount);
    }

    [Fact]
    public void Groups_IsCached_And_Invalidated_WhenJsonChanges()
    {
        var rec = new DuplicateAnalysisRecord { DuplicateGroupsJson = SampleSnakeCase };
        var first = rec.Groups;
        Assert.Same(first, rec.Groups);

        rec.DuplicateGroupsJson = "[]";
        Assert.Empty(rec.Groups);
        Assert.Equal(0, rec.GroupCount);
    }

    [Fact]
    public void PotentialSavingsDisplay_FormatsBytes()
    {
        var rec = new DuplicateAnalysisRecord { PotentialSavingsBytes = 1024 };
        Assert.Contains("KB", rec.PotentialSavingsDisplay);
        Assert.False(string.IsNullOrEmpty(rec.PotentialSavingsDisplay));
    }
}
