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
    // ── Appearance ──

    public static string Theme
    {
        get => SettingsStore.Get(SettingKeys.Theme) ?? "Dark";
        set => SettingsStore.Set(SettingKeys.Theme, value);
    }

    // ── Scanner ──

    public static string ScannerPath
    {
        get => SettingsStore.Get(SettingKeys.ScannerPath) ?? string.Empty;
        set => SettingsStore.Set(SettingKeys.ScannerPath, value);
    }

    public static double ScanDepth
    {
        get
        {
            var raw = SettingsStore.Get(SettingKeys.ScanDepth);
            return double.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 5;
        }
        set => SettingsStore.Set(SettingKeys.ScanDepth, value.ToString(CultureInfo.InvariantCulture));
    }

    public static bool IncludeHidden
    {
        get => SettingsStore.GetBool(SettingKeys.IncludeHidden);
        set => SettingsStore.SetBool(SettingKeys.IncludeHidden, value);
    }

    public static bool GpuAcceleration
    {
        get => SettingsStore.GetBool(SettingKeys.GpuAcceleration, true);
        set => SettingsStore.SetBool(SettingKeys.GpuAcceleration, value);
    }

    public static string DefaultScanPaths
    {
        get => SettingsStore.Get(SettingKeys.DefaultScanPaths) ?? string.Empty;
        set => SettingsStore.Set(SettingKeys.DefaultScanPaths, value);
    }

    // ── Ollama / AI ──

    public static string OllamaUrl
    {
        get => SettingsStore.Get(SettingKeys.OllamaUrl) ?? "http://localhost:11434";
        set => SettingsStore.Set(SettingKeys.OllamaUrl, value);
    }

    public static string OllamaModel
    {
        get => SettingsStore.Get(SettingKeys.OllamaModel) ?? "gemma3:1b";
        set => SettingsStore.Set(SettingKeys.OllamaModel, value);
    }

    public static bool OllamaEnabled
    {
        get => SettingsStore.GetBool(SettingKeys.OllamaEnabled, true);
        set => SettingsStore.SetBool(SettingKeys.OllamaEnabled, value);
    }

    public static bool OllamaThink
    {
        get => SettingsStore.GetBool(SettingKeys.OllamaThink, true);
        set => SettingsStore.SetBool(SettingKeys.OllamaThink, value);
    }

    public static bool AgenticToolsEnabled
    {
        get => SettingsStore.GetBool(SettingKeys.AgenticToolsEnabled, true);
        set => SettingsStore.SetBool(SettingKeys.AgenticToolsEnabled, value);
    }

    public static bool AutoModelSelection
    {
        get => SettingsStore.GetBool(SettingKeys.AutoModelSelection, true);
        set => SettingsStore.SetBool(SettingKeys.AutoModelSelection, value);
    }

    public static string ToolCallingModel
    {
        get => SettingsStore.Get(SettingKeys.ToolCallingModel) ?? "qwen2.5-coder:7b";
        set => SettingsStore.Set(SettingKeys.ToolCallingModel, value);
    }

    public static string ToolChoice
    {
        get => SettingsStore.Get(SettingKeys.ToolChoice) ?? "auto";
        set => SettingsStore.Set(SettingKeys.ToolChoice, value);
    }

    // ── Global UI ──

    public static bool AdvancedMode
    {
        get => SettingsStore.GetBool(SettingKeys.AdvancedMode);
        set => SettingsStore.SetBool(SettingKeys.AdvancedMode, value);
    }
}
