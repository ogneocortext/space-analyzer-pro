//! CLI presentation for the installed-application / dev-tool inventory report.

use scan_engine::format_bytes;
use space_analyzer_pro_desktop::app_inventory::{self, AppInventoryReport};
use space_analyzer_pro_desktop::error::AppResult;

use crate::cli::args::OutputFormat;
use crate::hprintln;

/// Run the `app-inventory` subcommand.
pub fn handle(output_format: OutputFormat) -> AppResult<()> {
    let report = app_inventory::build_inventory_report();
    if output_format.is_machine_readable() {
        println!(
            "{}",
            serde_json::to_string_pretty(&report).unwrap_or_else(|_| "{}".to_string())
        );
        return Ok(());
    }
    print_human(&report);
    Ok(())
}

fn print_human(report: &AppInventoryReport) {
    hprintln!();
    hprintln!("🧩 INSTALLED APPLICATION / DEV-TOOL INVENTORY");
    hprintln!(
        "   {} installs grouped into {} identities",
        report.total_apps,
        report.groups.len()
    );
    hprintln!(
        "   {} installed in multiple locations (cross-drive duplicates)",
        report.duplicate_location_groups
    );
    hprintln!(
        "   {} present in multiple versions",
        report.multi_version_groups
    );
    hprintln!(
        "   ~{} reclaimable by removing detected older versions",
        format_bytes(report.total_wasted_bytes)
    );
    hprintln!();

    let redundant: Vec<_> = report
        .groups
        .iter()
        .filter(|g| g.is_duplicate_location || g.has_multiple_versions)
        .collect();

    if redundant.is_empty() {
        hprintln!("   ✅ No duplicate-location or multi-version installs detected.");
        return;
    }

    for g in redundant {
        let flags = match (g.is_duplicate_location, g.has_multiple_versions) {
            (true, true) => "⚠️ DUPLICATE LOCATION + MULTIPLE VERSIONS",
            (true, false) => "⚠️ DUPLICATE LOCATION",
            (false, true) => "⚠️ MULTIPLE VERSIONS",
            (false, false) => "",
        };
        hprintln!("• {}  {}  [{}]", g.display_name, flags, g.source);
        hprintln!(
            "    safety: {} · {}",
            g.safety,
            if g.recoverable { "reinstallable" } else { "not reinstallable" }
        );
        hprintln!("    {}", g.deletion_guidance);
        for inst in &g.instances {
            let loc = inst
                .install_location
                .clone()
                .unwrap_or_else(|| "<registry entry>".to_string());
            let ver = inst.version.clone().unwrap_or_else(|| "?".to_string());
            let drive = inst.drive.clone().unwrap_or_default();
            let size = format_bytes(inst.estimated_size_bytes);
            let older = if g.older_versions.iter().any(|o| o.install_location == inst.install_location) {
                " (older)"
            } else {
                ""
            };
            hprintln!("    - {} {} @ {}{}  ({})", ver, drive, loc, older, size);
        }
        hprintln!();
    }
}
