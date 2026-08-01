//! File categorization for storage analysis
//!
//! Maps file extensions and windows paths to human-readable categories.

use std::collections::HashMap;

/// Override category based on windows path segments (checked before extension matching).
pub fn path_based_category(path: &str) -> &'static str {
    let lower = path.to_lowercase();

    // Windows system
    if lower.contains(":\\windows\\") || lower.contains("\\windows\\") {
        return "Windows";
    }
    if lower.contains("program files") {
        return "Program Files";
    }

    // User profile top-level
    if lower.contains("\\downloads\\")
        || lower.contains("/downloads/")
        || lower.ends_with("\\downloads")
    {
        return "Downloads";
    }
    if lower.contains("\\documents\\") || lower.contains("/documents/") {
        return "Documents";
    }
    if lower.contains("\\music\\") || lower.contains("/music/") {
        return "Media";
    }
    if lower.contains("\\videos\\") || lower.contains("/videos/") {
        return "Media";
    }
    if lower.contains("\\pictures\\") || lower.contains("/pictures/") {
        return "Media";
    }

    // AppData Local
    if lower.contains("\\appdata\\local\\") {
        if lower.contains("google\\play games") || lower.contains("play games") {
            return "Games";
        }
        if lower.contains("nvidia") {
            return "GPU/Cache";
        }
        if lower.contains("\\wsl\\") {
            return "Virtualization";
        }
        if lower.contains("google\\chrome") {
            return "Browser";
        }
        if lower.contains("microsoft\\edge") {
            return "Browser";
        }
        if lower.contains("razer") {
            return "Gaming";
        }
        if lower.contains("packages\\") {
            return "UWP Apps";
        }
        if lower.contains("torch") || lower.contains("site-packages") {
            return "ML/AI";
        }
        if lower.contains("python") {
            return "Development";
        }
        if lower.contains("pip\\cache") || lower.contains("pip/cache") {
            return "Cache";
        }
        if lower.contains("-updater") || lower.contains("_updater") {
            return "Updater Cache";
        }
        if lower.contains("perplexity") || lower.contains("comet") {
            return "AI Tools";
        }
        if lower.contains("anythingllm")
            || lower.contains("continue")
            || lower.contains("lm-studio")
            || lower.contains("eigent")
            || lower.contains("aetheride")
        {
            return "AI Tools";
        }
        // Generic AppData\Local fallback
        return "AppData Local";
    }

    // AppData Roaming
    if lower.contains("\\appdata\\roaming\\") {
        if lower.contains("anythingllm") || lower.contains("ollama") {
            return "AI Models";
        }
        if lower.contains("gemini") {
            return "AI Tools";
        }
        if lower.contains("code\\") || lower.contains("vscode") {
            return "Development";
        }
        if lower.contains("unity") {
            return "Games/Dev";
        }
        if lower.contains("windsurf") {
            return "Development";
        }
        // Generic Roaming fallback
        return "AppData Roaming";
    }

    // AI/ML paths
    if lower.contains(".ollama") || lower.contains("ollama\\") || lower.contains("ollama/") {
        return "AI Models";
    }
    if lower.contains("\\audioldm") || lower.contains("audioldm\\") {
        return "AI Models";
    }
    if lower.contains("\\gemini\\") || lower.contains(".gemini\\") || lower.contains("/gemini/") {
        return "AI Tools";
    }
    if lower.contains("huggingface") {
        return "AI Models";
    }
    if lower.contains("\\antigravity\\") {
        return "AI Tools";
    }

    // Development
    if lower.contains("node_modules") {
        return "Development";
    }
    if lower.contains("\\.cargo\\") || lower.contains("/.cargo/") || lower.contains("\\rustup\\") {
        return "Development";
    }
    if lower.contains("\\.android\\") {
        return "Development";
    }
    if lower.contains("\\unity\\") || lower.contains("/unity/") {
        return "Games/Dev";
    }
    if lower.contains("site-packages") || lower.contains("\\lib\\python") {
        return "Development";
    }
    if lower.contains("\\target\\") || lower.contains("/target/") {
        let rest = if lower.contains("\\target\\") {
            lower.split("\\target\\").last()
        } else {
            lower.split("/target/").last()
        };
        if let Some(suffix) = rest {
            if suffix.starts_with("debug") || suffix.starts_with("release") {
                return "Build Output";
            }
        }
    }
    if lower.contains(".git") {
        return "VCS";
    }

    // Browser/App data
    if lower.contains("\\cache\\") || lower.contains("/cache/") {
        return "Cache";
    }
    if lower.contains("indexeddb") {
        return "App Data";
    }
    if lower.contains("\\capcut\\") || lower.contains("perplexity") {
        return "Media Tools";
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
        "Documents" => (100, 180, 255),       // Blue
        "Images" => (255, 180, 100),          // Orange
        "Videos" => (231, 76, 60),            // Red
        "Audio" => (155, 89, 182),            // Purple
        "Archives" => (46, 204, 113),         // Green
        "Code" => (255, 200, 80),             // Yellow
        "Databases" => (142, 68, 173),        // Deep Purple
        "Executables" => (255, 100, 100),     // Light Red
        "System" => (150, 150, 150),          // Gray
        "Development" => (200, 100, 255),     // Pink
        "Games" => (255, 150, 200),           // Light Pink
        "Games/Dev" => (255, 170, 120),       // Peach
        "GPU/Cache" => (100, 200, 255),       // Cyan
        "Virtualization" => (180, 130, 255),  // Purple-blue
        "Browser" => (255, 220, 100),         // Yellow
        "Gaming" => (255, 150, 200),          // Light Pink
        "UWP Apps" => (200, 200, 200),        // Light Gray
        "ML/AI" => (200, 100, 255),           // Violet
        "AI Tools" => (180, 80, 220),         // Deep Violet
        "Downloads" => (255, 180, 100),       // Orange
        "Media" => (255, 100, 150),           // Pink-red
        "Windows" => (80, 120, 200),          // Muted Blue
        "Program Files" => (90, 140, 180),    // Steel Blue
        "AppData Local" => (200, 200, 150),   // Tan
        "AppData Roaming" => (180, 200, 180), // Light green
        "Temp/Cache" => (200, 160, 80),       // Gold
        "Updater Cache" => (220, 180, 100),   // Brown-gold
        "AI Models" => (180, 80, 200),        // Violet
        "Build Output" => (255, 140, 60),     // Orange
        "VCS" => (100, 200, 100),             // Green
        "Cache" => (200, 180, 80),            // Yellow-gold
        "Test Fixtures" => (160, 160, 255),   // Light Purple
        "App Data" => (200, 200, 200),        // Gray
        "Media Tools" => (255, 140, 100),     // Coral
        _ => (180, 180, 180),                 // Light Gray
    }
}
