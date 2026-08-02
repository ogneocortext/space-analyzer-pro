use crate::cli::types::ScanResult;
use shared_scanner::format_bytes;

pub fn print_cleanup_recommendations(result: &ScanResult) {
    println!("\n🧹 CLEANUP RECOMMENDATIONS");
    println!("   Actionable steps to reclaim disk space:\n");

    let mut actions: Vec<(u32, String)> = Vec::new();

    for dir in &result.top_directories {
        let lower = dir.path.to_lowercase();
        if lower.contains("cache") || lower.contains("temp") || lower.contains("tmp") {
            actions.push((
                3,
                format!(
                    "🗑️  Cache/temp: `{}` ({} files) — Safe to clear via disk cleanup or app settings",
                    dir.path,
                    dir.file_count
                ),
            ));
        }
    }

    let installer_size: u64 = result
        .largest_files
        .iter()
        .filter(|file| {
            let lower = file.path.to_lowercase();
            lower.ends_with(".exe") || lower.ends_with(".msi") || lower.ends_with(".zip")
        })
        .map(|file| file.size)
        .sum();
    if installer_size > 100 * 1024 * 1024 {
        actions.push((3, format!(
            "📦 Installers: {} in installer files — Remove old installers after confirming apps work",
            format_bytes(installer_size)
        )));
    }

    for file in &result.largest_files {
        let path = &file.path;
        let size = file.size;
        let lower = path.to_lowercase();
        if size > 100 * 1024 * 1024 {
            if lower.contains("ollama") || lower.contains("models") || lower.contains("blobs") {
                actions.push((
                    2,
                    format!(
                        "🤖 AI Model: `{}` ({}) — Consider `ollama prune` or removing unused models",
                        path, format_bytes(size)
                    ),
                ));
            } else if lower.contains(".cache") || lower.contains("pip") {
                actions.push((
                    2,
                    format!(
                        "🐍 Cache: `{}` ({}) — Consider `pip cache purge` or manual cleanup",
                        path,
                        format_bytes(size)
                    ),
                ));
            }
        }
    }

    let node_modules_size: u64 = result
        .largest_files
        .iter()
        .filter(|file| {
            let lower = file.path.to_lowercase();
            lower.contains("node_modules")
        })
        .map(|file| file.size)
        .sum();
    if node_modules_size > 100 * 1024 * 1024 {
        actions.push((
            1,
            format!(
                "📦 Node modules: {} across projects — Run `npm prune` or delete in build folders",
                format_bytes(node_modules_size)
            ),
        ));
    }

    actions.sort_by_key(|a| std::cmp::Reverse(a.0));
    for (_, action) in &actions {
        println!("   {}", action);
    }

    if actions.is_empty() {
        println!("   ✅ No major cleanup opportunities found.");
    }

    println!("\n💡 Pro tip: Use `--report` to save a detailed markdown report");
}
