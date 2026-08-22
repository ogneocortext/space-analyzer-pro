use std::path::Path;
use serde::{Deserialize, Serialize};

/// Reclaimability tier used to surface *actionable* storage — what the user can
/// actually delete to reclaim space — instead of only a storage taxonomy.
///
/// - `Safe`: deletable without meaningful consequence (caches, build artifacts,
///   temp files, dependency trees like `node_modules`).
/// - `Caution`: large or re-downloadable but the user may want to keep (AI model
///   weights, virtual-machine disks, archives, downloads, logs).
/// - `Keep`: OS files, installed applications, or user data — never suggested for
///   deletion by the cleanup guidance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ReclaimTier {
    Safe,
    Caution,
    Keep,
}

impl ReclaimTier {
    /// Stable snake-free label used as a JSON / DB key.
    pub fn as_str(&self) -> &'static str {
        match self {
            ReclaimTier::Safe => "Safe",
            ReclaimTier::Caution => "Caution",
            ReclaimTier::Keep => "Keep",
        }
    }
}

/// Return the lowercased directory-component names of a path (excluding the
/// root/prefix and the file name itself). Used so path-based category overrides
/// match whole directory names instead of arbitrary substrings.
fn path_dir_names(path: &str) -> Vec<String> {
    Path::new(path)
        .components()
        .filter_map(|c| match c {
            std::path::Component::Normal(s) => s.to_str().map(|s| s.to_lowercase()),
            _ => None,
        })
        .collect()
}

/// Map a file extension (no path context) to a high-level storage category.
///
/// This is the extension-only half of [`extension_to_category`]. It is exposed
/// publicly so callers that only have an extension (e.g. a cached
/// `extension_sizes` map with no per-file paths) can classify files the same way
/// a live scan does. Path-derived categories (Development, Build Output, VCS)
/// cannot be recovered from an extension alone — for those, prefer a fresh scan.
pub fn category_for_extension(ext: &str) -> &'static str {
    match ext {
        "txt" | "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods"
        | "odp" | "rtf" | "md" | "csv" | "log" | "epub" | "mobi" | "azw" | "tex" => "Documents",
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" | "webp" | "ico" | "tiff" | "tif"
        | "heic" | "heif" | "raw" | "cr2" | "nef" | "arw" | "dng" | "psd" => "Images",
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "mpeg" | "mpg" | "3gp"
        | "vob" | "ogv" | "m2ts" | "mts" => "Videos",
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" | "aiff" | "opus" => "Audio",
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "iso" | "cab" | "zst" | "jar"
        | "nupkg" | "asar" | "tgz" | "war" | "ear" | "lz4" | "lz" | "z" | "msix" | "appx" => {
            "Archives"
        }
        "js" | "ts" | "tsx" | "jsx" | "py" | "java" | "c" | "cpp" | "h" | "hpp" | "cs" | "go"
        | "rs" | "php" | "rb" | "swift" | "kt" | "scala" | "html" | "css" | "scss" | "sass"
        | "less" | "json" | "xml" | "yaml" | "yml" | "toml" | "ini" | "cfg" | "lock" | "proto"
        | "graphql" | "vue" | "pl" | "lua" | "r" | "dart" | "hs" | "clj" | "groovy" | "ex"
        | "exs" => "Code",
        "db" | "sqlite" | "sql" | "mdb" | "accdb" | "db3" | "sqlite3" | "duckdb" => "Databases",
        "exe" | "msi" | "bat" | "cmd" | "sh" | "ps1" | "app" | "dmg" | "deb" | "rpm" | "scr"
        | "com" | "apk" => "Executables",
        "dll" | "sys" | "drv" | "cat" | "mui" => "System",
        "ttf" | "otf" | "fon" | "woff" | "woff2" | "eot" | "ttc" => "Fonts",
        "lib" | "a" | "pdb" | "so" | "dylib" | "rlib" | "rmeta" | "o" | "obj" | "exp" | "ilk"
        | "wasm" | "pyc" | "pyd" => "Build Output",
        "sav" | "save" | "game" | "pak" | "wad" | "mpq" | "unity3d" | "vpk" | "bsa" | "esm"
        | "uasset" | "forge" | "bundle" | "asset" => "Games",
        "qcow2" | "vhd" | "vhdx" | "vmdk" | "vdi" | "img" | "wim" | "esd" => "Virtual",
        "gguf" | "safetensors" | "onnx" => "AI Models",
        "tmp" => "Temporary",
        "" => "Other",
        _ => "Other",
    }
}

pub fn extension_to_category(ext: &str, path: &str) -> &'static str {
    let dirs = path_dir_names(path);
    let lower = path.to_lowercase();

    if lower.contains(".ollama")
        || lower.contains("ollama/")
        || lower.contains("ollama\\")
        || lower.contains(".gemini")
        || lower.contains("huggingface")
        || lower.contains("models/blobs")
        || lower.contains("models\\blobs")
        || lower.contains("weights.bin")
        || lower.contains("antigravity")
    {
        return "AI Models";
    }

    match ext {
        "qcow2" | "vhd" | "vhdx" | "vmdk" | "vdi" | "img" | "wim" | "esd" => return "Virtual",
        _ => {}
    }

    let mut saw_target = false;
    for (i, d) in dirs.iter().enumerate() {
        if d == "target" {
            saw_target = true;
            if let Some(next) = dirs.get(i + 1) {
                if next == "debug" || next == "release" {
                    return "Build Output";
                }
            }
        }
    }
    if saw_target {
        return "Development";
    }

    if dirs.iter().any(|d| {
        matches!(
            d.as_str(),
            "node_modules"
                | "venv"
                | ".venv"
                | "site-packages"
                | ".cargo"
                | ".rustup"
                | ".android"
                | "unity"
                | "gradle"
        )
    }) {
        return "Development";
    }

    if dirs.iter().any(|d| d == ".git") {
        return "VCS";
    }

    if ext.is_empty() && (lower.contains("system32\\config") || lower.contains("system32/config")) {
        return "System";
    }

    category_for_extension(ext)
}

/// Classify a file's reclaimability from its extension, full (lowercased) path,
/// and the high-level `category` already assigned by [`extension_to_category`].
///
/// Path-based signals dominate (caches, build dirs, dependency trees, downloads)
/// so a `node_modules` file is `Safe` even though its extension maps to `Code` /
/// `Development`. Category-driven tiers then handle the rest (AI models, VM
/// disks, archives, logs). Everything else — OS, installed apps, user data — is
/// `Keep`.
pub fn classify_reclaimability(ext: &str, path_lower: &str, category: &str) -> ReclaimTier {
    let ext_l = ext.to_lowercase();

    // Keep: never touch VS Code extension directories. Extensions bundle their
    // own node_modules as dependencies that are NOT reinstallable — deleting
    // them breaks the extension (see safe-tier reclaim classifier regression).
    if path_lower.contains(".vscode\\extensions") {
        return ReclaimTier::Keep;
    }

    // Safe: temp files + caches + build/deps + junk directories.
    if ext_l == "tmp" {
        return ReclaimTier::Safe;
    }
    if path_lower.contains("node_modules")
        || path_lower.contains(".cache")
        || path_lower.contains("thumbnails")
        || path_lower.contains("__pycache__")
        || path_lower.contains("\\target\\")
        || path_lower.contains("/target/")
        || path_lower.contains("appdata\\local\\temp")
        || path_lower.contains("windows\\temp")
        || path_lower.contains("inetcache")
        || path_lower.contains("thumbcache")
    {
        return ReclaimTier::Safe;
    }

    // Caution: large / re-downloadable but the user may want to keep.
    if category == "AI Models" || category == "Virtual" || category == "Archives" {
        return ReclaimTier::Caution;
    }
    if ext_l == "log" || ext_l == "evtx" {
        return ReclaimTier::Caution;
    }
    if path_lower.contains("downloads") {
        return ReclaimTier::Caution;
    }

    ReclaimTier::Keep
}
