//! Installed-application / dev-tool inventory and cross-location duplicate analysis.
//!
//! This answers the question "what is installed in more than one place, and in
//! more than one version, and what happens if I delete the older copies?"
//!
//! Unlike the file-content deduplicator (which only finds byte-identical files)
//! and the origin tracer (which only classifies paths that already appear in a
//! scan), this module enumerates the *installs themselves* from authoritative
//! sources:
//!
//! * Windows **registry** uninstall keys (HKLM/HKCU, 32- and 64-bit views) — the
//!   canonical list of installed applications, with DisplayName, DisplayVersion,
//!   InstallLocation and EstimatedSize.
//! * **Package-manager / toolchain roots** that commonly live off the system
//!   drive: Scoop (`~/scoop/apps`), Chocolatey (`C:\ProgramData\chocolatey\lib`),
//!   rustup toolchains (`~/.rustup/toolchains`), VS Code extensions
//!   (`~/.vscode/extensions`) and WSL distributions (`wsl --list`).
//!
//! Installations are grouped by a normalized identity and flagged when the same
//! app appears under multiple drives/paths (`is_duplicate_location`) or in
//! several versions (`has_multiple_versions`). The existing origin-tracing
//! safety layer is reused to summarize deletion impact per group.

use chrono::Utc;
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::PathBuf;

/// A single discovered installation (one registry entry, one package version,
/// one toolchain, one extension).
#[derive(Debug, Clone, Serialize)]
pub struct AppInstance {
    /// Normalized identity used for grouping (e.g. `microsoft visual studio code`).
    pub key: String,
    /// Human-readable name.
    pub display_name: String,
    /// Detected version string, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Where it is installed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_location: Option<String>,
    /// Drive letter this instance lives on (e.g. `C:`), if resolvable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drive: Option<String>,
    /// Estimated on-disk size in bytes (registry EstimatedSize, dir walk, or 0).
    pub estimated_size_bytes: u64,
    /// Publisher / vendor, if known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publisher: Option<String>,
    /// Command to uninstall/remove this instance, if known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uninstall_string: Option<String>,
    /// Where this instance was discovered.
    pub source: String,
}

/// A group of installations that share the same normalized identity.
#[derive(Debug, Clone, Serialize)]
pub struct AppGroup {
    pub key: String,
    pub display_name: String,
    pub source: String,
    pub instances: Vec<AppInstance>,
    /// Number of distinct install paths (drive+path) in this group.
    pub distinct_locations: usize,
    /// True when the same app is installed under more than one path/drive.
    pub is_duplicate_location: bool,
    /// Distinct detected versions (sorted).
    pub versions: Vec<String>,
    /// True when more than one version of the same app is present.
    pub has_multiple_versions: bool,
    /// Instances whose version is older than the newest detected version.
    pub older_versions: Vec<AppInstance>,
    pub total_size_bytes: u64,
    /// Deletion-safety verdict from the origin tracer.
    pub safety: String,
    /// True when the install can be reinstalled after deletion.
    pub recoverable: bool,
    /// Human-readable guidance for what happens if older copies are removed.
    pub deletion_guidance: String,
}

/// Top-level report returned by [`build_inventory_report`].
#[derive(Debug, Clone, Serialize)]
pub struct AppInventoryReport {
    pub generated_at: String,
    pub total_apps: usize,
    pub groups: Vec<AppGroup>,
    pub duplicate_location_groups: usize,
    pub multi_version_groups: usize,
    /// Bytes that could be reclaimed by removing every detected older version.
    pub total_wasted_bytes: u64,
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

/// Enumerate installed applications and dev tools, group them by identity, and
/// flag cross-location and multi-version redundancy.
#[cfg(windows)]
pub fn build_inventory_report() -> AppInventoryReport {
    let mut apps: Vec<AppInstance> = Vec::new();
    apps.extend(collect_registry_apps());
    apps.extend(collect_scoop_apps());
    apps.extend(collect_chocolatey_apps());
    apps.extend(collect_rustup_toolchains());
    apps.extend(collect_vscode_extensions());
    apps.extend(collect_wsl_distros());

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
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping / analysis
// ─────────────────────────────────────────────────────────────────────────────

fn analyze(mut apps: Vec<AppInstance>) -> Vec<AppGroup> {
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
        (b.is_duplicate_location as u8, b.has_multiple_versions as u8, b.total_size_bytes)
            .cmp(&(a.is_duplicate_location as u8, a.has_multiple_versions as u8, a.total_size_bytes))
    });
    groups
}

fn build_guidance(
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
    } else if !g.is_empty() {
        g.push_str(" Dev-tool roots (Scoop/Chocolatey/rustup/VS Code) can usually be deleted directly and reinstalled.");
    }
    if g.is_empty() {
        g.push_str("Single install; no redundancy detected.");
    }
    (safety, recoverable, g)
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Collapse a display name into a stable grouping key: lowercase, trimmed,
/// whitespace-normalized, with common version/suffix noise removed.
fn normalize_key(name: &str) -> String {
    let mut s = name.to_lowercase();
    // Strip trailing architecture / bitness markers.
    for suffix in [
        " (x64)", "(x86)", "(64-bit)", "(32-bit)", "(arm64)", "(arm)", "(preview)",
        "(stable)", "(insider)", "(beta)", "(portable)", " - " .trim_end_matches(' '),
    ] {
        if let Some(idx) = s.rfind(suffix.trim()) {
            // Only strip a trailing occurrence.
            if idx + suffix.trim().len() == s.len() {
                s.truncate(idx);
            }
        }
    }
    // Remove a trailing " X.Y.Z" version token.
    if let Some(pos) = s.rfind(' ') {
        let tail = &s[pos + 1..];
        if is_version_like(tail) {
            s.truncate(pos);
        }
    }
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_version_like(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    parts.len() >= 2 && parts.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
}

/// Best-effort semantic-ish version comparison for sorting (newest first).
fn cmp_version(a: Option<&str>, b: Option<&str>) -> std::cmp::Ordering {
    match (a, b) {
        (None, None) => std::cmp::Ordering::Equal,
        (Some(_), None) => std::cmp::Ordering::Greater,
        (None, Some(_)) => std::cmp::Ordering::Less,
        (Some(x), Some(y)) => cmp_version_str(x, y),
    }
}

fn cmp_version_str(a: &str, b: &str) -> std::cmp::Ordering {
    let pa: Vec<u64> = a.split(['.', '-']).filter_map(|p| p.parse::<u64>().ok()).collect();
    let pb: Vec<u64> = b.split(['.', '-']).filter_map(|p| p.parse::<u64>().ok()).collect();
    let len = pa.len().max(pb.len());
    for i in 0..len {
        let x = pa.get(i).copied().unwrap_or(0);
        let y = pb.get(i).copied().unwrap_or(0);
        if x != y {
            return x.cmp(&y);
        }
    }
    std::cmp::Ordering::Equal
}

fn drive_of(path: &str) -> Option<String> {
    let p = path.replace('/', "\\");
    if p.len() >= 2 && p.chars().nth(1) == Some(':') {
        Some(p[..2].to_uppercase())
    } else {
        None
    }
}

fn home() -> Option<PathBuf> {
    dirs::home_dir()
}

fn human_bytes(n: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut v = n as f64;
    let mut i = 0;
    while v >= 1024.0 && i < UNITS.len() - 1 {
        v /= 1024.0;
        i += 1;
    }
    format!("{:.1} {}", v, UNITS[i])
}

// ─────────────────────────────────────────────────────────────────────────────
// Collectors (Windows only)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(windows)]
fn collect_registry_apps() -> Vec<AppInstance> {
    use winreg::enums::*;
    use winreg::RegKey;

    let mut out = Vec::new();
    let hives = [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER];
    let bases = [
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ];
    let views = [KEY_WOW64_64KEY, KEY_WOW64_32KEY];

    for hive in hives {
        let predef = RegKey::predef(hive);
        for base in bases {
            for view in views {
                let key = match predef.open_subkey_with_flags(base, KEY_READ | view) {
                    Ok(k) => k,
                    Err(_) => continue,
                };
                for name in key.enum_keys().filter_map(|r| r.ok()) {
                    if let Ok(sub) = key.open_subkey_with_flags(&name, KEY_READ | view) {
                        if let Some(app) = reg_entry_to_app(&name, &sub) {
                            out.push(app);
                        }
                    }
                }
            }
        }
    }
    out
}

#[cfg(windows)]
fn reg_entry_to_app(_subkey_name: &str, key: &winreg::RegKey) -> Option<AppInstance> {
    let display_name = reg_str(key, "DisplayName")?;
    // Skip system/sub components that shouldn't be treated as user apps.
    if reg_u32(key, "SystemComponent").unwrap_or(0) == 1 {
        return None;
    }
    if reg_str(key, "ParentKeyName").is_some() {
        return None;
    }
    let version = reg_str(key, "DisplayVersion");
    let publisher = reg_str(key, "Publisher");
    let install_location = reg_str(key, "InstallLocation");
    let uninstall_string = reg_str(key, "UninstallString");
    let estimated_size_bytes = reg_estimated_size(key);

    let drive = install_location.as_ref().and_then(|p| drive_of(p));
    Some(AppInstance {
        key: normalize_key(&display_name),
        display_name,
        version,
        install_location,
        drive,
        estimated_size_bytes,
        publisher,
        uninstall_string,
        source: "registry".to_string(),
    })
}

#[cfg(windows)]
fn collect_scoop_apps() -> Vec<AppInstance> {
    let mut out = Vec::new();
    if let Some(home) = home() {
        let apps_dir = home.join("scoop").join("apps");
        if let Ok(entries) = std::fs::read_dir(&apps_dir) {
            for app in entries.filter_map(|e| e.ok()) {
                if !app.path().is_dir() {
                    continue;
                }
                let app_name = app.file_name().to_string_lossy().to_string();
                if let Ok(versions) = std::fs::read_dir(app.path()) {
                    for v in versions.filter_map(|e| e.ok()) {
                        if !v.path().is_dir() {
                            continue;
                        }
                        let version = v.file_name().to_string_lossy().to_string();
                        let loc = v.path().to_string_lossy().to_string();
                        out.push(AppInstance {
                            key: normalize_key(&app_name),
                            display_name: app_name.clone(),
                            version: Some(version),
                            install_location: Some(loc.clone()),
                            drive: drive_of(&app_name),
                            estimated_size_bytes: dir_size(&v.path()),
                            publisher: None,
                            uninstall_string: None,
                            source: "scoop".to_string(),
                        });
                    }
                }
            }
        }
    }
    out
}

#[cfg(windows)]
fn collect_chocolatey_apps() -> Vec<AppInstance> {
    let mut out = Vec::new();
    let lib = PathBuf::from(r"C:\ProgramData\chocolatey\lib");
    if let Ok(entries) = std::fs::read_dir(&lib) {
        for e in entries.filter_map(|e| e.ok()) {
            if !e.path().is_dir() {
                continue;
            }
            let dir = e.file_name().to_string_lossy().to_string();
            // Chocolatey dirs look like `pkgname` or `pkgname.1.2.3`.
            let (name, version) = split_pkg_version(&dir);
            let loc = e.path().to_string_lossy().to_string();
            out.push(AppInstance {
                key: normalize_key(&name),
                display_name: name,
                version,
                install_location: Some(loc.clone()),
                drive: drive_of(&loc),
                estimated_size_bytes: dir_size(&e.path()),
                publisher: None,
                uninstall_string: None,
                source: "chocolatey".to_string(),
            });
        }
    }
    out
}

#[cfg(windows)]
fn collect_rustup_toolchains() -> Vec<AppInstance> {
    let mut out = Vec::new();
    let home_dir = home();
    let rustup_home = std::env::var("RUSTUP_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| home_dir.map(|h| h.join(".rustup")))
        .map(|p| p.join("toolchains"));
    if let Some(tc_dir) = rustup_home {
        if let Ok(entries) = std::fs::read_dir(&tc_dir) {
            for e in entries.filter_map(|e| e.ok()) {
                if !e.path().is_dir() {
                    continue;
                }
                let dir = e.file_name().to_string_lossy().to_string();
                let version = extract_version_token(&dir);
                let loc = e.path().to_string_lossy().to_string();
                out.push(AppInstance {
                    key: "rust toolchain".to_string(),
                    display_name: format!("Rust toolchain ({dir})"),
                    version,
                    install_location: Some(loc.clone()),
                    drive: drive_of(&loc),
                    estimated_size_bytes: dir_size(&e.path()),
                    publisher: None,
                    uninstall_string: None,
                    source: "rustup".to_string(),
                });
            }
        }
    }
    out
}

#[cfg(windows)]
fn collect_vscode_extensions() -> Vec<AppInstance> {
    let mut out = Vec::new();
    if let Some(home) = home() {
        let ext_dir = home.join(".vscode").join("extensions");
        if let Ok(entries) = std::fs::read_dir(&ext_dir) {
            for e in entries.filter_map(|e| e.ok()) {
                if !e.path().is_dir() {
                    continue;
                }
                let dir = e.file_name().to_string_lossy().to_string();
                // Format: <publisher>.<name>-<version>
                if let Some((name, version)) = split_extension(dir.as_str()) {
                    let loc = e.path().to_string_lossy().to_string();
                    out.push(AppInstance {
                        key: normalize_key(&name),
                        display_name: name,
                        version: Some(version),
                        install_location: Some(loc.clone()),
                        drive: drive_of(&loc),
                        estimated_size_bytes: dir_size(&e.path()),
                        publisher: None,
                        uninstall_string: None,
                        source: "vscode-ext".to_string(),
                    });
                }
            }
        }
    }
    out
}

#[cfg(windows)]
fn collect_wsl_distros() -> Vec<AppInstance> {
    let mut out = Vec::new();
    let output = std::process::Command::new("wsl")
        .args(["--list", "--quiet"])
        .output();
    if let Ok(out_cmd) = output {
        let text = String::from_utf8_lossy(&out_cmd.stdout);
        for line in text.lines() {
            let name = line.trim().to_string();
            if name.is_empty() || name.starts_with('\0') {
                continue;
            }
            out.push(AppInstance {
                key: normalize_key(&format!("wsl {name}")),
                display_name: format!("WSL distribution: {name}"),
                version: None,
                install_location: None,
                drive: Some("C:".to_string()),
                estimated_size_bytes: 0,
                publisher: None,
                uninstall_string: Some(format!("wsl --unregister {name}")),
                source: "wsl".to_string(),
            });
        }
    }
    out
}

// ─────────────────────────────────────────────────────────────────────────────
// Small registry / fs helpers (Windows only)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(windows)]
fn reg_str(key: &winreg::RegKey, name: &str) -> Option<String> {
    key.get_value::<String, _>(name)
        .ok()
        .filter(|s| !s.trim().is_empty())
}

#[cfg(windows)]
fn reg_u32(key: &winreg::RegKey, name: &str) -> Option<u32> {
    key.get_value::<u32, _>(name).ok()
}

#[cfg(windows)]
fn reg_estimated_size(key: &winreg::RegKey) -> u64 {
    if let Some(kb) = reg_u32(key, "EstimatedSize") {
        return (kb as u64) * 1024;
    }
    if let Some(s) = reg_str(key, "EstimatedSize") {
        if let Ok(kb) = s.parse::<u64>() {
            return kb * 1024;
        }
    }
    0
}

#[cfg(windows)]
fn dir_size(path: &std::path::Path) -> u64 {
    let mut total = 0u64;
    let mut stack = vec![path.to_path_buf()];
    while let Some(p) = stack.pop() {
        let entries = match std::fs::read_dir(&p) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for e in entries.filter_map(|e| e.ok()) {
            let meta = match e.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.is_dir() {
                stack.push(e.path());
            } else {
                total += meta.len();
            }
        }
    }
    total
}

#[cfg(windows)]
fn split_pkg_version(dir: &str) -> (String, Option<String>) {
    // Try to split "<name>.<version>" where version is dotted digits.
    if let Some(pos) = dir.rfind('.') {
        let tail = &dir[pos + 1..];
        if is_version_like(tail) {
            return (dir[..pos].to_string(), Some(tail.to_string()));
        }
    }
    (dir.to_string(), None)
}

#[cfg(windows)]
fn split_extension(dir: &str) -> Option<(String, String)> {
    // <publisher>.<name>-<version>
    if let Some(pos) = dir.rfind('-') {
        let version = &dir[pos + 1..];
        if is_version_like(version) {
            let name_part = &dir[..pos];
            return Some((name_part.to_string(), version.to_string()));
        }
    }
    None
}

#[cfg(windows)]
fn extract_version_token(s: &str) -> Option<String> {
    s.split(['-', '.'])
        .find(|tok| is_version_like(tok))
        .map(|t| t.to_string())
}
