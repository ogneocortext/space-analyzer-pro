#include <napi.h>
#include <node_api.h>
#include <string>
#include <vector>
#include <filesystem>
#include <chrono>
#include <memory>
#include <atomic>
#include <thread>
#include <mutex>
#include <algorithm>
#include <unordered_map>
#include <cstdio>  // For NDEBUG debug output

namespace fs = std::filesystem;

struct FileInfo {
    std::string name;
    std::string path;
    uint64_t size;
    std::string extension;
    std::string category;
    uint64_t modified;
    bool is_hidden;
    bool is_directory;
};

struct ScanResult {
    std::vector<FileInfo> files;
    size_t total_files;
    uint64_t total_size;  // Changed from atomic to regular uint64_t
    uint64_t scan_time_ms;
    std::unordered_map<std::string, std::pair<size_t, uint64_t>> categories;
    std::string error_message;
    bool success;
    size_t max_files_to_return;  // Limit for large directories
    
    ScanResult() : total_files(0), total_size(0), scan_time_ms(0), success(false), max_files_to_return(10000) {}
};

std::string categorize_file(const std::string& extension) {
    if (extension.empty()) {
        return "Other";
    }

    std::string ext = extension;
    // Convert to lowercase
    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);

    // Remove leading dot if present
    if (!ext.empty() && ext[0] == '.') {
        ext = ext.substr(1);
    }

    // AI/ML Frameworks and Libraries
    if (ext == "onnx" || ext == "pb" || ext == "h5" || ext == "hdf5" || ext == "pkl" ||
        ext == "joblib" || ext == "model" || ext == "tflite" || ext == "mlmodel") {
        return "AI/ML Models";
    } else if (ext == "ipynb") {
        return "Jupyter Notebooks";
    } else if (ext == "ckpt" || ext == "pth" || ext == "pt" || ext == "safetensors" ||
               ext == "bin" || ext == "index" || ext == "meta") {
        return "AI Checkpoints";
    } else if (ext == "tokenizer" || ext == "vocab" || ext == "merges") {
        return "AI Tokenizers";
    }

    // Programming Languages
    if (ext == "js" || ext == "jsx" || ext == "ts" || ext == "tsx" || ext == "mjs") {
        return "JavaScript/TypeScript";
    } else if (ext == "py" || ext == "pyc" || ext == "pyd" || ext == "pyo") {
        return "Python";
    } else if (ext == "rs") {
        return "Rust";
    } else if (ext == "cpp" || ext == "cxx" || ext == "cc" || ext == "c" || ext == "h" || ext == "hpp") {
        return "C/C++";
    } else if (ext == "java" || ext == "class" || ext == "jar" || ext == "gradle") {
        return "Java";
    } else if (ext == "go") {
        return "Go";
    } else if (ext == "php") {
        return "PHP";
    } else if (ext == "rb") {
        return "Ruby";
    } else if (ext == "swift") {
        return "Swift";
    } else if (ext == "kt") {
        return "Kotlin";
    } else if (ext == "scala") {
        return "Scala";
    } else if (ext == "cs") {
        return "C#";
    } else if (ext == "vb") {
        return "Visual Basic";
    } else if (ext == "sh" || ext == "bash" || ext == "zsh" || ext == "fish" || ext == "ps1" || ext == "bat" || ext == "cmd") {
        return "Shell/Scripts";
    } else if (ext == "sql") {
        return "SQL";
    } else if (ext == "r") {
        return "R";
    } else if (ext == "m") {
        return "MATLAB/Objective-C";
    } else if (ext == "lua") {
        return "Lua";
    } else if (ext == "dart") {
        return "Dart";
    } else if (ext == "elm") {
        return "Elm";
    } else if (ext == "hs") {
        return "Haskell";
    } else if (ext == "ml" || ext == "mli") {
        return "OCaml";
    } else if (ext == "nim") {
        return "Nim";
    } else if (ext == "zig") {
        return "Zig";
    } else if (ext == "v") {
        return "V";

    // Web Technologies
    } else if (ext == "html" || ext == "htm" || ext == "xhtml") {
        return "HTML";
    } else if (ext == "css" || ext == "scss" || ext == "sass" || ext == "less") {
        return "CSS";
    } else if (ext == "vue") {
        return "Vue";
    } else if (ext == "svelte") {
        return "Svelte";

    // Configuration & Data
    } else if (ext == "json" || ext == "xml" || ext == "yaml" || ext == "yml" || ext == "toml" ||
               ext == "ini" || ext == "conf" || ext == "config") {
        return "Configuration/Data";
    } else if (ext == "csv" || ext == "tsv" || ext == "parquet" || ext == "feather" || ext == "avro") {
        return "Data Files";
    } else if (ext == "db" || ext == "sqlite" || ext == "sqlite3") {
        return "Database";
    } else if (ext == "env") {
        return "Environment";
    } else if (ext == "lock") {
        return "Lock File";

    // Documents
    } else if (ext == "pdf") {
        return "PDF";
    } else if (ext == "doc" || ext == "docx") {
        return "Word";
    } else if (ext == "xls" || ext == "xlsx") {
        return "Excel";
    } else if (ext == "ppt" || ext == "pptx") {
        return "PowerPoint";
    } else if (ext == "txt" || ext == "rtf" || ext == "odt" || ext == "ods" || ext == "odp") {
        return "Documents";
    } else if (ext == "md" || ext == "markdown") {
        return "Markdown";
    } else if (ext == "tex") {
        return "LaTeX";

    // Images
    } else if (ext == "jpg" || ext == "jpeg" || ext == "png" || ext == "gif" || ext == "bmp" ||
               ext == "tiff" || ext == "webp" || ext == "svg" || ext == "ico") {
        return "Images";
    } else if (ext == "psd") {
        return "Photoshop";
    } else if (ext == "ai") {
        return "Illustrator";
    } else if (ext == "sketch") {
        return "Sketch";

    // Audio
    } else if (ext == "mp3" || ext == "wav" || ext == "flac" || ext == "aac" || ext == "ogg" ||
               ext == "wma" || ext == "m4a") {
        return "Audio";

    // Video
    } else if (ext == "mp4" || ext == "avi" || ext == "mkv" || ext == "mov" || ext == "wmv" ||
               ext == "flv" || ext == "webm") {
        return "Video";

    // Archives
    } else if (ext == "zip" || ext == "rar" || ext == "7z" || ext == "tar" || ext == "gz" ||
               ext == "bz2" || ext == "xz" || ext == "tgz") {
        return "Archives";

    // Fonts
    } else if (ext == "ttf" || ext == "otf" || ext == "woff" || ext == "woff2" || ext == "eot") {
        return "Fonts";

    // System
    } else if (ext == "exe" || ext == "msi" || ext == "deb" || ext == "rpm" || ext == "dmg" || ext == "app") {
        return "Executables";
    } else if (ext == "dll" || ext == "so" || ext == "dylib") {
        return "Libraries";
    } else if (ext == "sys" || ext == "drv") {
        return "System Files";

    // Development
    } else if (ext == "gitignore" || ext == "gitattributes") {
        return "Git";
    } else if (ext == "dockerfile") {
        return "Docker";
    } else if (ext == "makefile") {
        return "Make";
    } else if (ext == "cmake") {
        return "CMake";

    // Cache/Temp
    } else if (ext == "cache" || ext == "tmp" || ext == "temp" || ext == "log") {
        return "Cache/Temp";
    }

    return "Other";
}

ScanResult scan_directory_simple(const std::string& directory_path, size_t max_files = 10000) {
    auto start_time = std::chrono::steady_clock::now();

    ScanResult result = {};  // Zero-initialize all members
    result.success = true;
    result.error_message = "";
    result.max_files_to_return = max_files;
    result.total_files = 0;
    result.total_size = 0;
    result.scan_time_ms = 0;

    fs::path path(directory_path);

    if (!fs::exists(path)) {
        result.success = false;
        result.error_message = "Directory does not exist: " + directory_path;
        return result;
    }

    if (!fs::is_directory(path)) {
        result.success = false;
        result.error_message = "Path is not a directory: " + directory_path;
        return result;
    }

    std::atomic<size_t> file_count{0};
    std::mutex result_mutex;

    try {
        // Reserve space for better performance
        result.files.reserve(std::min(static_cast<size_t>(max_files), static_cast<size_t>(10000)));
        
        for (const auto& entry : fs::recursive_directory_iterator(path)) {
            // Check if we've hit our file limit
            if (file_count.load() >= max_files) {
                break;
            }
            
            try {
                if (entry.is_regular_file() || entry.is_directory()) {
                    FileInfo file_info;
                    file_info.name = entry.path().filename().string();
                    file_info.path = entry.path().string();

                    // Handle potential errors in file operations
                    try {
                        file_info.size = entry.file_size();
                    } catch (const std::exception&) {
                        file_info.size = 0; // Default to 0 on error
                    }

                    file_info.extension = entry.path().extension().string();
                    // Remove leading dot from extension for categorization
                    std::string ext_for_categorization = file_info.extension;
                    if (!ext_for_categorization.empty() && ext_for_categorization[0] == '.') {
                        ext_for_categorization = ext_for_categorization.substr(1);
                    }
                    file_info.category = categorize_file(ext_for_categorization);
                    file_info.is_hidden = (!file_info.name.empty() && file_info.name[0] == '.');
                    file_info.is_directory = entry.is_directory();

                    try {
                        auto ftime = entry.last_write_time();
                        auto sctp = std::chrono::time_point_cast<std::chrono::system_clock::duration>(ftime);
                        file_info.modified = std::chrono::duration_cast<std::chrono::seconds>(sctp.time_since_epoch()).count();
                    } catch (const std::exception&) {
                        file_info.modified = 0; // Default to 0 on error
                    }

                    // Only store file details if we're under limit
                    if (file_count.load() < max_files) {
                        std::lock_guard<std::mutex> lock(result_mutex);
                        result.files.push_back(std::move(file_info));
                    }
                    
                    // Update totals regardless of storage limit
                    result.total_size += file_info.size;
                    file_count.fetch_add(1, std::memory_order_relaxed);
                    
                    // Update categories
                    {
                        std::lock_guard<std::mutex> lock(result_mutex);
                        auto& cat_info = result.categories[file_info.category];
                        cat_info.first++;
                        cat_info.second += file_info.size;
                    }
                }
            } catch (const std::exception&) {
                // Skip problematic entries but continue scanning
                continue;
            }
        }
        
        result.total_files = file_count.load();
    } catch (const std::exception& e) {
        result.success = false;
        result.error_message = "Error scanning directory: " + std::string(e.what());
        result.files.clear(); // Clear partial results on error
        result.categories.clear();
        result.total_size = 0;
        result.total_files = 0;
    }

    auto end_time = std::chrono::steady_clock::now();
    result.scan_time_ms = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count();

    return result;
}

// NAPI function to scan directory
napi_value scan_directory(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_status status = napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    #ifndef NDEBUG
    printf("DEBUG: argc = %zu\n", argc);
    #endif
    
    if (status != napi_ok || argc < 1) {
        #ifndef NDEBUG
        printf("DEBUG: Invalid arguments - status=%d, argc=%zu\n", status, argc);
        #endif
        napi_throw_error(env, nullptr, "Invalid arguments");
        return nullptr;
    }
    
    // Get directory path from argument
    size_t str_len;
    status = napi_get_value_string_utf8(env, args[0], nullptr, 0, &str_len);
    if (status != napi_ok) {
        napi_throw_error(env, nullptr, "Failed to get string length");
        return nullptr;
    }
    
    std::string directory_path;
    directory_path.resize(str_len);
    status = napi_get_value_string_utf8(env, args[0], &directory_path[0], str_len + 1, &str_len);
    if (status != napi_ok) {
        napi_throw_error(env, nullptr, "Failed to get string value");
        return nullptr;
    }
    
    // Get optional max_files parameter
    size_t max_files = 10000;  // Default limit
    if (argc >= 2) {
        bool is_buffer;
        status = napi_is_buffer(env, args[1], &is_buffer);
        if (status == napi_ok && is_buffer) {
            // Handle BigInt if passed
            void* data;
            size_t length;
            status = napi_get_buffer_info(env, args[1], &data, &length);
            if (status == napi_ok && length == sizeof(uint64_t)) {
                max_files = *static_cast<uint64_t*>(data);
            }
        } else {
            // Try to get as number
            int64_t max_files_int;
            status = napi_get_value_int64(env, args[1], &max_files_int);
            if (status == napi_ok && max_files_int > 0) {
                max_files = static_cast<size_t>(max_files_int);
            }
        }
    }
    
    // Perform scan
    ScanResult scan_result = scan_directory_simple(directory_path, max_files);
    
    // Create result object
    napi_value result_obj, files_array, categories_obj;
    status = napi_create_object(env, &result_obj);
    if (status != napi_ok) return nullptr;
    
    // Create files array
    status = napi_create_array_with_length(env, scan_result.files.size(), &files_array);
    if (status != napi_ok) return nullptr;
    
    for (size_t i = 0; i < scan_result.files.size(); i++) {
        const auto& file = scan_result.files[i];
        napi_value file_obj;
        status = napi_create_object(env, &file_obj);
        if (status != napi_ok) return nullptr;
        
        // Set file properties
        napi_value name_val, path_val, size_val, ext_val, cat_val, modified_val, hidden_val, dir_val;
        
        napi_create_string_utf8(env, file.name.c_str(), NAPI_AUTO_LENGTH, &name_val);
        napi_create_string_utf8(env, file.path.c_str(), NAPI_AUTO_LENGTH, &path_val);
        napi_create_double(env, static_cast<double>(file.size), &size_val);
        napi_create_string_utf8(env, file.extension.c_str(), NAPI_AUTO_LENGTH, &ext_val);
        napi_create_string_utf8(env, file.category.c_str(), NAPI_AUTO_LENGTH, &cat_val);
        napi_create_double(env, static_cast<double>(file.modified), &modified_val);
        napi_get_boolean(env, file.is_hidden, &hidden_val);
        napi_get_boolean(env, file.is_directory, &dir_val);
        
        napi_set_named_property(env, file_obj, "name", name_val);
        napi_set_named_property(env, file_obj, "path", path_val);
        napi_set_named_property(env, file_obj, "size", size_val);
        napi_set_named_property(env, file_obj, "extension", ext_val);
        napi_set_named_property(env, file_obj, "category", cat_val);
        napi_set_named_property(env, file_obj, "modified", modified_val);
        napi_set_named_property(env, file_obj, "isHidden", hidden_val);
        napi_set_named_property(env, file_obj, "isDirectory", dir_val);
        
        napi_set_element(env, files_array, i, file_obj);
    }
    
    // Create categories object
    status = napi_create_object(env, &categories_obj);
    if (status != napi_ok) return nullptr;
    
    for (const auto& [category, info] : scan_result.categories) {
        napi_value cat_obj, count_val, size_val;
        napi_create_object(env, &cat_obj);
        napi_create_double(env, static_cast<double>(info.first), &count_val);
        napi_create_double(env, static_cast<double>(info.second), &size_val);
        napi_set_named_property(env, cat_obj, "count", count_val);
        napi_set_named_property(env, cat_obj, "size", size_val);
        napi_set_named_property(env, categories_obj, category.c_str(), cat_obj);
    }
    
    // Set result properties
    napi_value total_files_val, total_size_val, scan_time_val, success_val, error_val;
    napi_create_double(env, static_cast<double>(scan_result.total_files), &total_files_val);
    napi_create_double(env, static_cast<double>(scan_result.total_size), &total_size_val);
    napi_create_double(env, static_cast<double>(scan_result.scan_time_ms), &scan_time_val);
    napi_get_boolean(env, scan_result.success, &success_val);
    napi_create_string_utf8(env, scan_result.error_message.c_str(), NAPI_AUTO_LENGTH, &error_val);

    napi_set_named_property(env, result_obj, "files", files_array);
    napi_set_named_property(env, result_obj, "totalFiles", total_files_val);
    napi_set_named_property(env, result_obj, "totalSize", total_size_val);
    napi_set_named_property(env, result_obj, "scanTimeMs", scan_time_val);
    napi_set_named_property(env, result_obj, "categories", categories_obj);
    napi_set_named_property(env, result_obj, "success", success_val);
    napi_set_named_property(env, result_obj, "errorMessage", error_val);
    
    return result_obj;
}

// Module initialization
napi_value Init(napi_env env, napi_value exports) {
    napi_status status;
    napi_property_descriptor desc = {"scanDirectory", nullptr, scan_directory, nullptr, nullptr, nullptr, napi_default, nullptr};
    
    status = napi_define_properties(env, exports, 1, &desc);
    if (status != napi_ok) {
        return nullptr;
    }
    
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)