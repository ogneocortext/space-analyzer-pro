use std::path::Path;

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
