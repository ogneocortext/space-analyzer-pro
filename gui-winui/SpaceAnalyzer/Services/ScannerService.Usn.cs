// Licensed under the MIT License.
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Services;

public partial class ScannerService
{
    public async Task<List<string>?> GetUsnVolumesAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new List<string>();

        var output = await RunScannerAsync(new[] { "usn", "volumes", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return new List<string>();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(output, s_jsonOptions) ?? new List<string>();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse USN volumes: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Show USN journal status for a drive via the Rust <c>usn status</c> subcommand.
    /// </summary>
    public async Task<UsnJournalInfo?> GetUsnStatusAsync(string? drive = null, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var argList = new List<string> { "usn", "status", "--format", "json" };
        if (!string.IsNullOrWhiteSpace(drive)) argList.Add(drive);
        var output = await RunScannerAsync(argList, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<UsnJournalInfo>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse USN status: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Read recent USN journal changes for a drive via the Rust
    /// <c>usn changes</c> subcommand.
    /// </summary>
    public async Task<ChangeSet?> GetUsnChangesAsync(string drive, int max = 1000, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "usn", "changes", drive, "--max", max.ToString(), "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<ChangeSet>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse USN changes: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Detect bloat candidates in a stored scan using the Rust <c>bloat</c>
    /// subcommand (offline_ai::FilePatternClassifier). Returns null when the
    /// scanner is unavailable or the command fails, so the caller can fall back
    /// to its local heuristic.
    /// </summary>
    public async Task<List<BloatFinding>?> GetBloatFindingsAsync(long? scanId = null, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var argList = new List<string> { "bloat", "--format", "json" };
        if (scanId.HasValue && scanId.Value > 0)
        {
            argList.Add("--scan-id");
            argList.Add(scanId.Value.ToString());
        }

        var output = await RunScannerAsync(argList, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.TryGetProperty("findings", out var findings))
                return findings.Deserialize<List<BloatFinding>>(s_jsonOptions) ?? new List<BloatFinding>();
            return new List<BloatFinding>();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse bloat findings: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Project future disk usage from the scan-history size trend via the Rust
    /// <c>predict</c> subcommand (linear regression over historical sizes).
    /// Returns null when the scanner is unavailable or the command fails, so the
    /// caller can fall back to its local heuristic.
    /// </summary>
}
