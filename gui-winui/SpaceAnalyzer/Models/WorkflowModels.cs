// Licensed under the MIT License.

using System.Collections.ObjectModel;
using System.ComponentModel;

namespace SpaceAnalyzer.Models;

// WorkflowTemplate is defined in the ViewModels namespace (WorkflowsViewModel.cs); this
// using lets WorkflowCategoryGroup reference it for its member template collection.
using SpaceAnalyzer.ViewModels;

/// <summary>
/// The kind of work a workflow performs. Mirrors the seven action types the
/// README promises for workflow automation (Scan, FindDuplicates, PredictStorage,
/// GenerateRecommendations, Export, Notify, AIAnalyze). Drives both which backend
/// routine a template runs and whether it needs a target directory.
/// </summary>
public enum WorkflowActionType
{
    Scan,
    FindDuplicates,
    PredictStorage,
    GenerateRecommendations,
    Export,
    Notify,
    AIAnalyze,
}

/// <summary>
/// The five workflow groupings the README promises (5.1): Maintenance, Optimization,
/// Organization, Monitoring, Custom. Declared in the order they should appear in the UI.
/// </summary>
public enum WorkflowCategory
{
    Maintenance,
    Optimization,
    Organization,
    Monitoring,
    Custom,
}

/// <summary>
/// A grouping of <see cref="WorkflowTemplate"/>s under one of the five README
/// workflow categories. Rendered as a labelled section on the Workflows page.
/// All properties are set at construction; the member <see cref="Templates"/>
/// collection is itself observable, so the group needs no change notification.
/// </summary>
public class WorkflowCategoryGroup
{
    public WorkflowCategory Category { get; }
    public string Title { get; }
    public string Description { get; }
    public string IconGlyph { get; }

    /// <summary>The templates belonging to this category. These are the same
    /// <see cref="WorkflowTemplate"/> instances held by the view model's master
    /// <c>Templates</c> list, so selection state stays in sync across sections.</summary>
    public ObservableCollection<WorkflowTemplate> Templates { get; } = new();

    public WorkflowCategoryGroup(WorkflowCategory category, string title, string description, string iconGlyph)
    {
        Category = category;
        Title = title;
        Description = description;
        IconGlyph = iconGlyph;
    }
}
