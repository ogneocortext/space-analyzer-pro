// Licensed under the MIT License.

using System.Globalization;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.Settings;

/// <summary>
/// The single typed access layer for application settings. Every ViewModel
/// reads and writes settings through this class, so the key names, their
/// canonical defaults, and the persistence path (the embedded DB via
/// <see cref="SettingsStore"/>) live in exactly one place. This makes the
/// Settings page the authoritative source of truth and removes the duplicated
/// field/key/default literals that previously lived in each ViewModel.
///
/// Property setters persist immediately through <see cref="SettingsStore.Set"/>,
/// which also raises <see cref="SettingsStore.SettingsChanged"/> so other
/// consumers can react without polling.
/// </summary>
public static class AppSettings
{
    /// <summary>
    /// Canonical default values for every setting. The only place the default
    /// literals live — both the getters (via <c>?? Defaults.X</c>) and
    /// <see cref="ResetToDefaults"/> read from here, so the two can never drift.
    /// </summary>
    public static class Defaults
    {
        public const string Theme = "Dark";
        public const string ScannerPath = "";
        public const double ScanDepth = 5;
        public const bool IncludeHidden = false;
        public const bool GpuAcceleration = true;
        public const string DefaultScanPaths = "";
        public const string OllamaUrl = "http://localhost:11434";
        // Empty string = "auto": when unset, the AI Assistant picks the best available
        // model from the benchmark-derived ranking (see ModelPreferences) at runtime.
        public const string OllamaModel = "";
        public const bool OllamaEnabled = true;
        public const bool OllamaThink = true;
        public const bool AgenticToolsEnabled = true;
        public const bool AutoModelSelection = true;
        public const string ToolCallingModel = "qwen2.5-coder:7b";
        public const string ToolChoice = "auto";
        public const bool AdvancedMode = false;
    }

    // ── Appearance ──

    public static string Theme
    {
        get => SettingsStore.Get(SettingKeys.Theme) ?? Defaults.Theme;
        set => SettingsStore.Set(SettingKeys.Theme, value);
    }

    // ── Scanner ──

    public static string ScannerPath
    {
        get => SettingsStore.Get(SettingKeys.ScannerPath) ?? Defaults.ScannerPath;
        set => SettingsStore.Set(SettingKeys.ScannerPath, value);
    }

    public static double ScanDepth
    {
        get
        {
            var raw = SettingsStore.Get(SettingKeys.ScanDepth);
            return double.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : Defaults.ScanDepth;
        }
        set => SettingsStore.Set(SettingKeys.ScanDepth, value.ToString(CultureInfo.InvariantCulture));
    }

    public static bool IncludeHidden
    {
        get => SettingsStore.GetBool(SettingKeys.IncludeHidden, Defaults.IncludeHidden);
        set => SettingsStore.SetBool(SettingKeys.IncludeHidden, value);
    }

    public static bool GpuAcceleration
    {
        get => SettingsStore.GetBool(SettingKeys.GpuAcceleration, Defaults.GpuAcceleration);
        set => SettingsStore.SetBool(SettingKeys.GpuAcceleration, value);
    }

    public static string DefaultScanPaths
    {
        get => SettingsStore.Get(SettingKeys.DefaultScanPaths) ?? Defaults.DefaultScanPaths;
        set => SettingsStore.Set(SettingKeys.DefaultScanPaths, value);
    }

    // ── Ollama / AI ──

    public static string OllamaUrl
    {
        get => SettingsStore.Get(SettingKeys.OllamaUrl) ?? Defaults.OllamaUrl;
        set => SettingsStore.Set(SettingKeys.OllamaUrl, value);
    }

    public static string OllamaModel
    {
        get => SettingsStore.Get(SettingKeys.OllamaModel) ?? Defaults.OllamaModel;
        set => SettingsStore.Set(SettingKeys.OllamaModel, value);
    }

    public static bool OllamaEnabled
    {
        get => SettingsStore.GetBool(SettingKeys.OllamaEnabled, Defaults.OllamaEnabled);
        set => SettingsStore.SetBool(SettingKeys.OllamaEnabled, value);
    }

    public static bool OllamaThink
    {
        get => SettingsStore.GetBool(SettingKeys.OllamaThink, Defaults.OllamaThink);
        set => SettingsStore.SetBool(SettingKeys.OllamaThink, value);
    }

    public static bool AgenticToolsEnabled
    {
        get => SettingsStore.GetBool(SettingKeys.AgenticToolsEnabled, Defaults.AgenticToolsEnabled);
        set => SettingsStore.SetBool(SettingKeys.AgenticToolsEnabled, value);
    }

    public static bool AutoModelSelection
    {
        get => SettingsStore.GetBool(SettingKeys.AutoModelSelection, Defaults.AutoModelSelection);
        set => SettingsStore.SetBool(SettingKeys.AutoModelSelection, value);
    }

    public static string ToolCallingModel
    {
        get => SettingsStore.Get(SettingKeys.ToolCallingModel) ?? Defaults.ToolCallingModel;
        set => SettingsStore.Set(SettingKeys.ToolCallingModel, value);
    }

    public static string ToolChoice
    {
        get => SettingsStore.Get(SettingKeys.ToolChoice) ?? Defaults.ToolChoice;
        set => SettingsStore.Set(SettingKeys.ToolChoice, value);
    }

    // ── Global UI ──

    public static bool AdvancedMode
    {
        get => SettingsStore.GetBool(SettingKeys.AdvancedMode, Defaults.AdvancedMode);
        set => SettingsStore.SetBool(SettingKeys.AdvancedMode, value);
    }

    /// <summary>
    /// Resets every setting to its canonical default (see <see cref="Defaults"/>).
    /// Each assignment persists immediately and raises
    /// <see cref="SettingsStore.SettingsChanged"/> so all consumers react. Because
    /// the default literals live only in <see cref="Defaults"/>, this stays in sync
    /// with the getters and eliminates the duplication with the Settings page reset.
    /// </summary>
    public static void ResetToDefaults()
    {
        Theme = Defaults.Theme;
        ScannerPath = Defaults.ScannerPath;
        ScanDepth = Defaults.ScanDepth;
        IncludeHidden = Defaults.IncludeHidden;
        GpuAcceleration = Defaults.GpuAcceleration;
        DefaultScanPaths = Defaults.DefaultScanPaths;
        OllamaUrl = Defaults.OllamaUrl;
        OllamaModel = Defaults.OllamaModel;
        OllamaEnabled = Defaults.OllamaEnabled;
        OllamaThink = Defaults.OllamaThink;
        AgenticToolsEnabled = Defaults.AgenticToolsEnabled;
        AutoModelSelection = Defaults.AutoModelSelection;
        ToolCallingModel = Defaults.ToolCallingModel;
        ToolChoice = Defaults.ToolChoice;
        AdvancedMode = Defaults.AdvancedMode;
    }
}
