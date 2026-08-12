// Licensed under the MIT License.

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// How search results are grouped for display. <see cref="None"/> shows the flat
/// list; the other values bucket results into collapsible groups.
/// </summary>
public enum GroupByMode
{
    None,
    Folder,
    Category,
    Extension,
    Date,
    Size
}

/// <summary>
/// Sort dimension applied to results (and within groups).
/// </summary>
public enum SortBy
{
    Name,
    Size,
    Date,
    Path,
    Extension
}
