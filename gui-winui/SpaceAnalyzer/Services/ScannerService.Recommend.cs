// Licensed under the MIT License.
using System.Collections.Generic;
using System.Text.Json;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Services;

public partial class ScannerService
{
    /// <summary>
    /// Surface cleanup recommendations for a stored scan using the Rust
    /// <c>recommend</c> subcommand (the shared <c>render::build_recommendations</c>
    /// rule engine). Returns null when the scanner is unavailable or the command
    /// fails, so the caller can fall back to its local heuristic.
    /// </summary>
    public async Task<List<Recommendation>?> GetRecommendationsAsync(long? scanId = null, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var argList = new List<string> { "recommend", "--format", "json" };
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
            if (doc.RootElement.TryGetProperty("recommendations", out var recs))
            {
                var dtos = recs.Deserialize<List<RustRecommendationDto>>(s_jsonOptions) ?? new();
                var result = new List<Recommendation>();
                foreach (var dto in dtos)
                {
                    result.Add(new Recommendation
                    {
                        // Rust ranks severity 3 = most urgent (CRITICAL) … 1 = lowest,
                        // while the C# Recommendation.PriorityLabel treats 1 = High.
                        // Invert on ingest so the shared label/sort/colour stay correct.
                        Priority = dto.Priority switch
                        {
                            3 => 1,
                            2 => 2,
                            1 => 3,
                            _ => 2,
                        },
                        Title = dto.Message,
                        Detail = dto.Message,
                    });
                }
                return result;
            }
            return new List<Recommendation>();
        }
        catch (JsonException jex)
        {
            // Malformed backend output is treated as "no recommendations" so the
            // caller falls back to local heuristics (per the method contract).
            Console.Error.WriteLine($"[ScannerService] Failed to parse recommendations: {jex.Message}");
            return null;
        }
    }

    private sealed class RustRecommendationDto
    {
        public int Priority { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
