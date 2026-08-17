// Licensed under the MIT License.

using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class DuplicatesViewModel
{
    private string _impactPath = string.Empty;
    public string ImpactPath
    {
        get => _impactPath;
        set { _impactPath = value; OnPropertyChanged(); }
    }

    private DependencyReport? _impactReport;
    public DependencyReport? ImpactReport
    {
        get => _impactReport;
        set
        {
            _impactReport = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasImpact));
            OnPropertyChanged(nameof(ImpactSummary));
            OnPropertyChanged(nameof(ImpactRelatedCount));
            OnPropertyChanged(nameof(ImpactSameStemCount));
            OnPropertyChanged(nameof(ImpactSiblingCount));
            OnPropertyChanged(nameof(ImpactSymlinkSourceCount));
            OnPropertyChanged(nameof(ImpactSiblingFiles));
        }
    }
    public bool HasImpact => _impactReport != null;
    public string ImpactSummary => _impactReport?.Summary ?? string.Empty;
    public int ImpactRelatedCount => _impactReport?.TotalRelated ?? 0;
    public int ImpactSameStemCount => _impactReport?.SameStemFiles.Count ?? 0;
    public int ImpactSiblingCount => _impactReport?.SiblingFiles.Count ?? 0;
    public int ImpactSymlinkSourceCount => _impactReport?.SymlinkSources.Count ?? 0;
    public List<RelatedFile> ImpactSiblingFiles => _impactReport?.SiblingFiles ?? new List<RelatedFile>();

    private bool _isAnalyzingImpact;
    public bool IsAnalyzingImpact
    {
        get => _isAnalyzingImpact;
        set { _isAnalyzingImpact = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotAnalyzingImpact)); }
    }
    public bool IsNotAnalyzingImpact => !_isAnalyzingImpact;

    /// <summary>
    /// Runs the Rust dependencies analysis on a single file so the user can
    /// see exactly which sibling/symlink/duplicate files would be affected BEFORE
    /// deleting anything. Nothing is deleted by this action.
    /// </summary>
    public async Task AnalyzeImpactAsync()
    {
        if (IsAnalyzingImpact || string.IsNullOrWhiteSpace(ImpactPath))
            return;

        try
        {
            IsAnalyzingImpact = true;
            StatusMessage = "Analyzing deletion impact...";
            var report = await _scanner.GetDependencyReportAsync(ImpactPath, CancellationToken.None);
            ImpactReport = report;
            StatusMessage = report != null
                ? $"Impact analysis complete: {report.TotalRelated} related file(s)."
                : "Impact analysis returned no data for that path.";
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[DuplicatesViewModel] Impact analysis failed: {ex}");
            StatusMessage = $"Impact analysis failed: {ex.Message}";
        }
        finally
        {
            IsAnalyzingImpact = false;
        }
    }
}
