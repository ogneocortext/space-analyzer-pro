// Licensed under the MIT License.

namespace SpaceAnalyzer;

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
