// Licensed under the MIT License.

using System;
using System.IO;
using System.Linq;
using Windows.Storage;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

public partial class ScanViewModel
{
    private void Load()
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer(LocalSettingsKey, ApplicationDataCreateDisposition.Always);

            if (container.Values.TryGetValue("DepthValue", out var v) && v is double d)
                _depthValue = d;
            if (container.Values.TryGetValue("CustomMaxDepth", out v) && v is double cmd)
                _customMaxDepth = cmd;
            if (container.Values.TryGetValue("ScanPath", out v))
                _scanPath = v?.ToString() ?? _scanPath;

            OnPropertyChanged(nameof(DepthValue));
            OnPropertyChanged(nameof(SelectedDepthMode));
            OnPropertyChanged(nameof(ResultDepthDisplay));
            OnPropertyChanged(nameof(DeepScan));
            OnPropertyChanged(nameof(ShallowScan));
            OnPropertyChanged(nameof(DepthInt));
            OnPropertyChanged(nameof(ShowCustomDepthSlider));
            OnPropertyChanged(nameof(IncludeHidden));
            OnPropertyChanged(nameof(ScanPath));
            OnPropertyChanged(nameof(PathExists));
            OnPropertyChanged(nameof(PathValidationMessage));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ScanViewModel] Load failed: {ex}");
        }
    }

    public void Save()
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer(LocalSettingsKey, ApplicationDataCreateDisposition.Always);

            container.Values["DepthValue"] = DepthValue;
            container.Values["CustomMaxDepth"] = _customMaxDepth;
            container.Values["ScanPath"] = ScanPath;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ScanViewModel] Save failed: {ex}");
        }
    }

    private void InitializeQuickScanTargets()
    {
        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        QuickScanTargets.Add(new QuickScanTarget { Name = "User Profile", Path = userProfile });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Desktop", Path = Environment.GetFolderPath(Environment.SpecialFolder.Desktop) });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Documents", Path = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments) });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Downloads", Path = Path.Combine(userProfile, "Downloads") });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Pictures", Path = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures) });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Local AppData", Path = localAppData });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Temp", Path = Path.GetTempPath() });

        _selectedQuickScanTarget = QuickScanTargets[0];
        ScanPath = userProfile;
    }
}
