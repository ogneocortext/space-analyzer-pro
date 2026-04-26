use clap::Parser;
use std::path::Path;
use std::fs;
use std::time::SystemTime;
use walkdir::WalkDir;
use rayon::prelude::*;
use serde::{Serialize, Deserialize};
use std::io::{self, Write};

#[derive(Serialize, Deserialize, Debug)]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
    extension: Option<String>,
    category: String,
    subcategory: String,
    semantic_tags: Vec<String>,
    modified: u64,
    created: u64,
    is_hidden: bool,
    is_directory: bool,
}

#[derive(Serialize, Deserialize, Debug)]
struct ScanResult {
    files: Vec<FileInfo>,
    total_files: usize,
    total_size: u64,
    scan_time_ms: u64,
    categories: std::collections::HashMap<String, CategoryInfo>,
}

#[derive(Serialize, Deserialize, Debug)]
struct CategoryInfo {
    count: usize,
    size: u64,
}

#[derive(Parser)]
#[command(name = "space-analyzer")]
#[command(about = "Fast space analyzer CLI with Rust", long_about = None)]
struct Cli {
    /// Directory to analyze
    #[arg(value_name = "DIRECTORY")]
    directory: String,

    /// Output format
    #[arg(short, long, value_enum, default_value_t = OutputFormat::Json)]
    format: OutputFormat,

    /// Output file path
    #[arg(short, long)]
    output: Option<String>,

    /// Maximum depth to scan
    #[arg(short, long, default_value_t = usize::MAX)]
    max_depth: usize,

    /// Include hidden files
    #[arg(short, long)]
    hidden: bool,

    /// Use parallel processing
    #[arg(short, long, default_value_t = true)]
    parallel: bool,

    /// Maximum number of files to process
    #[arg(short, long, default_value_t = 100000)]
    max_files: usize,

    /// Show progress
    #[arg(short, long)]
    progress: bool,
}

#[derive(clap::ValueEnum, Clone, Debug)]
enum OutputFormat {
    Json,
    Text,
}

fn categorize_file(filename: &str) -> (String, String, Vec<String>) {
    let path = Path::new(filename);
    let mut semantic_tags = Vec::new();
    
    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
        let (category, subcategory, semantic_tags) = match ext.to_lowercase().as_str() {
            // Programming Languages
            "js" | "jsx" => {
                semantic_tags.push("javascript".to_string());
                semantic_tags.push("web".to_string());
                if filename.contains("test") || filename.contains("spec") {
                    semantic_tags.push("test".to_string());
                }
                ("Code".to_string(), "JavaScript".to_string(), semantic_tags)
            },
            "ts" | "tsx" => {
                semantic_tags.push("typescript".to_string());
                semantic_tags.push("web".to_string());
                semantic_tags.push("typed".to_string());
                if filename.contains("test") || filename.contains("spec") {
                    semantic_tags.push("test".to_string());
                }
                ("Code".to_string(), "TypeScript".to_string(), semantic_tags)
            },
            "mjs" => {
                semantic_tags.push("javascript".to_string());
                semantic_tags.push("module".to_string());
                ("Code".to_string(), "JavaScript Module".to_string(), semantic_tags)
            },
            "py" | "pyc" | "pyd" | "pyo" => {
                semantic_tags.push("python".to_string());
                semantic_tags.push("scripting".to_string());
                if filename.contains("test") || filename.contains("spec") {
                    semantic_tags.push("test".to_string());
                }
                ("Code".to_string(), "Python".to_string(), semantic_tags)
            },
            "rs" => {
                semantic_tags.push("rust".to_string());
                semantic_tags.push("systems".to_string());
                semantic_tags.push("memory-safe".to_string());
                ("Code".to_string(), "Rust".to_string(), semantic_tags)
            },
            "cpp" | "cxx" | "cc" | "c" => {
                semantic_tags.push("cpp".to_string());
                semantic_tags.push("systems".to_string());
                semantic_tags.push("native".to_string());
                ("Code".to_string(), "C/C++".to_string(), semantic_tags)
            },
            "h" | "hpp" => {
                semantic_tags.push("cpp".to_string());
                semantic_tags.push("header".to_string());
                ("Code".to_string(), "C/C++ Header".to_string(), semantic_tags)
            },
            "java" | "class" | "jar" => {
                semantic_tags.push("java".to_string());
                semantic_tags.push("jvm".to_string());
                ("Code".to_string(), "Java".to_string(), semantic_tags)
            },
            "go" => {
                semantic_tags.push("go".to_string());
                semantic_tags.push("concurrent".to_string());
                ("Code".to_string(), "Go".to_string(), semantic_tags)
            },
            "php" => {
                semantic_tags.push("php".to_string());
                semantic_tags.push("web".to_string());
                semantic_tags.push("server".to_string());
                ("Code".to_string(), "PHP".to_string(), semantic_tags)
            },
            "rb" => {
                semantic_tags.push("ruby".to_string());
                semantic_tags.push("scripting".to_string());
                ("Code".to_string(), "Ruby".to_string(), semantic_tags)
            },
            "swift" => {
                semantic_tags.push("swift".to_string());
                semantic_tags.push("ios".to_string());
                semantic_tags.push("apple".to_string());
                ("Code".to_string(), "Swift".to_string(), semantic_tags)
            },
            "kt" => {
                semantic_tags.push("kotlin".to_string());
                semantic_tags.push("jvm".to_string());
                semantic_tags.push("android".to_string());
                ("Code".to_string(), "Kotlin".to_string(), semantic_tags)
            },
            "scala" => {
                semantic_tags.push("scala".to_string());
                semantic_tags.push("jvm".to_string());
                semantic_tags.push("functional".to_string());
                ("Code".to_string(), "Scala".to_string(), semantic_tags)
            },
            "cs" => {
                semantic_tags.push("csharp".to_string());
                semantic_tags.push(".net".to_string());
                semantic_tags.push("microsoft".to_string());
                ("Code".to_string(), "C#".to_string(), semantic_tags)
            },
            "sh" | "bash" | "zsh" | "fish" => {
                semantic_tags.push("shell".to_string());
                semantic_tags.push("scripting".to_string());
                semantic_tags.push("unix".to_string());
                ("Scripts".to_string(), "Shell Script".to_string(), semantic_tags)
            },
            "ps1" => {
                semantic_tags.push("powershell".to_string());
                semantic_tags.push("windows".to_string());
                semantic_tags.push("automation".to_string());
                ("Scripts".to_string(), "PowerShell".to_string(), semantic_tags)
            },
            "bat" | "cmd" => {
                semantic_tags.push("batch".to_string());
                semantic_tags.push("windows".to_string());
                ("Scripts".to_string(), "Batch Script".to_string(), semantic_tags)
            },
            "sql" => {
                semantic_tags.push("sql".to_string());
                semantic_tags.push("database".to_string());
                semantic_tags.push("query".to_string());
                ("Data".to_string(), "SQL".to_string(), semantic_tags)
            },
            "r" => {
                semantic_tags.push("r".to_string());
                semantic_tags.push("statistics".to_string());
                semantic_tags.push("data-science".to_string());
                ("Code".to_string(), "R".to_string(), semantic_tags)
            },
            "lua" => {
                semantic_tags.push("lua".to_string());
                semantic_tags.push("scripting".to_string());
                semantic_tags.push("embedded".to_string());
                ("Code".to_string(), "Lua".to_string(), semantic_tags)
            },
            "dart" => {
                semantic_tags.push("dart".to_string());
                semantic_tags.push("flutter".to_string());
                semantic_tags.push("mobile".to_string());
                ("Code".to_string(), "Dart".to_string(), semantic_tags)
            },
            "hs" => {
                semantic_tags.push("haskell".to_string());
                semantic_tags.push("functional".to_string());
                ("Code".to_string(), "Haskell".to_string(), semantic_tags)
            },
            "nim" => {
                semantic_tags.push("nim".to_string());
                semantic_tags.push("systems".to_string());
                ("Code".to_string(), "Nim".to_string(), semantic_tags)
            },
            "zig" => {
                semantic_tags.push("zig".to_string());
                semantic_tags.push("systems".to_string());
                ("Code".to_string(), "Zig".to_string(), semantic_tags)
            },
            
            // Web Technologies
            "html" | "htm" | "xhtml" => {
                semantic_tags.push("html".to_string());
                semantic_tags.push("web".to_string());
                semantic_tags.push("markup".to_string());
                ("Web".to_string(), "HTML".to_string(), semantic_tags)
            },
            "css" | "scss" | "sass" | "less" => {
                semantic_tags.push("css".to_string());
                semantic_tags.push("styling".to_string());
                semantic_tags.push("web".to_string());
                ("Web".to_string(), "CSS".to_string(), semantic_tags)
            },
            "vue" => {
                semantic_tags.push("vue".to_string());
                semantic_tags.push("framework".to_string());
                semantic_tags.push("web".to_string());
                ("Web".to_string(), "Vue".to_string(), semantic_tags)
            },
            "svelte" => {
                semantic_tags.push("svelte".to_string());
                semantic_tags.push("framework".to_string());
                semantic_tags.push("web".to_string());
                ("Web".to_string(), "Svelte".to_string(), semantic_tags)
            },
            
            // Configuration & Data
            "json" => {
                semantic_tags.push("json".to_string());
                semantic_tags.push("data".to_string());
                semantic_tags.push("structured".to_string());
                ("Config".to_string(), "JSON".to_string(), semantic_tags)
            },
            "xml" => {
                semantic_tags.push("xml".to_string());
                semantic_tags.push("data".to_string());
                semantic_tags.push("markup".to_string());
                ("Config".to_string(), "XML".to_string(), semantic_tags)
            },
            "yaml" | "yml" => {
                semantic_tags.push("yaml".to_string());
                semantic_tags.push("config".to_string());
                ("Config".to_string(), "YAML".to_string(), semantic_tags)
            },
            "toml" => {
                semantic_tags.push("toml".to_string());
                semantic_tags.push("config".to_string());
                ("Config".to_string(), "TOML".to_string(), semantic_tags)
            },
            "ini" | "conf" | "config" => {
                semantic_tags.push("config".to_string());
                semantic_tags.push("settings".to_string());
                ("Config".to_string(), "Configuration".to_string(), semantic_tags)
            },
            "env" => {
                semantic_tags.push("environment".to_string());
                semantic_tags.push("secrets".to_string());
                semantic_tags.push("config".to_string());
                ("Config".to_string(), "Environment".to_string(), semantic_tags)
            },
            "lock" => {
                semantic_tags.push("lock".to_string());
                semantic_tags.push("dependency".to_string());
                semantic_tags.push("version".to_string());
                ("Config".to_string(), "Lock File".to_string(), semantic_tags)
            },
            
            // Documents
            "pdf" => {
                semantic_tags.push("pdf".to_string());
                semantic_tags.push("document".to_string());
                ("Documents".to_string(), "PDF".to_string(), semantic_tags)
            },
            "doc" | "docx" => {
                semantic_tags.push("word".to_string());
                semantic_tags.push("document".to_string());
                semantic_tags.push("office".to_string());
                ("Documents".to_string(), "Word".to_string(), semantic_tags)
            },
            "xls" | "xlsx" => {
                semantic_tags.push("excel".to_string());
                semantic_tags.push("spreadsheet".to_string());
                semantic_tags.push("data".to_string());
                ("Documents".to_string(), "Excel".to_string(), semantic_tags)
            },
            "ppt" | "pptx" => {
                semantic_tags.push("powerpoint".to_string());
                semantic_tags.push("presentation".to_string());
                semantic_tags.push("office".to_string());
                ("Documents".to_string(), "PowerPoint".to_string(), semantic_tags)
            },
            "txt" | "rtf" | "odt" | "ods" | "odp" => {
                semantic_tags.push("document".to_string());
                semantic_tags.push("text".to_string());
                ("Documents".to_string(), "Document".to_string(), semantic_tags)
            },
            "md" | "markdown" => {
                semantic_tags.push("markdown".to_string());
                semantic_tags.push("documentation".to_string());
                semantic_tags.push("text".to_string());
                ("Documents".to_string(), "Markdown".to_string(), semantic_tags)
            },
            "tex" => {
                semantic_tags.push("latex".to_string());
                semantic_tags.push("academic".to_string());
                semantic_tags.push("document".to_string());
                ("Documents".to_string(), "LaTeX".to_string(), semantic_tags)
            },
            
            // Images
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "tiff" | "webp" => {
                semantic_tags.push("image".to_string());
                semantic_tags.push("media".to_string());
                ("Media".to_string(), "Image".to_string(), semantic_tags)
            },
            "svg" | "ico" => {
                semantic_tags.push("vector".to_string());
                semantic_tags.push("image".to_string());
                ("Media".to_string(), "Vector Image".to_string(), semantic_tags)
            },
            "psd" => {
                semantic_tags.push("photoshop".to_string());
                semantic_tags.push("design".to_string());
                ("Media".to_string(), "Photoshop".to_string(), semantic_tags)
            },
            "ai" => {
                semantic_tags.push("illustrator".to_string());
                semantic_tags.push("design".to_string());
                ("Media".to_string(), "Illustrator".to_string(), semantic_tags)
            },
            "sketch" => {
                semantic_tags.push("sketch".to_string());
                semantic_tags.push("design".to_string());
                semantic_tags.push("ui".to_string());
                ("Media".to_string(), "Sketch".to_string(), semantic_tags)
            },
            
            // Audio
            "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" => {
                semantic_tags.push("audio".to_string());
                semantic_tags.push("media".to_string());
                ("Media".to_string(), "Audio".to_string(), semantic_tags)
            },
            
            // Video
            "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" => {
                semantic_tags.push("video".to_string());
                semantic_tags.push("media".to_string());
                ("Media".to_string(), "Video".to_string(), semantic_tags)
            },
            
            // Archives
            "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "tgz" => {
                semantic_tags.push("archive".to_string());
                semantic_tags.push("compressed".to_string());
                ("Archives".to_string(), "Archive".to_string(), semantic_tags)
            },
            
            // Fonts
            "ttf" | "otf" | "woff" | "woff2" | "eot" => {
                semantic_tags.push("font".to_string());
                semantic_tags.push("typography".to_string());
                ("Assets".to_string(), "Font".to_string(), semantic_tags)
            },
            
            // System
            "exe" | "msi" => {
                semantic_tags.push("executable".to_string());
                semantic_tags.push("windows".to_string());
                ("System".to_string(), "Executable".to_string(), semantic_tags)
            },
            "deb" | "rpm" => {
                semantic_tags.push("package".to_string());
                semantic_tags.push("linux".to_string());
                ("System".to_string(), "Package".to_string(), semantic_tags)
            },
            "dmg" | "app" => {
                semantic_tags.push("executable".to_string());
                semantic_tags.push("macos".to_string());
                ("System".to_string(), "Executable".to_string(), semantic_tags)
            },
            "dll" => {
                semantic_tags.push("library".to_string());
                semantic_tags.push("windows".to_string());
                ("System".to_string(), "Library".to_string(), semantic_tags)
            },
            "so" => {
                semantic_tags.push("library".to_string());
                semantic_tags.push("linux".to_string());
                ("System".to_string(), "Library".to_string(), semantic_tags)
            },
            "dylib" => {
                semantic_tags.push("library".to_string());
                semantic_tags.push("macos".to_string());
                ("System".to_string(), "Library".to_string(), semantic_tags)
            },
            "sys" | "drv" => {
                semantic_tags.push("system".to_string());
                semantic_tags.push("driver".to_string());
                ("System".to_string(), "System File".to_string(), semantic_tags)
            },
            
            // Development
            "gitignore" | "gitattributes" => {
                semantic_tags.push("git".to_string());
                semantic_tags.push("version-control".to_string());
                ("Dev".to_string(), "Git".to_string(), semantic_tags)
            },
            "dockerfile" => {
                semantic_tags.push("docker".to_string());
                semantic_tags.push("container".to_string());
                semantic_tags.push("devops".to_string());
                ("Dev".to_string(), "Docker".to_string(), semantic_tags)
            },
            "makefile" => {
                semantic_tags.push("make".to_string());
                semantic_tags.push("build".to_string());
                ("Dev".to_string(), "Make".to_string(), semantic_tags)
            },
            "cmake" => {
                semantic_tags.push("cmake".to_string());
                semantic_tags.push("build".to_string());
                ("Dev".to_string(), "CMake".to_string(), semantic_tags)
            },
            
            // Cache/Temp
            "cache" | "tmp" | "temp" | "log" => {
                semantic_tags.push("temporary".to_string());
                semantic_tags.push("cleanup".to_string());
                ("System".to_string(), "Cache/Temp".to_string(), semantic_tags)
            },
            
            _ => {
                semantic_tags.push("unknown".to_string());
                ("Other".to_string(), "Unknown".to_string(), semantic_tags)
            }
        };
        (category, subcategory, semantic_tags)
    } else {
        // No extension, check filename patterns
        let filename_lower = filename.to_lowercase();
        if filename_lower.contains("makefile") || filename_lower.contains("cmake") {
            semantic_tags.push("build".to_string());
            ("Dev".to_string(), "Build System".to_string(), semantic_tags)
        } else if filename_lower.contains("readme") || filename_lower.contains("license") {
            semantic_tags.push("documentation".to_string());
            ("Documents".to_string(), "Documentation".to_string(), semantic_tags)
        } else if filename_lower.contains("dockerfile") {
            semantic_tags.push("docker".to_string());
            semantic_tags.push("container".to_string());
            ("Dev".to_string(), "Docker".to_string(), semantic_tags)
        } else if filename.starts_with('.') {
            semantic_tags.push("hidden".to_string());
            semantic_tags.push("config".to_string());
            ("Config".to_string(), "Hidden/Config".to_string(), semantic_tags)
        } else if filename_lower.contains("test") {
            semantic_tags.push("test".to_string());
            ("Dev".to_string(), "Test Files".to_string(), semantic_tags)
        } else {
            semantic_tags.push("unknown".to_string());
            ("Other".to_string(), "Other".to_string(), semantic_tags)
        }
    }
}

fn create_file_info(entry: &walkdir::DirEntry, metadata: &fs::Metadata) -> FileInfo {
    let path = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();
    let path_str = path.to_string_lossy().to_string();
    
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase());
    
    let (category, subcategory, semantic_tags) = if metadata.is_dir() {
        ("Directory".to_string(), "Folder".to_string(), vec!["directory".to_string(), "folder".to_string()])
    } else {
        categorize_file(&name)
    };
    
    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .unwrap_or_default()
        .as_secs();
    
    let created = metadata
        .created()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .unwrap_or_default()
        .as_secs();

    FileInfo {
        name,
        path: path_str,
        size: metadata.len(),
        extension,
        category,
        subcategory,
        semantic_tags,
        modified,
        created,
        is_hidden: entry.file_name().to_string_lossy().starts_with('.'),
        is_directory: metadata.is_dir(),
    }
}

fn scan_directory(
    directory_path: &str,
    max_depth: usize,
    include_hidden: bool,
    use_parallel: bool,
    max_files: usize,
    show_progress: bool,
) -> Result<ScanResult, String> {
    let start_time = SystemTime::now();
    
    let path = Path::new(directory_path);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Directory does not exist or is not a directory: {}", directory_path));
    }

    let (sender, receiver) = crossbeam::channel::bounded::<FileInfo>(10000);
    let walker = WalkDir::new(directory_path)
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
        let entries: Vec<_> = walker
            .filter_entry(|e| {
                if !include_hidden && e.file_name().to_string_lossy().starts_with('.') {
                    return false;
                }
                true
            })
            .into_iter()
            .collect();

        entries.into_par_iter().for_each(|entry_result| {
            // Check if we've hit our file limit
            if total_files_processed.load(std::sync::atomic::Ordering::SeqCst) >= max_files_atomic.load(std::sync::atomic::Ordering::SeqCst) {
                return;
            }
            
            if let Ok(entry) = entry_result {
                if let Ok(metadata) = entry.metadata() {
                    let file_info = create_file_info(&entry, &metadata);
                    
                    if total_files_processed.load(std::sync::atomic::Ordering::SeqCst) < max_files_atomic.load(std::sync::atomic::Ordering::SeqCst) {
                        if sender.send(file_info).is_err() {
                            return;
                        }
                    }
                    
                    total_files_processed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    
                    if show_progress {
                        let count = total_files_processed.load(std::sync::atomic::Ordering::SeqCst);
                        if count % 1000 == 0 {
                            eprint!("\rScanned: {} files", count);
                            io::stderr().flush().unwrap();
                        }
                    }
                }
            }
        });
    } else {
        // Sequential processing for smaller directories
        for entry_result in walker.filter_entry(|e| {
            if !include_hidden && e.file_name().to_string_lossy().starts_with('.') {
                return false;
            }
            true
        }) {
            if total_files_processed.load(std::sync::atomic::Ordering::SeqCst) >= max_files_atomic.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }
            
            match entry_result {
                Ok(entry) => {
                    if let Ok(metadata) = entry.metadata() {
                        let file_info = create_file_info(&entry, &metadata);
                        
                        if total_files_processed.load(std::sync::atomic::Ordering::SeqCst) < max_files_atomic.load(std::sync::atomic::Ordering::SeqCst) {
                            if sender.send(file_info).is_err() {
                                break;
                            }
                        }
                        
                        total_files_processed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        
                        if show_progress {
                            let count = total_files_processed.load(std::sync::atomic::Ordering::SeqCst);
                            if count % 1000 == 0 {
                                eprint!("\rScanned: {} files", count);
                                io::stderr().flush().unwrap();
                            }
                        }
                    }
                }
                Err(_) => continue,
            }
        }
    }

    if show_progress {
        eprintln!();
    }

    drop(sender);

    let (files, total_size, categories) = match collector_handle.join() {
        Ok(result) => result,
        Err(e) => {
            let panic_msg = if let Some(s) = e.downcast_ref::<String>() {
                s.clone()
            } else if let Some(s) = e.downcast_ref::<&str>() {
                s.to_string()
            } else {
                "Thread panicked with unknown error".to_string()
            };
            return Err(format!("Thread join failed: {}", panic_msg));
        }
    };
    
    let actual_total_files = total_files_processed.load(std::sync::atomic::Ordering::SeqCst);
    
    let scan_time = SystemTime::now()
        .duration_since(start_time)
        .map_err(|_| "Time calculation failed".to_string())?
        .as_millis() as u64;

    Ok(ScanResult {
        total_files: actual_total_files,
        files,
        total_size,
        scan_time_ms: scan_time,
        categories,
    })
}

fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    format!("{:.2} {}", size, UNITS[unit_index])
}

fn print_text_result(result: &ScanResult) {
    println!("=== Space Analysis Results ===");
    println!();
    println!("Total files: {}", result.total_files);
    println!("Total size: {}", format_bytes(result.total_size));
    println!("Scan time: {}ms", result.scan_time_ms);
    println!();
    println!("=== Categories ===");
    
    let mut categories: Vec<_> = result.categories.iter().collect();
    categories.sort_by(|a, b| b.1.size.cmp(&a.1.size));
    
    for (category, info) in categories {
        println!("{}: {} files ({})", category, info.count, format_bytes(info.size));
    }
}

fn main() {
    let cli = Cli::parse();

    match scan_directory(
        &cli.directory,
        cli.max_depth,
        cli.hidden,
        cli.parallel,
        cli.max_files,
        cli.progress,
    ) {
        Ok(result) => {
            let output = match cli.format {
                OutputFormat::Json => serde_json::to_string_pretty(&result).unwrap(),
                OutputFormat::Text => {
                    print_text_result(&result);
                    return;
                }
            };

            if let Some(output_path) = cli.output {
                fs::write(&output_path, &output).expect("Failed to write output file");
                println!("Results written to: {}", output_path);
            } else {
                println!("{}", output);
            }
        }
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    }
}
