// Licensed under the MIT License.

using System.Text.Json.Serialization;

namespace SpaceAnalyzer.Models;

/// <summary>
/// One calendar day that has at least one scan-history record, with the number
/// of scans performed that day. Returned by the Rust CLI <c>history --calendar</c>
/// subcommand and used to highlight scan days on the History page calendar.
/// </summary>
public class ScanDayCount
{
    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;

    [JsonPropertyName("count")]
    public int Count { get; set; }
}
