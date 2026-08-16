// Licensed under the MIT License.

namespace SpaceAnalyzer.Settings;

/// <summary>
/// Centralised catalogue of every persisted settings key. Keeping the raw
/// string keys in one place removes the magic-string duplication that used to
/// be scattered across <c>SettingsViewModel</c>, <c>AIAssistantViewModel</c>,
/// <c>ScanViewModel</c>, <c>WorkflowsViewModel</c> and
/// <c>SmartSearchViewModel</c>. <see cref="AppSettings"/> is the typed,
/// default-aware access layer built on top of these keys.
/// </summary>
public static class SettingKeys
{
    // ── Appearance ──
    public const string Theme = "theme";

    // ── Scanner ──
    public const string ScannerPath = "scanner_path";
    public const string ScanDepth = "scan_depth";
    public const string IncludeHidden = "include_hidden";
    public const string GpuAcceleration = "gpu_acceleration";
    public const string UseFileCache = "use_file_cache";
    public const string DefaultScanPaths = "default_scan_paths";

    // ── Ollama / AI ──
    public const string OllamaUrl = "ollama_url";
    public const string OllamaModel = "ollama_model";
    public const string OllamaEnabled = "ollama_enabled";
    public const string OllamaThink = "ollama_think";
    public const string AgenticToolsEnabled = "agentic_tools_enabled";
    public const string AutoModelSelection = "auto_model_selection";
    public const string ToolCallingModel = "tool_calling_model";
    public const string ToolChoice = "tool_choice";

    // ── Global UI ──
    public const string AdvancedMode = "advanced_mode";

    // ── Smart Search (feature-scoped, namespaced to avoid colliding with the
    //    general keys above) ──
    public const string SsGroupByMode = "smartsearch.groupByMode";
    public const string SsSortBy = "smartsearch.sortBy";
    public const string SsMaxResults = "smartsearch.maxResults";
    public const string SsIncludeHidden = "smartsearch.includeHidden";
    public const string SsShowRawBytes = "smartsearch.showRawBytes";
    public const string SsCompactDensity = "smartsearch.compactDensity";
    public const string SsFollowSymlinks = "smartsearch.followSymlinks";
    public const string SsCollapseSmallGroups = "smartsearch.collapseSmallGroups";
    public const string SsOtherThresholdMb = "smartsearch.otherThresholdMb";
    public const string SsAdvancedMode = "smartsearch.advancedMode";
    public const string SsSemanticTopK = "smartsearch.semanticTopK";
}
