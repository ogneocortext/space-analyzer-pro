//! File categorization for storage analysis
//!
//! Maps file extensions and windows paths to human-readable categories.

use std::collections::HashMap;

/// Override category based on windows path segments (checked before extension matching).
pub fn path_based_category(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.contains(":\\windows\\") || lower.contains("\\windows\\") {
        return "Windows";
    }
    if lower.contains("program files") {
        return "Program Files";
    }
    if lower.contains("appdata") && (lower.contains("\\temp\\") || lower.contains("/temp/")) {
        return "Temp/Cache";
    }
    if lower.contains("node_modules") {
        return "Development";
    }
    if lower.contains(".ollama") || lower.contains("ollama\\") || lower.contains("ollama/") {
        return "AI Models";
    }
    "Extension"
}

/// File category definitions
pub const FILE_CATEGORIES: [(&str, &[&str]); 12] = [
    (
        "Documents",
        &[
            "txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf",
            "md", "csv",
        ],
    ),
    (
        "Images",
        &[
            "jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico", "tiff", "tif",
        ],
    ),
    (
        "Videos",
        &[
            "mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "m4v", "mpeg", "mpg",
        ],
    ),
    ("Audio", &["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a"]),
    (
        "Archives",
        &["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "cab"],
    ),
    (
        "Code",
        &[
            "js", "ts", "py", "java", "c", "cpp", "h", "hpp", "cs", "go", "rs", "php", "rb",
            "swift", "kt", "scala", "html", "css", "scss", "sass", "less", "json", "xml", "yaml",
            "yml",
        ],
    ),
    ("Databases", &["db", "sqlite", "sql", "mdb", "accdb"]),
    (
        "Executables",
        &[
            "exe", "msi", "bat", "cmd", "sh", "ps1", "app", "dmg", "deb", "rpm",
        ],
    ),
    (
        "System",
        &["dll", "sys", "drv", "fon", "ttf", "otf", "log", "tmp"],
    ),
    (
        "Development",
        &[
            "gradle",
            "maven",
            "node_modules",
            ".git",
            "venv",
            "env",
            "dist",
            "build",
        ],
    ),
    ("Games", &["sav", "save", "game"]),
    ("Other", &[]), // Catch-all
];

/// Get category for a file extension, with optional path hint for windows folder overrides.
pub fn get_category(extension: &str, path_hint: Option<&str>) -> &'static str {
    if let Some(path) = path_hint {
        let pcat = path_based_category(path);
        if pcat != "Extension" {
            return pcat;
        }
    }
    let ext = extension.to_lowercase();
    for (category, extensions) in FILE_CATEGORIES {
        if extensions.contains(&ext.as_str()) {
            return category;
        }
    }
    "Other"
}

/// Categorize file types into major categories.
pub fn categorize_files(file_types: &HashMap<String, usize>) -> HashMap<String, usize> {
    let mut categories: HashMap<String, usize> = HashMap::new();
    for (ext, count) in file_types {
        let category = get_category(ext, None);
        *categories.entry(category.to_string()).or_insert(0) += count;
    }
    categories
}

/// Get category color for ui display.
pub fn category_color(category: &str) -> (u8, u8, u8) {
    match category {
        "Documents" => (100, 180, 255),    // Blue
        "Images" => (255, 180, 100),       // Orange
        "Videos" => (231, 76, 60),         // Red
        "Audio" => (155, 89, 182),         // Purple
        "Archives" => (46, 204, 113),      // Green
        "Code" => (255, 200, 80),          // Yellow
        "Databases" => (142, 68, 173),     // Deep Purple
        "Executables" => (255, 100, 100),  // Light Red
        "System" => (150, 150, 150),       // Gray
        "Development" => (200, 100, 255),  // Pink
        "Games" => (255, 150, 200),        // Light Pink
        "Windows" => (80, 120, 200),       // Muted Blue
        "Program Files" => (90, 140, 180), // Steel Blue
        "Temp/Cache" => (200, 160, 80),    // Gold
        "AI Models" => (180, 80, 200),     // Violet
        _ => (180, 180, 180),              // Light Gray
    }
}
