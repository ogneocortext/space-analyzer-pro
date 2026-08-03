// Licensed under the MIT License.

using System.Collections.Generic;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Shared constants for workflow and file-type filtering.
/// Defined here so both ViewModels and ToolExecutor can reference them
/// without duplicating the sets or creating cross-class visibility issues.
/// </summary>
public static class WorkflowConstants
{
    public static readonly HashSet<string> TempExtensions = new(new[]
    {
        ".tmp", ".temp", ".cache", ".log", ".bak", ".old", ".swp", ".swo",
        ".crdownload", ".part", ".download", ".dmg", ".iso", ".img", ".vmdk",
        ".vhd", ".vhdx", ".bak", ".backup", ".orig", ".rej", ".merge", ".res",
        ".compiled", ".pyc", ".pyo", ".dll", ".exe", ".so", ".dylib"
    });

    public static readonly HashSet<string> CacheExtensions = new(new[]
    {
        ".cache", ".pkg", ".jar", ".whl", ".egg", ".nupkg", ".gem", ".crx",
        ".xpi", ".msi", ".msix", ".appx", ".appxbundle", ".msixbundle"
    });

    public static readonly HashSet<string> OrphanedProjectFiles = new(new[]
    {
        "package.json", "Cargo.toml", "go.mod", "requirements.txt", "setup.py",
        "pyproject.toml", "pom.xml", "build.gradle", "Makefile", "CMakeLists.txt",
        "project.json", ".csproj", ".vbproj", ".fsproj", ".sln", ".slnf",
        "Gemfile", "Rakefile", "build.sbt", "build.gradle.kts", "pubspec.yaml",
        "pubspec.yml", "mix.exs", "rebar.config", "elixir.mk", "dune-project",
        "flake.nix", "justfile", "Taskfile.yml", "Taskfile.yaml"
    });

    public static readonly HashSet<string> ProjectExtensions = new(new[]
    {
        ".cs", ".fs", ".vb", ".py", ".js", ".ts", ".jsx", ".tsx", ".java",
        ".go", ".rs", ".rb", ".php", ".cpp", ".c", ".h", ".hpp", ".csx",
        ".ps1", ".psm1", ".sh", ".bash", ".zsh", ".lua", ".r", ".sql",
        ".html", ".css", ".scss", ".less", ".vue", ".svelte", ".jsx", ".tsx",
        ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".xml", ".svg"
    });
}
