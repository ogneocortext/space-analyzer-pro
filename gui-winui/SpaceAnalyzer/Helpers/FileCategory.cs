// Licensed under the MIT License.

using System.Collections.Generic;
using Microsoft.UI;
using Microsoft.UI.Xaml.Media;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Maps file extensions to high-level storage categories and exposes category
/// colors for charts. Mirrors the Rust scanner's <c>extension_to_category</c>
/// mapping (and the canonical <c>FILE_CATEGORIES</c> in the main crate) so the
/// WinUI history detail classifies files the same way the scanner does.
/// </summary>
public static class FileCategory
{
    private static readonly Dictionary<string, string> ExtensionToCategory = new(StringComparer.OrdinalIgnoreCase)
    {
        // Documents
        { "txt", "Documents" }, { "pdf", "Documents" }, { "doc", "Documents" }, { "docx", "Documents" },
        { "xls", "Documents" }, { "xlsx", "Documents" }, { "ppt", "Documents" }, { "pptx", "Documents" },
        { "odt", "Documents" }, { "ods", "Documents" }, { "odp", "Documents" }, { "rtf", "Documents" },
        { "md", "Documents" }, { "csv", "Documents" }, { "log", "Documents" },
        { "epub", "Documents" }, { "mobi", "Documents" }, { "azw", "Documents" }, { "tex", "Documents" },
        // Images
        { "jpg", "Images" }, { "jpeg", "Images" }, { "png", "Images" }, { "gif", "Images" }, { "bmp", "Images" },
        { "svg", "Images" }, { "webp", "Images" }, { "ico", "Images" }, { "tiff", "Images" }, { "tif", "Images" },
        { "heic", "Images" }, { "heif", "Images" }, { "raw", "Images" }, { "cr2", "Images" },
        { "nef", "Images" }, { "arw", "Images" }, { "dng", "Images" }, { "psd", "Images" },
        // Videos
        { "mp4", "Videos" }, { "avi", "Videos" }, { "mkv", "Videos" }, { "mov", "Videos" }, { "wmv", "Videos" },
        { "flv", "Videos" }, { "webm", "Videos" }, { "m4v", "Videos" }, { "mpeg", "Videos" }, { "mpg", "Videos" },
        { "3gp", "Videos" }, { "vob", "Videos" }, { "ogv", "Videos" }, { "m2ts", "Videos" }, { "mts", "Videos" },
        // Audio
        { "mp3", "Audio" }, { "wav", "Audio" }, { "flac", "Audio" }, { "aac", "Audio" }, { "ogg", "Audio" },
        { "wma", "Audio" }, { "m4a", "Audio" }, { "aiff", "Audio" }, { "opus", "Audio" },
        // Archives
        { "zip", "Archives" }, { "rar", "Archives" }, { "7z", "Archives" }, { "tar", "Archives" }, { "gz", "Archives" },
        { "bz2", "Archives" }, { "xz", "Archives" }, { "iso", "Archives" }, { "cab", "Archives" }, { "zst", "Archives" },
        { "jar", "Archives" }, { "nupkg", "Archives" }, { "asar", "Archives" }, { "tgz", "Archives" },
        { "war", "Archives" }, { "ear", "Archives" }, { "lz4", "Archives" }, { "lz", "Archives" }, { "z", "Archives" },
        { "msix", "Archives" }, { "appx", "Archives" },
        // Code
        { "js", "Code" }, { "ts", "Code" }, { "tsx", "Code" }, { "jsx", "Code" }, { "py", "Code" }, { "java", "Code" },
        { "c", "Code" }, { "cpp", "Code" }, { "h", "Code" }, { "hpp", "Code" }, { "cs", "Code" }, { "go", "Code" },
        { "rs", "Code" }, { "php", "Code" }, { "rb", "Code" }, { "swift", "Code" }, { "kt", "Code" }, { "scala", "Code" },
        { "html", "Code" }, { "css", "Code" }, { "scss", "Code" }, { "sass", "Code" }, { "less", "Code" },
        { "json", "Code" }, { "xml", "Code" }, { "yaml", "Code" }, { "yml", "Code" }, { "toml", "Code" },
        { "ini", "Code" }, { "cfg", "Code" }, { "lock", "Code" },
        { "proto", "Code" }, { "graphql", "Code" }, { "vue", "Code" }, { "pl", "Code" }, { "lua", "Code" },
        { "r", "Code" }, { "dart", "Code" }, { "hs", "Code" }, { "clj", "Code" }, { "groovy", "Code" },
        { "ex", "Code" }, { "exs", "Code" },
        // Databases
        { "db", "Databases" }, { "sqlite", "Databases" }, { "sql", "Databases" }, { "mdb", "Databases" }, { "accdb", "Databases" },
        { "db3", "Databases" }, { "sqlite3", "Databases" }, { "duckdb", "Databases" },
        // Executables
        { "exe", "Executables" }, { "msi", "Executables" }, { "bat", "Executables" }, { "cmd", "Executables" },
        { "sh", "Executables" }, { "ps1", "Executables" }, { "app", "Executables" }, { "dmg", "Executables" },
        { "deb", "Executables" }, { "rpm", "Executables" }, { "scr", "Executables" }, { "com", "Executables" },
        { "apk", "Executables" },
        // System
        { "dll", "System" }, { "sys", "System" }, { "drv", "System" }, { "cat", "System" }, { "mui", "System" },
        // Fonts
        { "ttf", "Fonts" }, { "otf", "Fonts" }, { "fon", "Fonts" }, { "woff", "Fonts" }, { "woff2", "Fonts" },
        { "eot", "Fonts" }, { "ttc", "Fonts" },
        // Build Output (compiled/linker artifacts)
        { "lib", "Build Output" }, { "a", "Build Output" }, { "pdb", "Build Output" }, { "so", "Build Output" },
        { "dylib", "Build Output" }, { "rlib", "Build Output" }, { "rmeta", "Build Output" },
        { "o", "Build Output" }, { "obj", "Build Output" }, { "exp", "Build Output" }, { "ilk", "Build Output" },
        { "wasm", "Build Output" }, { "pyc", "Build Output" }, { "pyd", "Build Output" },
        // Games (engine asset packages)
        { "sav", "Games" }, { "save", "Games" }, { "game", "Games" },
        { "pak", "Games" }, { "wad", "Games" }, { "mpq", "Games" }, { "unity3d", "Games" },
        { "vpk", "Games" }, { "bsa", "Games" }, { "esm", "Games" }, { "uasset", "Games" },
        { "forge", "Games" }, { "bundle", "Games" }, { "asset", "Games" },
        // Virtual / disk images
        { "qcow2", "Virtual" }, { "vhd", "Virtual" }, { "vhdx", "Virtual" }, { "vmdk", "Virtual" },
        { "vdi", "Virtual" }, { "img", "Virtual" }, { "wim", "Virtual" }, { "esd", "Virtual" },
        // AI model weights
        { "gguf", "AI Models" }, { "safetensors", "AI Models" }, { "onnx", "AI Models" },
        // Temporary
        { "tmp", "Temporary" },
    };

    private static readonly Dictionary<string, (byte R, byte G, byte B)> CategoryColors = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Documents", (100, 180, 255) },
        { "Images", (255, 180, 100) },
        { "Videos", (231, 76, 60) },
        { "Audio", (155, 89, 182) },
        { "Archives", (46, 204, 113) },
        { "Code", (255, 200, 80) },
        { "Databases", (142, 68, 173) },
        { "Executables", (255, 100, 100) },
        { "System", (150, 150, 150) },
        { "Fonts", (120, 200, 220) },
        { "Temporary", (200, 160, 80) },
        { "Games", (255, 150, 200) },
        { "Development", (200, 100, 255) },
        { "Build Output", (255, 140, 60) },
        { "VCS", (100, 200, 100) },
        { "Virtual", (150, 200, 235) },
        { "AI Models", (180, 80, 200) },
        { "Other", (180, 180, 180) },
    };

    /// <summary>
    /// Inverse of <see cref="ExtensionToCategory"/>: every extension (with its
    /// leading dot) that maps to each category. Built once so the Library
    /// Composition donut can drill a chosen category into a Smart Search.
    /// </summary>
    private static readonly Dictionary<string, List<string>> CategoryToExtensions = BuildCategoryToExtensions();

    private static Dictionary<string, List<string>> BuildCategoryToExtensions()
    {
        var map = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var kvp in ExtensionToCategory)
        {
            if (!map.TryGetValue(kvp.Value, out var list))
            {
                list = new List<string>();
                map[kvp.Value] = list;
            }
            list.Add("." + kvp.Key);
        }
        return map;
    }

    /// <summary>
    /// The known file extensions (with leading dot) that belong to <paramref name="category"/>.
    /// Used to drill from the Library Composition donut into a Smart Search for that category.
    /// Returns an empty list when the category has no mapped extensions.
    /// </summary>
    public static IReadOnlyList<string> ExtensionsForCategory(string category)
    {
        return CategoryToExtensions.TryGetValue(category, out var list)
            ? list
            : Array.Empty<string>();
    }

    public static string CategoryForExtension(string? extension)
    {
        if (string.IsNullOrWhiteSpace(extension))
            return "Other";
        var ext = extension!.TrimStart('.').ToLowerInvariant();
        return ExtensionToCategory.TryGetValue(ext, out var cat) ? cat : "Other";
    }

    public static SolidColorBrush CategoryBrush(string category)
    {
        if (!CategoryColors.TryGetValue(category, out var c))
            c = (180, 180, 180);
        return new SolidColorBrush(ColorHelper.FromArgb(255, c.R, c.G, c.B));
    }
}
