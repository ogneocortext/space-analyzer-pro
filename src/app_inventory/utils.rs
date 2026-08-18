use crate::app_inventory::models::AppInstance;
use std::env;
use std::path::PathBuf;
use std::time::Duration;

pub fn normalize_key(name: &str) -> String {
    let mut s = name.to_lowercase();
    // Strip trailing architecture / bitness markers.
    for suffix in [
        " (x64)",
        "(x86)",
        "(64-bit)",
        "(32-bit)",
        "(arm64)",
        "(arm)",
        "(preview)",
        "(stable)",
        "(insider)",
        "(beta)",
        "(portable)",
        " - ".trim_end_matches(' '),
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

pub fn is_version_like(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    parts.len() >= 2
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
}

/// Best-effort semantic-ish version comparison for sorting (newest first).
pub fn cmp_version(a: Option<&str>, b: Option<&str>) -> std::cmp::Ordering {
    match (a, b) {
        (None, None) => std::cmp::Ordering::Equal,
        (Some(_), None) => std::cmp::Ordering::Greater,
        (None, Some(_)) => std::cmp::Ordering::Less,
        (Some(x), Some(y)) => cmp_version_str(x, y),
    }
}

pub fn cmp_version_str(a: &str, b: &str) -> std::cmp::Ordering {
    let pa: Vec<u64> = a
        .split(['.', '-'])
        .filter_map(|p| p.parse::<u64>().ok())
        .collect();
    let pb: Vec<u64> = b
        .split(['.', '-'])
        .filter_map(|p| p.parse::<u64>().ok())
        .collect();
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

pub fn drive_of(path: &str) -> Option<String> {
    let p = path.replace('/', "\\");
    if p.len() >= 2 && p.chars().nth(1) == Some(':') {
        Some(p[..2].to_uppercase())
    } else {
        None
    }
}

pub fn home() -> Option<PathBuf> {
    dirs::home_dir()
}

pub fn human_bytes(n: u64) -> String {
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
pub fn collect_registry_apps() -> Vec<AppInstance> {
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
pub fn reg_entry_to_app(_subkey_name: &str, key: &winreg::RegKey) -> Option<AppInstance> {
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
pub fn collect_scoop_apps() -> Vec<AppInstance> {
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
                            drive: drive_of(&loc),
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
pub fn collect_chocolatey_apps() -> Vec<AppInstance> {
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
pub fn collect_rustup_toolchains() -> Vec<AppInstance> {
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
pub fn collect_vscode_extensions() -> Vec<AppInstance> {
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
pub fn collect_wsl_distros() -> Vec<AppInstance> {
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

#[cfg(windows)]
pub fn collect_docker() -> Vec<AppInstance> {
    let mut out = Vec::new();

    // Docker on WSL2 keeps its data in ext4.vhdx files. The `docker-desktop`
    // distro VHDX holds the VM/runtime; `docker-desktop-data` holds images,
    // containers and compose-project volumes. This is where Docker's real disk
    // footprint lives (the registry "Docker Desktop" entry only reports the tiny
    // program install), so enumerate the VHDX files directly.
    for vhdx in docker_wsl_vhdx_paths() {
        if let Some(size) = file_size(&vhdx) {
            let path = vhdx.to_string_lossy().to_string();
            let label = if path.to_lowercase().contains("data") {
                "Docker (WSL data volume)"
            } else {
                "Docker (WSL runtime)"
            };
            out.push(AppInstance {
                key: "docker wsl".to_string(),
                display_name: label.to_string(),
                version: None,
                install_location: Some(path.clone()),
                drive: drive_of(&path),
                estimated_size_bytes: size,
                publisher: None,
                uninstall_string: Some("wsl --unregister docker-desktop-data".to_string()),
                source: "docker".to_string(),
            });
        }
    }

    // Docker Desktop program-data folders (logs, settings, caches, crash dumps).
    // These are two genuinely distinct locations (machine-wide vs per-user), so
    // they get distinct grouping keys — merging them would falsely raise a
    // "duplicate location" redundancy warning that does not apply here.
    let program_data = PathBuf::from(r"C:\ProgramData\DockerDesktop");
    if program_data.exists() {
        let size = dir_size(&program_data);
        if size > 0 {
            let path = program_data.to_string_lossy().to_string();
            out.push(AppInstance {
                key: "docker programdata".to_string(),
                display_name: "Docker Desktop (program data)".to_string(),
                version: None,
                install_location: Some(path.clone()),
                drive: drive_of(&path),
                estimated_size_bytes: size,
                publisher: None,
                uninstall_string: None,
                source: "docker".to_string(),
            });
        }
    }
    let app_data = PathBuf::from(env::var("LOCALAPPDATA").unwrap_or_default()).join("Docker");
    if app_data.exists() {
        let size = dir_size(&app_data);
        if size > 0 {
            let path = app_data.to_string_lossy().to_string();
            out.push(AppInstance {
                key: "docker appdata".to_string(),
                display_name: "Docker Desktop (user data)".to_string(),
                version: None,
                install_location: Some(path.clone()),
                drive: drive_of(&path),
                estimated_size_bytes: size,
                publisher: None,
                uninstall_string: None,
                source: "docker".to_string(),
            });
        }
    }

    // Best-effort: enumerate named/compose-project volumes via the docker CLI.
    // Requires Docker Desktop running; guarded by a timeout so a stopped daemon
    // or slow start never blocks the inventory. Volumes live inside the data
    // VHDX above (already counted), this just makes the named volumes visible.
    if let Some(vols) = run_with_timeout(
        "docker",
        &["volume", "ls", "--format", "{{.Name}}"],
        Duration::from_secs(5),
    ) {
        for v in vols.lines() {
            let name = v.trim().to_string();
            if name.is_empty() {
                continue;
            }
            out.push(AppInstance {
                key: "docker volume".to_string(),
                display_name: format!("Docker volume: {name}"),
                version: None,
                install_location: None,
                drive: None,
                estimated_size_bytes: 0,
                publisher: None,
                uninstall_string: Some(format!("docker volume rm {name}")),
                source: "docker".to_string(),
            });
        }
    }

    out
}

/// Locate Docker's WSL2 ext4.vhdx files.
///
/// Two sources: the Lxss registry (authoritative BasePath per distro) and the
/// legacy `%LOCALAPPDATA%\Docker\wsl\{data,main}\ext4.vhdx` layout.
#[cfg(windows)]
pub fn docker_wsl_vhdx_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    use winreg::enums::*;
    use winreg::RegKey;
    if let Ok(lxss) = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Lxss", KEY_READ)
    {
        for name in lxss.enum_keys().filter_map(|r| r.ok()) {
            if let Ok(sub) = lxss.open_subkey_with_flags(&name, KEY_READ) {
                let distro: Option<String> = sub.get_value("DistributionName").ok();
                if let Some(d) = distro {
                    if d == "docker-desktop" || d == "docker-desktop-data" {
                        if let Ok(base) = sub.get_value::<String, _>("BasePath") {
                            let vhdx = PathBuf::from(base).join("ext4.vhdx");
                            if vhdx.exists() {
                                paths.push(vhdx);
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(local) = env::var_os("LOCALAPPDATA") {
        let wsl = PathBuf::from(local).join("Docker").join("wsl");
        for sub in ["data", "main"] {
            let vhdx = wsl.join(sub).join("ext4.vhdx");
            if vhdx.exists() {
                paths.push(vhdx);
            }
        }
    }

    paths
}

#[cfg(windows)]
pub fn file_size(path: &std::path::Path) -> Option<u64> {
    std::fs::metadata(path).ok().map(|m| m.len())
}

/// Run a command and return its stdout, or `None` if it fails or does not finish
/// within `timeout`. Used so an unresponsive `docker` daemon can never stall the
/// inventory scan.
#[cfg(windows)]
pub fn run_with_timeout(program: &str, args: &[&str], timeout: Duration) -> Option<String> {
    use std::sync::mpsc;
    let program = program.to_string();
    let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let out = std::process::Command::new(&program)
            .args(&args)
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok());
        let _ = tx.send(out);
    });
    match rx.recv_timeout(timeout) {
        Ok(Some(s)) => Some(s),
        _ => None,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small registry / fs helpers (Windows only)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(windows)]
pub fn reg_str(key: &winreg::RegKey, name: &str) -> Option<String> {
    key.get_value::<String, _>(name)
        .ok()
        .filter(|s| !s.trim().is_empty())
}

#[cfg(windows)]
pub fn reg_u32(key: &winreg::RegKey, name: &str) -> Option<u32> {
    key.get_value::<u32, _>(name).ok()
}

#[cfg(windows)]
pub fn reg_estimated_size(key: &winreg::RegKey) -> u64 {
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
pub fn dir_size(path: &std::path::Path) -> u64 {
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
pub fn split_pkg_version(dir: &str) -> (String, Option<String>) {
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
pub fn split_extension(dir: &str) -> Option<(String, String)> {
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
pub fn extract_version_token(s: &str) -> Option<String> {
    s.split(['-', '.'])
        .find(|tok| is_version_like(tok))
        .map(|t| t.to_string())
}
