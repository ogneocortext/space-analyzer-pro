// Licensed under the MIT License.

using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using Windows.Storage;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the Settings page. Persists theme, scanner path,
/// and Ollama configuration to <see cref="ApplicationData"/> local settings.
/// </summary>
public class SettingsViewModel : INotifyPropertyChanged
{
    private const string LocalSettingsKey = "SpaceAnalyzer.Settings";

    // ── Appearance ──

    private string _theme = "Dark";
    public string Theme
    {
        get => _theme;
        set { _theme = value; OnPropertyChanged(); }
    }

    // ── Scanner ──

    private string _scannerPath = string.Empty;
    public string ScannerPath
    {
        get => _scannerPath;
        set { _scannerPath = value; OnPropertyChanged(); }
    }

    // ── Ollama ──

    private string _ollamaUrl = "http://localhost:11434";
    public string OllamaUrl
    {
        get => _ollamaUrl;
        set { _ollamaUrl = value; OnPropertyChanged(); }
    }

    private string _ollamaModel = "gemma3:1b";
    public string OllamaModel
    {
        get => _ollamaModel;
        set { _ollamaModel = value; OnPropertyChanged(); }
    }

    // ── Lifecycle ──

    public SettingsViewModel()
    {
        Load();
    }

    public void Load()
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer(LocalSettingsKey, ApplicationDataCreateDisposition.Always);

            if (container.Values.TryGetValue("Theme", out var v))
                Theme = (string)v;
            if (container.Values.TryGetValue("ScannerPath", out v))
                ScannerPath = (string)v;
            if (container.Values.TryGetValue("OllamaUrl", out v))
                OllamaUrl = (string)v;
            if (container.Values.TryGetValue("OllamaModel", out v))
                OllamaModel = (string)v;
        }
        catch
        {
            // Non-fatal: fall back to defaults.
        }
    }

    public void Save()
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer(LocalSettingsKey, ApplicationDataCreateDisposition.Always);

            container.Values["Theme"] = Theme;
            container.Values["ScannerPath"] = ScannerPath;
            container.Values["OllamaUrl"] = OllamaUrl;
            container.Values["OllamaModel"] = OllamaModel;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SettingsViewModel] Save failed: {ex}");
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
