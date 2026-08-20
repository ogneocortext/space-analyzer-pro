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
    public async Task<CleanupAnalysis?> RunCleanupAnalysisAsync(
        string path,
        bool cleanup = false,
        ulong minSizeMb = 100,
        ulong unusedDays = 30,
        CancellationToken ct = default)
    {
        var cleanerPath = ResolveToolPath("node_modules_cleaner.exe", "SPACE_ANALYZER_CLEANER", null);
        if (!File.Exists(cleanerPath))
            return null;

        int scanId = ScanActivityMonitor.Instance.BeginScan(path);
        var tempOutput = Path.Combine(Path.GetTempPath(), $"nm_clean_{Guid.NewGuid():N}.json");
        try
        {
            var argList = new List<string> { path, "--output", tempOutput };
            if (cleanup) argList.Add("--cleanup");
            argList.Add("--min-size");
            argList.Add(minSizeMb.ToString());
            argList.Add("--unused-days");
            argList.Add(unusedDays.ToString());

            _cleanerStopCts?.Cancel();
            _cleanerStopCts?.Dispose();
            using var stopCts = new CancellationTokenSource();
            _cleanerStopCts = stopCts;

            var psi = ProcessRunner.CreateCliStartInfo(cleanerPath, argList);
            ProcessRunResult runResult;
            try
            {
                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, stopCts.Token);
                runResult = await ProcessRunner.RunAsync(psi, linkedCts.Token, s_cleanerTimeout);
            }
            finally
            {
                _cleanerStopCts = null;
            }

            if (runResult.ExitCode != 0)
            {
                if (!File.Exists(tempOutput))
                    throw new Exception($"Cleaner failed (exit {runResult.ExitCode}): {runResult.StdErr}");
            }

            if (!File.Exists(tempOutput))
                return null;

            var json = await File.ReadAllTextAsync(tempOutput, ct);
            try
            {
                return JsonSerializer.Deserialize<CleanupAnalysis>(json, s_jsonOptions);
            }
            catch (JsonException jex)
            {
                throw new Exception($"Failed to parse cleanup analysis: {jex.Message}. Output: {Truncate(json)}", jex);
            }
        }
        finally
        {
            if (File.Exists(tempOutput))
            {
                try { File.Delete(tempOutput); } catch { }
            }
            ScanActivityMonitor.Instance.EndScan(scanId);
        }
    }

    /// <summary>
    /// Analyze a single file's relationships and deletion impact via the
    /// Rust <c>dependencies</c> subcommand (file_relations::analyze_file_dependencies).
    /// </summary>
    public async Task<DependencyReport?> GetDependencyReportAsync(string path, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "dependencies", path, "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<DependencyReport>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse dependency report: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Generate and store semantic embeddings for a directory via the Rust
    /// <c>embed</c> subcommand. Returns the scan id the vectors are attached to
    /// (created when <paramref name="scanId"/> is null).
    /// </summary>
    public async Task<EmbedResult?> EmbedDirectoryAsync(
        string path,
        long? scanId = null,
        string? minSize = null,
        string? maxSize = null,
        bool includeHidden = false,
        bool ifNotIndexed = false,
        CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var argList = new List<string> { "embed", path, "--format", "json" };
        if (scanId.HasValue) { argList.Add("--scan-id"); argList.Add(scanId.Value.ToString()); }
        if (!string.IsNullOrWhiteSpace(minSize)) { argList.Add("--min-size"); argList.Add(minSize); }
        if (!string.IsNullOrWhiteSpace(maxSize)) { argList.Add("--max-size"); argList.Add(maxSize); }
        if (includeHidden) argList.Add("--include-hidden");
        // Skip the (expensive) Ollama embedding pass when the scan already has a
        // fresh index for the current model. Used by the AI assistant so repeat
        // queries in a session (and across sessions) reuse the existing index.
        if (ifNotIndexed) argList.Add("--if-not-indexed");

        var output = await RunScannerAsync(argList, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<EmbedResult>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse embed result: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Natural-language file search over a previously embedded scan via the Rust
    /// <c>semantic-search</c> subcommand. Returns ranked matches by similarity.
    /// </summary>
    public async Task<List<SemanticSearchResult>?> SemanticSearchAsync(
        string query,
        long scanId,
        int top = 20,
        double? minScore = null,
        CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var args = new List<string> { "semantic-search", query, "--scan-id", scanId.ToString(), "--top", top.ToString(), "--format", "json" };
        // Drop matches whose cosine similarity is below the requested floor.
        // A 0 (or unset) floor is treated as "no threshold" so it never filters.
        if (minScore is > 0.0)
            args.AddRange(new[] { "--min-score", minScore.Value.ToString(System.Globalization.CultureInfo.InvariantCulture) });
        var output = await RunScannerAsync(args, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.TryGetProperty("results", out var results))
                return results.Deserialize<List<SemanticSearchResult>>(s_jsonOptions) ?? new();
            // Tolerate a bare array response as well.
            return JsonSerializer.Deserialize<List<SemanticSearchResult>>(output, s_jsonOptions) ?? new();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse semantic search results: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// List volumes that expose an NTFS USN change journal via the Rust
    /// <c>usn volumes</c> subcommand.
    /// </summary>
}
