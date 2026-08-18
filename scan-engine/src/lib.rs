//! Shared file scanner library for Space Analyzer Pro
//!
//! This crate provides a unified, high-performance file scanner
//! that replaces the duplicate implementations across the project.

pub mod categories;
pub mod formatting;
pub mod scanner;
pub mod types;

pub use categories::{category_for_extension, extension_to_category};
pub use formatting::{format_bytes, format_duration, size_bucket};
pub use scanner::get_system_info;
pub use scanner::FileScanner;
pub use types::{DirInfo, DriveInfo, FileInfo, ScanOptions, ScanProgress, ScanResult, SystemInfo};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(1024), "1.00 KB");
        assert_eq!(format_bytes(1048576), "1.00 MB");
        assert_eq!(format_bytes(1073741824), "1.00 GB");
    }

    #[test]
    fn test_size_bucket() {
        assert_eq!(size_bucket(0), "0 B");
        assert_eq!(size_bucket(512), "< 1 KB");
        assert_eq!(size_bucket(1024 * 1024), "1-10 MB");
        assert_eq!(size_bucket(100 * 1024 * 1024), "100 MB-1 GB");
        assert_eq!(size_bucket(1024 * 1024 * 1024), "> 1 GB");
    }

    #[test]
    fn test_scan_options_defaults() {
        let opts = ScanOptions::default();
        assert!(opts.max_depth.is_none());
        assert!(!opts.include_hidden);
        assert!(!opts.follow_symlinks);
    }

    #[test]
    fn test_scan_options_presets() {
        let shallow = ScanOptions::shallow();
        assert_eq!(shallow.max_depth, Some(1));

        let medium = ScanOptions::medium();
        assert_eq!(medium.max_depth, Some(5));

        let deep = ScanOptions::deep();
        assert!(deep.max_depth.is_none());
    }

    fn temp_scan_dir(name: &str) -> std::path::PathBuf {
        let dir =
            std::env::temp_dir().join(format!("sa_scan_test_{}_{}", name, std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_file(dir: &std::path::Path, rel: &str, content: &[u8]) {
        let p = dir.join(rel);
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(p, content).unwrap();
    }

    #[test]
    fn scan_sums_are_consistent_and_categories_correct() {
        let dir = temp_scan_dir("sums");
        write_file(&dir, "a.txt", b"hello");
        write_file(&dir, "sub/b.pdf", b"world!!");
        write_file(&dir, "sub/node_modules/lib.js", b"x");

        let scanner = FileScanner::new();
        let result = scanner
            .scan_directory_sync(dir.to_str().unwrap(), ScanOptions::default())
            .unwrap();

        let sum_ext: u64 = result.extension_sizes.values().copied().sum();
        let sum_cat: u64 = result.category_sizes.values().copied().sum();
        assert_eq!(sum_ext, result.total_size);
        assert_eq!(sum_cat, result.total_size);
        assert_eq!(result.total_size, 5 + 7 + 1);

        let dev = result
            .category_sizes
            .get("Development")
            .copied()
            .unwrap_or(0);
        assert_eq!(dev, 1);
    }

    #[test]
    fn hidden_files_excluded_by_default() {
        let dir = temp_scan_dir("hidden");
        write_file(&dir, "visible.txt", b"data");
        write_file(&dir, ".hidden", b"secret");

        let scanner = FileScanner::new();

        let excluded = scanner
            .scan_directory_sync(dir.to_str().unwrap(), ScanOptions::default())
            .unwrap();
        assert_eq!(excluded.total_files, 1);

        let included = scanner
            .scan_directory_sync(
                dir.to_str().unwrap(),
                ScanOptions {
                    include_hidden: true,
                    ..ScanOptions::default()
                },
            )
            .unwrap();
        assert_eq!(included.total_files, 2);
    }

    #[test]
    fn cache_does_not_bypass_size_filter() {
        let dir = temp_scan_dir("cache");
        write_file(&dir, "small.txt", b"tiny");
        write_file(&dir, "big.dat", b"muchlongercontent");

        let scanner = FileScanner::new();
        let full = scanner
            .scan_directory_sync(dir.to_str().unwrap(), ScanOptions::default())
            .unwrap();

        let min_size = 10u64;
        let with_cache = scanner
            .scan_directory_sync(
                dir.to_str().unwrap(),
                ScanOptions {
                    min_size: Some(min_size),
                    file_cache: Some(full.scanned_files.clone()),
                    ..ScanOptions::default()
                },
            )
            .unwrap();
        let without_cache = scanner
            .scan_directory_sync(
                dir.to_str().unwrap(),
                ScanOptions {
                    min_size: Some(min_size),
                    ..ScanOptions::default()
                },
            )
            .unwrap();

        assert_eq!(with_cache.total_files, without_cache.total_files);
        assert_eq!(with_cache.total_size, without_cache.total_size);
        assert_eq!(without_cache.total_files, 1);
        assert_eq!(without_cache.total_size, 17);
    }

    #[test]
    fn top_n_caps_largest_files() {
        let dir = temp_scan_dir("topn");
        for i in 0..5u32 {
            write_file(&dir, &format!("f{}.bin", i), &vec![0u8; (i as usize) + 1]);
        }

        let scanner = FileScanner::new();
        let result = scanner
            .scan_directory_sync(
                dir.to_str().unwrap(),
                ScanOptions {
                    top_n: 2,
                    ..ScanOptions::default()
                },
            )
            .unwrap();

        assert!(result.largest_files.len() <= 2);
        assert_eq!(result.largest_files.len(), 2);
    }

    #[test]
    fn extension_classification_covers_common_build_assets() {
        assert_eq!(category_for_extension("lib"), "Build Output");
        assert_eq!(category_for_extension("a"), "Build Output");
        assert_eq!(category_for_extension("pdb"), "Build Output");
        assert_eq!(category_for_extension("so"), "Build Output");
        assert_eq!(category_for_extension("dylib"), "Build Output");
        assert_eq!(category_for_extension("rlib"), "Build Output");
        assert_eq!(category_for_extension("rmeta"), "Build Output");
        assert_eq!(category_for_extension("o"), "Build Output");
        assert_eq!(category_for_extension("obj"), "Build Output");
        assert_eq!(category_for_extension("wasm"), "Build Output");
        assert_eq!(category_for_extension("pyc"), "Build Output");
        assert_eq!(category_for_extension("pyd"), "Build Output");

        assert_eq!(category_for_extension("jar"), "Archives");
        assert_eq!(category_for_extension("nupkg"), "Archives");
        assert_eq!(category_for_extension("asar"), "Archives");
        assert_eq!(category_for_extension("tgz"), "Archives");
        assert_eq!(category_for_extension("msix"), "Archives");
        assert_eq!(category_for_extension("appx"), "Archives");

        assert_eq!(category_for_extension("pak"), "Games");
        assert_eq!(category_for_extension("wad"), "Games");
        assert_eq!(category_for_extension("mpq"), "Games");

        assert_eq!(category_for_extension("qcow2"), "Virtual");
        assert_eq!(category_for_extension("vhd"), "Virtual");
        assert_eq!(category_for_extension("vhdx"), "Virtual");
        assert_eq!(category_for_extension("vmdk"), "Virtual");
        assert_eq!(category_for_extension("vdi"), "Virtual");
        assert_eq!(category_for_extension("img"), "Virtual");
        assert_eq!(category_for_extension("wim"), "Virtual");
        assert_eq!(category_for_extension("esd"), "Virtual");

        assert_eq!(category_for_extension("gguf"), "AI Models");
        assert_eq!(category_for_extension("safetensors"), "AI Models");
        assert_eq!(category_for_extension("onnx"), "AI Models");

        assert_eq!(category_for_extension("scr"), "Executables");
        assert_eq!(category_for_extension("com"), "Executables");
        assert_eq!(category_for_extension("apk"), "Executables");

        assert_eq!(category_for_extension("cat"), "System");
        assert_eq!(category_for_extension("mui"), "System");

        assert_eq!(category_for_extension("eot"), "Fonts");
        assert_eq!(category_for_extension("ttc"), "Fonts");

        assert_eq!(category_for_extension("epub"), "Documents");
        assert_eq!(category_for_extension("heic"), "Images");
        assert_eq!(category_for_extension("opus"), "Audio");
        assert_eq!(category_for_extension("3gp"), "Videos");
        assert_eq!(category_for_extension("duckdb"), "Databases");
    }

    #[test]
    fn path_overrides_classify_extensionless_and_disk_images() {
        assert_eq!(
            extension_to_category("", "C:\\Users\\me\\.ollama\\models\\blobs\\sha256-abc"),
            "AI Models"
        );
        assert_eq!(
            extension_to_category("bin", "C:\\Users\\me\\.gemini\\x\\weights.bin"),
            "AI Models"
        );
        assert_eq!(
            extension_to_category("bin", "C:\\build\\module.bin"),
            "Other"
        );
        assert_eq!(
            extension_to_category(
                "img",
                "C:\\Users\\me\\.android\\avd\\x.avd\\userdata-qemu.img"
            ),
            "Virtual"
        );
        assert_eq!(
            extension_to_category("qcow2", "C:\\Users\\me\\.android\\avd\\x.avd\\disk.qcow2"),
            "Virtual"
        );
        assert_eq!(
            extension_to_category("", "C:\\Windows\\System32\\config\\SYSTEM"),
            "System"
        );
        assert_eq!(
            extension_to_category("js", "C:\\proj\\node_modules\\x\\lib.js"),
            "Development"
        );
    }
}
