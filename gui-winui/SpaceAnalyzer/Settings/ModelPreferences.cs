// Licensed under the MIT License.

using System.Collections.Generic;
using System.Linq;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.Settings;

/// <summary>
/// Benchmark-derived model preferences for the AI Assistant.
///
/// The default chat model is no longer a hardcoded literal (e.g. gemma3:1b — which is
/// absent from the benchmark rankings entirely). Instead, when the user has not
/// explicitly chosen a model, the assistant auto-selects the best available model from
/// this ranking, evaluated against the models actually installed on the Ollama server.
///
/// The ordering mirrors the past benchmark results captured for the Space Analyzer
/// use cases (see scripts/utility/model_management.py): the AI Assistant is a
/// code/reasoning assistant, so the ranking merges the <c>code_analysis</c> and
/// <c>cleanup_recommendations</c> preferred-model lists, highest priority first.
/// Matching is by model family (the part before the first ':'), so e.g. an installed
/// <c>qwen3.5:8b</c> satisfies the <c>qwen3.5:4b</c> entry and is preferred over any
/// lower-ranked family.
/// </summary>
public static class ModelPreferences
{
    /// <summary>
    /// Preferred model families in priority order for the AI Assistant (code/reasoning).
    /// Lower index = higher priority.
    /// </summary>
    public static readonly IReadOnlyList<string> CodeReasoningRanking = new[]
    {
        "qwen3.5:4b",
        "qwen3.5:9b",
        "deepseek-r1:7b",
        "qwen2.5-coder:7b-instruct",
        "gemma4:e2b-it-qat",
        "llama3.2:3b",
    };

    /// <summary>
    /// Pick the best available model from <paramref name="installed"/> using the
    /// benchmark ranking, then tool capability, then model size as tie-breakers.
    /// Returns <c>null</c> when no models are installed.
    /// </summary>
    public static string? PickRecommended(IReadOnlyList<OllamaModelInfo> installed)
    {
        if (installed is null || installed.Count == 0)
            return null;

        string? best = null;
        int bestRank = int.MaxValue;
        bool bestTools = false;
        long bestSize = long.MaxValue;

        foreach (var m in installed)
        {
            int rank = RankOf(m.Name); // -1 if outside the benchmark ranking
            bool tools = m.Capabilities.Contains("tools");

            if (rank == -1)
                rank = int.MaxValue;

            if (rank < bestRank
                || (rank == bestRank && tools && !bestTools)
                || (rank == bestRank && tools == bestTools && m.Size < bestSize))
            {
                best = m.Name;
                bestRank = rank;
                bestTools = tools;
                bestSize = m.Size;
            }
        }

        return best;
    }

    /// <summary>
    /// Returns the ranking index for <paramref name="modelName"/> by family match, or
    /// -1 when the model's family is not present in <see cref="CodeReasoningRanking"/>.
    /// </summary>
    private static int RankOf(string modelName)
    {
        if (string.IsNullOrWhiteSpace(modelName))
            return -1;

        var family = modelName.Split(':')[0].Trim().ToLowerInvariant();
        for (int i = 0; i < CodeReasoningRanking.Count; i++)
        {
            var rankedFamily = CodeReasoningRanking[i].Split(':')[0].Trim().ToLowerInvariant();
            if (family == rankedFamily)
                return i;
        }
        return -1;
    }
}
