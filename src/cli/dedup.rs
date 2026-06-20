use file_deduplicator::{DeduplicationConfig, FileDeduplicator};
use shared_scanner::format_bytes;

pub fn run_clean_analysis(path: &str) {
    println!("🔗 DUPLICATE FILE ANALYSIS");
    println!("   Scanning for duplicate files (this may take a while)...");
    println!();

    let config = DeduplicationConfig {
        min_file_size: 1024,
        dry_run: true,
        create_hard_links: true,
        ..Default::default()
    };
    let deduplicator = FileDeduplicator::with_config(config);
    match deduplicator.scan_directory(path) {
        Ok(files) => {
            let duplicate_groups = deduplicator.find_duplicates(files);
            if duplicate_groups.is_empty() {
                println!("   ✅ No duplicate files found!");
            } else {
                let total_duplicates: usize =
                    duplicate_groups.iter().map(|g| g.files.len() - 1).sum();
                let dup_savings: u64 = duplicate_groups
                    .iter()
                    .map(|g| g.size * (g.files.len() as u64 - 1))
                    .sum();

                println!(
                    "   Found {} duplicate groups ({} duplicate files)",
                    duplicate_groups.len(),
                    total_duplicates
                );
                println!(
                    "   💾 Potential space savings: {}",
                    format_bytes(dup_savings)
                );
                println!();

                let mut sorted_groups = duplicate_groups;
                sorted_groups.sort_by(|a, b| {
                    let waste_a = a.size * (a.files.len() as u64 - 1);
                    let waste_b = b.size * (b.files.len() as u64 - 1);
                    waste_b.cmp(&waste_a)
                });

                println!("   Top duplicates by wasted space:");
                for (i, group) in sorted_groups.iter().take(15).enumerate() {
                    let waste = group.size * (group.files.len() as u64 - 1);
                    println!(
                        "   {:>2}. {} × {} copies = {} wasted  [{}]",
                        i + 1,
                        format_bytes(group.size),
                        group.files.len(),
                        format_bytes(waste),
                        &group.hash[..12]
                    );
                    for f in &group.files {
                        println!("       📄 {}", f.path.display());
                    }
                }
                if sorted_groups.len() > 15 {
                    println!("   ... and {} more groups", sorted_groups.len() - 15);
                }

                println!();
                println!("   ℹ️  Dry run only — no files were modified.");
                println!("   To deduplicate, use the GUI or the file-deduplicator binary with dry_run=false.");
            }
        }
        Err(e) => {
            eprintln!("   ❌ Error scanning for duplicates: {}", e);
        }
    }
}
