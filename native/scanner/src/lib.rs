use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::path::Path;
use std::fs;
use std::time::SystemTime;
use walkdir::WalkDir;
use rayon::prelude::*;
use serde::{Serialize, Deserialize};
use crossbeam::channel::bounded;
use num_cpus;

#[derive(Serialize, Deserialize, Debug)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub extension: Option<String>,
    pub category: String,
    pub modified: u64,
    pub created: u64,
    pub is_hidden: bool,
    pub is_directory: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ScanResult {
    pub files: Vec<FileInfo>,
    pub total_files: usize,
    pub total_size: u64,
    pub scan_time_ms: u64,
    pub categories: std::collections::HashMap<String, CategoryInfo>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CategoryInfo {
    pub count: usize,
    pub size: u64,
}

#[napi]
pub fn categorize_file(filename: &str) -> String {
    let path = Path::new(filename);
    
    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
        match ext.to_lowercase().as_str() {
            // Programming Languages
            "js" | "jsx" | "ts" | "tsx" | "mjs" => "JavaScript/TypeScript",
            "py" | "pyc" | "pyd" | "pyo" => "Python",
            "rs" => "Rust",
            "cpp" | "cxx" | "cc" | "c" | "h" | "hpp" => "C/C++",
            "java" | "class" | "jar" => "Java",
            "go" => "Go",
            "php" => "PHP",
            "rb" => "Ruby",
            "swift" => "Swift",
            "kt" => "Kotlin",
            "scala" => "Scala",
            "cs" => "C#",
            "vb" => "Visual Basic",
            "sh" | "bash" | "zsh" | "fish" | "ps1" | "bat" | "cmd" => "Shell/Scripts",
            "sql" => "SQL",
            "r" => "R",
            "m" => "MATLAB/Objective-C",
            "lua" => "Lua",
            "dart" => "Dart",
            "elm" => "Elm",
            "hs" => "Haskell",
            "ml" | "mli" => "OCaml",
            "nim" => "Nim",
            "zig" => "Zig",
            "v" => "V",
            
            // Web Technologies
            "html" | "htm" | "xhtml" => "HTML",
            "css" | "scss" | "sass" | "less" => "CSS",
            "vue" => "Vue",
            "svelte" => "Svelte",
            
            // Configuration & Data
            "json" | "xml" | "yaml" | "yml" | "toml" | "ini" | "conf" | "config" => "Configuration/Data",
            "env" => "Environment",
            "lock" => "Lock File",
            
            // Documents
            "pdf" => "PDF",
            "doc" | "docx" => "Word",
            "xls" | "xlsx" => "Excel",
            "ppt" | "pptx" => "PowerPoint",
            "txt" | "rtf" | "odt" | "ods" | "odp" => "Documents",
            "md" | "markdown" => "Markdown",
            "tex" => "LaTeX",
            
            // Images
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "tiff" | "webp" | "svg" | "ico" => "Images",
            "psd" => "Photoshop",
            "ai" => "Illustrator",
            "sketch" => "Sketch",
            
            // Audio
            "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" => "Audio",
            
            // Video
            "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" => "Video",
            
            // Archives
            "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "tgz" => "Archives",
            
            // Fonts
            "ttf" | "otf" | "woff" | "woff2" | "eot" => "Fonts",
            
            // System
            "exe" | "msi" | "deb" | "rpm" | "dmg" | "app" => "Executables",
            "dll" | "so" | "dylib" => "Libraries",
            "sys" | "drv" => "System Files",
            
            // Development
            "gitignore" | "gitattributes" => "Git",
            "dockerfile" => "Docker",
            "makefile" => "Make",
            "cmake" => "CMake",
            
            // Cache/Temp
            "cache" | "tmp" | "temp" | "log" => "Cache/Temp",
            
            _ => "Other"
        }
    } else {
        // No extension, check filename patterns
        let filename_lower = filename.to_lowercase();
        if filename_lower.contains("makefile") || filename_lower.contains("cmake") {
            "Build System"
        } else if filename_lower.contains("readme") || filename_lower.contains("license") {
            "Documentation"
        } else if filename_lower.contains("dockerfile") {
            "Docker"
        } else if filename.starts_with('.') {
            "Hidden/Config"
        } else if filename_lower.contains("test") {
            "Test Files"
        } else {
            "Other"
        }
    }
}

#[napi]
pub async fn scan_directory_optimized(
    directory_path: String,
    max_depth: Option<usize>,
    include_hidden: Option<bool>,
    parallel: Option<bool>,
    max_files: Option<usize>,
) -> Result<ScanResult> {
    let start_time = SystemTime::now();
    let max_depth = max_depth.unwrap_or(usize::MAX);
    let include_hidden = include_hidden.unwrap_or(false);
    let use_parallel = parallel.unwrap_or(true);
    let max_files = max_files.unwrap_or(10000);
    
    let path = Path::new(&directory_path);
    if !path.exists() || !path.is_dir() {
        return Err(Error::new(
            Status::InvalidArg,
            format!("Directory does not exist or is not a directory: {}", directory_path),
        ));
    }

    let (sender, receiver) = bounded(10000);
    let walker = WalkDir::new(&directory_path)
        .max_depth(max_depth)
        .follow_links(false)
        .into_iter();

    // Use atomic counter for total files processed
    let total_files_processed = std::sync::atomic::AtomicUsize::new(0);
    let max_files_atomic = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(max_files));

    // Spawn a thread for collecting file information
    let collector_handle = std::thread::spawn(move || {
        let mut files = Vec::new();
        let mut total_size = 0u64;
        let mut categories = std::collections::HashMap::new();

        for file_info in receiver {
            total_size += file_info.size;
            
            let category = file_info.category.clone();
            let cat_info = categories.entry(category).or_insert(CategoryInfo { count: 0, size: 0 });
            cat_info.count += 1;
            cat_info.size += file_info.size;
            
            files.push(file_info);
        }

        (files, total_size, categories)
    });

    // Process directory entries
    if use_parallel {
        // Parallel processing for large directories
        let entry_iter = walker
            .filter_entry(|e| {
                if !include_hidden && e.file_name().to_string_lossy().starts_with('.') {
                    return false;
                }
                true
            })
            .par_bridge();

        for entry_result in entry_iter {
            // Check if we've hit our file limit - use SeqCst for proper synchronization
            if total_files_processed.load(std::sync::atomic::Ordering::SeqCst) >= max_files_atomic.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }
            
            match entry_result {
                Ok(entry) => {
                    if let Ok(metadata) = entry.metadata() {
                        let file_info = create_file_info(&entry, &metadata);
                        
                        // Only send if we're under the limit - SeqCst ensures proper ordering
                        if total_files_processed.load(std::sync::atomic::Ordering::SeqCst) < max_files_atomic.load(std::sync::atomic::Ordering::SeqCst) {
                            if sender.send(file_info).is_err() {
                                break; // Channel closed, stop processing
                            }
                        }
                        
                        // Increment counter regardless of storage limit - SeqCst for correctness
                        total_files_processed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    }
                }
                Err(_) => continue, // Skip entries we can't read
            }
        }
    } else {
        // Sequential processing for smaller directories
        for entry_result in walker.filter_entry(|e| {
            if !include_hidden && e.file_name().to_string_lossy().starts_with('.') {
                return false;
            }
            true
        }) {
            // Check if we've hit our file limit - use SeqCst for proper synchronization
            if total_files_processed.load(std::sync::atomic::Ordering::SeqCst) >= max_files_atomic.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }
            
            match entry_result {
                Ok(entry) => {
                    if let Ok(metadata) = entry.metadata() {
                        let file_info = create_file_info(&entry, &metadata);
                        
                        // Only send if we're under the limit - SeqCst ensures proper ordering
                        if total_files_processed.load(std::sync::atomic::Ordering::SeqCst) < max_files_atomic.load(std::sync::atomic::Ordering::SeqCst) {
                            if sender.send(file_info).is_err() {
                                break;
                            }
                        }
                        
                        // Increment counter regardless of storage limit - SeqCst for correctness
                        total_files_processed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    }
                }
                Err(_) => continue,
            }
        }
    }

    drop(sender); // Close the channel to signal completion

    // Wait for collector to finish with better error handling
    let (mut files, total_size, categories) = match collector_handle.join() {
        Ok(result) => result,
        Err(e) => {
            let panic_msg = if let Some(s) = e.downcast_ref::<String>() {
                s.clone()
            } else if let Some(s) = e.downcast_ref::<&str>() {
                s.to_string()
            } else {
                "Thread panicked with unknown error".to_string()
            };
            return Err(Error::new(Status::Unknown, format!("Thread join failed: {}", panic_msg)));
        }
    };
    
    // Update total_files to reflect actual files processed
    let actual_total_files = total_files_processed.load(std::sync::atomic::Ordering::SeqCst);
    
    let scan_time = SystemTime::now()
        .duration_since(start_time)
        .map_err(|_| Error::new(Status::Unknown, "Time calculation failed"))?
        .as_millis() as u64;

    Ok(ScanResult {
        total_files: actual_total_files,
        files,
        total_size,
        scan_time_ms: scan_time,
        categories,
    })
}

fn create_file_info(entry: &walkdir::DirEntry, metadata: &fs::Metadata) -> FileInfo {
    let path = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();
    let path_str = path.to_string_lossy().to_string();
    
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase());
    
    let category = if metadata.is_dir() {
        "Directory".to_string()
    } else {
        categorize_file(&name)
    };
    
    let modified = metadata
        .modified()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH))
        .unwrap_or_default()
        .as_secs();
    
    let created = metadata
        .created()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH))
        .unwrap_or_default()
        .as_secs();

    FileInfo {
        name,
        path: path_str,
        size: metadata.len(),
        extension,
        category,
        modified,
        created,
        is_hidden: entry.file_name().to_string_lossy().starts_with('.'),
        is_directory: metadata.is_dir(),
    }
}

#[napi]
pub fn get_system_info() -> Result<serde_json::Value> {
    use sysinfo::{System, RefreshKind, Memory};
    
    let mut system = System::new_with_specifics(
        RefreshKind::nothing().with_memory()
    );
    system.refresh_memory();
    
    let info = serde_json::json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "target": std::env::consts::TARGET,
        "rust_version": rustc_version_runtime::version().map(|v| v.to_string()).unwrap_or_else(|_| "unknown".to_string()),
        "num_cpus": num_cpus::get(),
        "total_memory_mb": system.total_memory() / 1024,
        "available_memory_mb": system.available_memory() / 1024,
        "used_memory_mb": (system.total_memory() - system.available_memory()) / 1024,
    });
    
    Ok(info)
}
