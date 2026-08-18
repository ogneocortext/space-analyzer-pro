use crate::app_inventory::collectors::{
    collect_chocolatey_apps, collect_docker, collect_registry_apps, collect_rustup_toolchains,
    collect_scoop_apps, collect_vscode_extensions, collect_wsl_distros,
};
use crate::app_inventory::models::{AppGroup, AppInstance, AppInventoryReport};
use crate::app_inventory::utils::{cmp_version, human_bytes};
use chrono::Utc;
use std::collections::BTreeMap;

#[cfg(windows)]
pub fn build_inventory_report() -> AppInventoryReport {
    let mut apps: Vec<AppInstance> = Vec::new();
    apps.extend(collect_registry_apps());
    apps.extend(collect_scoop_apps());
    apps.extend(collect_chocolatey_apps());
    apps.extend(collect_rustup_toolchains());
    apps.extend(collect_vscode_extensions());
    apps.extend(collect_wsl_distros());
    apps.extend(collect_docker());

    let groups = analyze(apps);
    let duplicate_location_groups = groups.iter().filter(|g| g.is_duplicate_location).count();
    let multi_version_groups = groups.iter().filter(|g| g.has_multiple_versions).count();
    let total_wasted_bytes: u64 = groups
        .iter()
        .flat_map(|g| g.older_versions.iter().map(|i| i.estimated_size_bytes))
        .sum();

    AppInventoryReport {
        generated_at: Utc::now().to_rfc3339(),
        total_apps: groups.iter().map(|g| g.instances.len()).sum(),
        groups,
        duplicate_location_groups,
        multi_version_groups,
        total_wasted_bytes,
        total_wasted_human: human_bytes(total_wasted_bytes),
    }
}

#[cfg(not(windows))]
pub fn build_inventory_report() -> AppInventoryReport {
    AppInventoryReport {
        generated_at: Utc::now().to_rfc3339(),
        total_apps: 0,
        groups: vec![],
        duplicate_location_groups: 0,
        multi_version_groups: 0,
        total_wasted_bytes: 0,
        total_wasted_human: human_bytes(0),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping / analysis
// ─────────────────────────────────────────────────────────────────────────────

pub fn analyze(mut apps: Vec<AppInstance>) -> Vec<AppGroup> {
    // Group by normalized key.
    let mut by_key: BTreeMap<String, Vec<AppInstance>> = BTreeMap::new();
    for app in apps.drain(..) {
        by_key.entry(app.key.clone()).or_default().push(app);
    }

    let mut groups = Vec::new();
    for (key, mut instances) in by_key {
        // Sort newest-version first so "older" detection is easy.
        instances.sort_by(|a, b| cmp_version(b.version.as_deref(), a.version.as_deref()));

        let display_name = instances
            .first()
            .map(|i| i.display_name.clone())
            .unwrap_or_else(|| key.clone());
        let source = instances
            .first()
            .map(|i| i.source.clone())
            .unwrap_or_else(|| "unknown".to_string());

        let distinct_locations = instances
            .iter()
            .map(|i| i.install_location.clone().unwrap_or_default())
            .filter(|p| !p.is_empty())
            .collect::<std::collections::HashSet<_>>()
            .len()
            .max(1);

        let versions: Vec<String> = instances
            .iter()
            .filter_map(|i| i.version.clone())
            .filter(|v| !v.is_empty())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        let newest = instances.first().and_then(|i| i.version.clone());
        let older_versions: Vec<AppInstance> = if newest.is_some() {
            instances
                .iter()
                .filter(|i| i.version.as_deref() != newest.as_deref())
                .cloned()
                .collect()
        } else {
            vec![]
        };

        let total_size_bytes: u64 = instances.iter().map(|i| i.estimated_size_bytes).sum();

        let (safety, recoverable, deletion_guidance) =
            build_guidance(&instances, &older_versions, distinct_locations, &versions);

        groups.push(AppGroup {
            key,
            display_name,
            source,
            instances,
            distinct_locations,
            is_duplicate_location: distinct_locations > 1,
            versions: versions.clone(),
            has_multiple_versions: versions.len() > 1,
            older_versions,
            total_size_bytes,
            safety,
            recoverable,
            deletion_guidance,
        });
    }

    // Surface the most actionable groups first: cross-drive duplicates, then
    // multi-version, then largest.
    groups.sort_by(|a, b| {
        (
            b.is_duplicate_location as u8,
            b.has_multiple_versions as u8,
            b.total_size_bytes,
        )
            .cmp(&(
                a.is_duplicate_location as u8,
                a.has_multiple_versions as u8,
                a.total_size_bytes,
            ))
    });
    groups
}

pub fn build_guidance(
    instances: &[AppInstance],
    older: &[AppInstance],
    distinct_locations: usize,
    versions: &[String],
) -> (String, bool, String) {
    // Reuse the origin tracer on the primary (first) instance path for impact text.
    let primary = instances.first();
    let mut safety = "REVIEW FIRST".to_string();
    let mut recoverable = true;
    if let Some(p) = primary {
        if let Some(loc) = &p.install_location {
            let assessment = crate::origin_tracer::assess_file(loc, p.estimated_size_bytes);
            safety = assessment.safety.label().to_string();
            recoverable = assessment.recoverable;
        }
    }

    let mut g = String::new();
    if distinct_locations > 1 {
        let drives: Vec<String> = instances
            .iter()
            .filter_map(|i| i.drive.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        g.push_str(&format!(
            "Installed in {} locations across drives {}. Decide on ONE canonical install and remove the rest via its uninstaller/package manager.",
            distinct_locations,
            drives.join("+")
        ));
    }
    if versions.len() > 1 {
        g.push_str(&format!(
            " Multiple versions present ({}).",
            versions.join(", ")
        ));
    }
    if !older.is_empty() {
        let saved: u64 = older.iter().map(|i| i.estimated_size_bytes).sum();
        g.push_str(&format!(
            " Removing {} older version(s) would reclaim ~{} and is generally safe if nothing still references them.",
            older.len(),
            human_bytes(saved)
        ));
    }

    // Registry apps should be removed through the uninstaller, not by deleting the
    // folder directly (side-by-side components, services, start-menu entries).
    if instances.iter().any(|i| i.source == "registry") {
        g.push_str(" For registry-installed apps, prefer Settings ▸ Apps or the listed uninstall command over manual folder deletion.");
    } else if instances.iter().any(|i| i.source == "docker") {
        g.push_str(" Docker keeps images, containers and compose-project volumes in a WSL ext4.vhdx, not in the program folder; reclaim space via Docker Desktop ▸ Troubleshoot ▸ Clean/Reset, or by unregistering the data distro (`wsl --unregister docker-desktop-data`). Never delete the VHDX while the daemon is running.");
    } else if !g.is_empty() {
        g.push_str(" Dev-tool roots (Scoop/Chocolatey/rustup/VS Code) can usually be deleted directly and reinstalled.");
    }
    if g.is_empty() {
        g.push_str("Single install; no redundancy detected.");
    }
    (safety, recoverable, g)
}
