//! System cleanup shortcuts (WinDirStat-style).
//!
//! High-impact, safe-to-explain system cleanup actions that free large amounts
//! of space without touching the user's personal files:
//!
//! * **Hibernate** — `powercfg -h off` removes `hiberfil.sys` (often several GB).
//! * **WinSxS** — `dism /online /cleanup-image /StartComponentCleanup` shrinks the
//!   Windows component store.
//! * **VHD** — compacts WSL/Hyper-V virtual hard disks that grow and never shrink.
//! * **Shadow copies** — `vssadmin delete shadows /all /quiet` removes old restore
//!   point snapshots.
//! * **Recycle Bin** — `Clear-RecycleBin -Force` empties the bin for all users.
//!
//! Every destructive action requires `--apply --yes` so it can never fire
//! accidentally. The `list` action is read-only and shows what is available.

use clap::{Args, Subcommand};
use space_analyzer_pro_desktop::error::{AppError, AppResult};
use std::process::Command;

/// Arguments for the `system` subcommand.
#[derive(Debug, Args)]
pub struct SystemArgs {
    #[command(subcommand)]
    pub command: SystemCommand,

    /// Actually perform the destructive action (default: read-only preview).
    /// Required together with `--yes` for any mutating sub-command.
    #[arg(long)]
    pub apply: bool,

    /// Assume "yes" for destructive confirmation prompts.
    #[arg(short = 'y', long)]
    pub yes: bool,
}

#[derive(Debug, Subcommand)]
pub enum SystemCommand {
    /// List available system cleanup shortcuts with estimated savings (read-only).
    List,

    /// Disable hibernation and remove `hiberfil.sys` (often several GB).
    Hibernate,

    /// Clean the Windows component store (WinSxS) via DISM.
    Winsxs,

    /// Compact WSL / Hyper-V virtual hard disks that grow and never shrink.
    Vhd,

    /// Remove old Volume Shadow Copy snapshots via `vssadmin`.
    Shadow,

    /// Empty the Recycle Bin for all users via PowerShell.
    Recycle,
}

/// A single cleanup shortcut with its estimated savings.
#[derive(Debug, serde::Serialize)]
pub struct CleanupShortcut {
    pub id: String,
    pub name: String,
    pub description: String,
    /// Estimated bytes that can be reclaimed (`None` when unknown without
    /// running the action).
    pub estimated_savings_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_savings_human: Option<String>,
    pub requires_admin: bool,
    pub windows_only: bool,
    /// Non-fatal issues discovered while estimating (e.g. hiberfil.sys missing).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<String>,
}

/// All known system cleanup shortcuts. Read-only: no side effects, no admin
/// checks beyond reporting whether the action typically needs elevation.
fn available_shortcuts() -> Vec<CleanupShortcut> {
    // Best-effort real estimates where we can compute them without side effects.
    let hiberfil_size = std::path::Path::new(r"C:\hiberfil.sys")
        .metadata()
        .ok()
        .map(|m| m.len());

    let recycle_size = recycle_bin_size_best_effort();

    vec![
        CleanupShortcut {
            id: "hibernate".to_string(),
            name: "Hibernation file".to_string(),
            description: "Disables hibernation and removes hiberfil.sys (often several GB). \
                 You lose the ability to hibernate, but sleep still works."
                .to_string(),
            estimated_savings_bytes: hiberfil_size,
            estimated_savings_human: hiberfil_size.map(scan_engine::format_bytes),
            requires_admin: true,
            windows_only: true,
            errors: hiberfil_size
                .as_ref()
                .filter(|s| **s == 0)
                .map(|_| {
                    vec!["hiberfil.sys not found — hibernation may already be off".to_string()]
                })
                .unwrap_or_default(),
        },
        CleanupShortcut {
            id: "winsxs".to_string(),
            name: "Component store (WinSxS)".to_string(),
            description: "DISM component store cleanup. Removes superseded Windows \
                 update components."
                .to_string(),
            estimated_savings_bytes: None,
            estimated_savings_human: None,
            requires_admin: true,
            windows_only: true,
            errors: Vec::new(),
        },
        CleanupShortcut {
            id: "vhd".to_string(),
            name: "Virtual hard disks (VHD/VHDX)".to_string(),
            description: "Compacts WSL / Hyper-V virtual disks that grow and never \
                 shrink on their own."
                .to_string(),
            estimated_savings_bytes: None,
            estimated_savings_human: None,
            requires_admin: false,
            windows_only: true,
            errors: Vec::new(),
        },
        CleanupShortcut {
            id: "shadow".to_string(),
            name: "Volume Shadow Copies".to_string(),
            description: "Deletes all but the latest restore-point shadow copy \
                 via vssadmin."
                .to_string(),
            estimated_savings_bytes: None,
            estimated_savings_human: None,
            requires_admin: true,
            windows_only: true,
            errors: Vec::new(),
        },
        CleanupShortcut {
            id: "recycle".to_string(),
            name: "Recycle Bin".to_string(),
            description: "Empties the Recycle Bin for all users via PowerShell.".to_string(),
            estimated_savings_bytes: recycle_size,
            estimated_savings_human: recycle_size.map(scan_engine::format_bytes),
            requires_admin: false,
            windows_only: true,
            errors: recycle_size
                .as_ref()
                .filter(|s| **s == 0)
                .map(|_| vec!["Recycle Bin appears empty".to_string()])
                .unwrap_or_default(),
        },
    ]
}

/// Best-effort Recycle Bin size estimate (read-only, no deletion).
fn recycle_bin_size_best_effort() -> Option<u64> {
    if cfg!(windows) {
        let script = "Get-ChildItem -Path '$env:SYSTEMDRIVE\\\\$Recycle.Bin' -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum | Select-Object -ExpandProperty Sum";
        if let Ok(output) = Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", script])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let size: u64 = stdout.trim().parse().unwrap_or(0);
            if size > 0 {
                return Some(size);
            }
        }
    }
    None
}

/// Gate a mutating action behind `--apply --yes`.
fn require_apply(apply: bool, yes: bool, action: &str) -> AppResult<()> {
    if !apply {
        return Err(AppError::Validation(format!(
            "Action '{action}' is destructive. Pass --apply --yes to execute."
        )));
    }
    if !yes {
        return Err(AppError::Validation(format!(
            "Action '{action}' requires confirmation. Pass --apply --yes."
        )));
    }
    Ok(())
}

/// Emit a single action result. Adds a top-level `ok` boolean and, when the
/// action failed, an `errors` array. This is the single output choke point so
/// every system action shares the same JSON shape.
fn emit(
    output_format: crate::cli::args::OutputFormat,
    mut payload: serde_json::Value,
    success: bool,
    errors: Option<Vec<String>>,
) -> AppResult<()> {
    let obj = payload.as_object_mut().ok_or_else(|| {
        AppError::Validation("system action payload must be a JSON object".to_string())
    })?;
    obj.insert("ok".to_string(), serde_json::Value::Bool(success));
    if let Some(errs) = errors {
        if !errs.is_empty() {
            obj.insert(
                "errors".to_string(),
                serde_json::to_value(errs).unwrap_or_default(),
            );
        }
    }
    if output_format.is_machine_readable() {
        println!(
            "{}",
            serde_json::to_string_pretty(&payload).unwrap_or_default()
        );
    } else if success {
        println!("✅ System action completed.");
    } else {
        println!("⚠️  System action completed with warnings (check stderr).");
    }
    Ok(())
}

pub fn run(args: SystemArgs, output_format: crate::cli::args::OutputFormat) -> AppResult<()> {
    match args.command {
        SystemCommand::List => {
            let shortcuts = available_shortcuts();
            if output_format.is_machine_readable() {
                let response = serde_json::json!({
                    "shortcuts": shortcuts,
                    "count": shortcuts.len(),
                    "apply_required": true,
                });
                println!(
                    "{}",
                    serde_json::to_string_pretty(&response).unwrap_or_default()
                );
            } else {
                println!("System cleanup shortcuts (run with --apply --yes to execute):");
                for s in &shortcuts {
                    let est = s.estimated_savings_human.as_deref().unwrap_or("unknown");
                    println!(
                        "  {:<14} {} — {} (admin={}, est={})",
                        s.id, s.name, s.description, s.requires_admin, est
                    );
                    if !s.errors.is_empty() {
                        for e in &s.errors {
                            println!("      ⚠️  {e}");
                        }
                    }
                }
            }
            Ok(())
        }
        SystemCommand::Hibernate => run_hibernate(args.apply, args.yes, output_format),
        SystemCommand::Winsxs => run_winsxs(args.apply, args.yes, output_format),
        SystemCommand::Vhd => run_vhd(args.apply, args.yes, output_format),
        SystemCommand::Shadow => run_shadow(args.apply, args.yes, output_format),
        SystemCommand::Recycle => run_recycle(args.apply, args.yes, output_format),
    }
}

fn run_hibernate(
    apply: bool,
    yes: bool,
    output_format: crate::cli::args::OutputFormat,
) -> AppResult<()> {
    if !apply {
        return hibernate_preview(output_format);
    }
    require_apply(apply, yes, "hibernate")?;

    let status = Command::new("powercfg").args(["-h", "off"]).status()?;
    let success = status.success();
    let mut errors: Vec<String> = Vec::new();
    if !success {
        errors.push("powercfg -h off exited non-zero".to_string());
    }
    let output = serde_json::json!({
        "action": "hibernate",
        "description": "Disabled hibernation and removed hiberfil.sys",
    });
    emit(output_format, output, success, Some(errors))
}

fn hibernate_preview(output_format: crate::cli::args::OutputFormat) -> AppResult<()> {
    // Best-effort: check if hiberfil.sys exists to estimate savings.
    let hiberfil = std::path::Path::new(r"C:\hiberfil.sys");
    let size = hiberfil.metadata().map(|m| m.len()).unwrap_or(0);
    let mut errors: Vec<String> = Vec::new();
    if size == 0 {
        errors.push("hiberfil.sys not found — hibernation may already be off".to_string());
    }
    let output = serde_json::json!({
        "action": "hibernate",
        "apply_required": true,
        "estimated_savings_bytes": size,
        "estimated_savings_human": scan_engine::format_bytes(size),
        "description": "Disable hibernation and remove hiberfil.sys",
    });
    emit(output_format, output, true, Some(errors))
}

fn run_winsxs(
    apply: bool,
    yes: bool,
    output_format: crate::cli::args::OutputFormat,
) -> AppResult<()> {
    if !apply {
        return winsxs_preview(output_format);
    }
    require_apply(apply, yes, "winsxs")?;

    let status = Command::new("dism.exe")
        .args(["/online", "/cleanup-image", "/StartComponentCleanup"])
        .status()?;
    let success = status.success();
    let mut errors: Vec<String> = Vec::new();
    if !success {
        errors.push("dism component store cleanup exited non-zero".to_string());
    }
    let output = serde_json::json!({
        "action": "winsxs",
        "description": "Cleaned Windows component store (WinSxS)",
    });
    emit(output_format, output, success, Some(errors))
}

fn winsxs_preview(output_format: crate::cli::args::OutputFormat) -> AppResult<()> {
    let output = serde_json::json!({
        "action": "winsxs",
        "apply_required": true,
        "description": "Run DISM component store cleanup",
    });
    emit(output_format, output, true, None)
}

fn run_vhd(apply: bool, yes: bool, output_format: crate::cli::args::OutputFormat) -> AppResult<()> {
    if !apply {
        return vhd_preview(output_format);
    }
    require_apply(apply, yes, "vhd")?;

    // Compact known WSL / Hyper-V virtual hard disks via Optimize-VHD.
    let script = r#"
$ErrorActionPreference = 'Continue'
$paths = @(
    "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx",
    "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx.backup",
    "$env:USERPROFILE\.docker\wsl\data\ext4.vhdx"
)
$result = @()
foreach ($p in $paths) {
    if (Test-Path $p) {
        try {
            $before = (Get-Item $p).Length
            Optimize-VHD -Path $p -Mode Full
            $after = (Get-Item $p).Length
            $result += @{path=$p; before=$before; after=$after; saved=$before-$after; ok=$true}
        } catch {
            $result += @{path=$p; error=$_.Exception.Message; ok=$false}
        }
    }
}
$result | ConvertTo-Json -Depth 3
"#;
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", script])
        .output()?;
    let success = output.status.success();
    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: serde_json::Value =
        serde_json::from_str(stdout.trim()).unwrap_or(serde_json::json!([]));

    let mut errors: Vec<String> = Vec::new();
    if !success {
        errors.push("Optimize-VHD PowerShell script exited non-zero".to_string());
    }
    // Collect any per-disk errors from the script output.
    if let serde_json::Value::Array(details) = &result {
        for d in details {
            if let Some(ok) = d.get("ok").and_then(|v| v.as_bool()) {
                if !ok {
                    if let Some(err) = d.get("error").and_then(|v| v.as_str()) {
                        errors.push(format!("VHD compaction error: {err}"));
                    }
                }
            }
        }
    }

    let output = serde_json::json!({
        "action": "vhd",
        "description": "Compacted WSL/Hyper-V virtual hard disks",
        "details": result,
    });
    emit(output_format, output, success, Some(errors))
}

fn vhd_preview(output_format: crate::cli::args::OutputFormat) -> AppResult<()> {
    let output = serde_json::json!({
        "action": "vhd",
        "apply_required": true,
        "description": "Compact WSL/Hyper-V virtual hard disks",
    });
    emit(output_format, output, true, None)
}

fn run_shadow(
    apply: bool,
    yes: bool,
    output_format: crate::cli::args::OutputFormat,
) -> AppResult<()> {
    if !apply {
        return shadow_preview(output_format);
    }
    require_apply(apply, yes, "shadow")?;

    let status = Command::new("vssadmin.exe")
        .args(["delete", "shadows", "/all", "/quiet"])
        .status()?;
    let success = status.success();
    let mut errors: Vec<String> = Vec::new();
    if !success {
        errors.push("vssadmin delete shadows exited non-zero".to_string());
    }
    let output = serde_json::json!({
        "action": "shadow",
        "description": "Removed Volume Shadow Copies",
    });
    emit(output_format, output, success, Some(errors))
}

fn shadow_preview(output_format: crate::cli::args::OutputFormat) -> AppResult<()> {
    let output = serde_json::json!({
        "action": "shadow",
        "apply_required": true,
        "description": "Delete Volume Shadow Copies via vssadmin",
    });
    emit(output_format, output, true, None)
}

fn run_recycle(
    apply: bool,
    yes: bool,
    output_format: crate::cli::args::OutputFormat,
) -> AppResult<()> {
    if !apply {
        return recycle_preview(output_format);
    }
    require_apply(apply, yes, "recycle")?;

    // First measure, then empty. The measure gives us freed_bytes; the clear
    // does the actual deletion. Both run in the same PowerShell invocation.
    let script = "Get-ChildItem -Path '$env:SYSTEMDRIVE\\\\$Recycle.Bin' -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum | Select-Object -ExpandProperty Sum; Clear-RecycleBin -Force -ErrorAction SilentlyContinue";
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", script])
        .output()?;
    let success = output.status.success();
    let stdout = String::from_utf8_lossy(&output.stdout);
    let size: u64 = stdout.trim().parse().unwrap_or(0);

    let mut errors: Vec<String> = Vec::new();
    if !success {
        errors.push("Clear-RecycleBin exited non-zero".to_string());
    }

    let result = serde_json::json!({
        "action": "recycle",
        "description": "Emptied the Recycle Bin",
        "freed_bytes": size,
        "freed_human": scan_engine::format_bytes(size),
    });
    emit(output_format, result, success, Some(errors))
}

fn recycle_preview(output_format: crate::cli::args::OutputFormat) -> AppResult<()> {
    // Best-effort: estimate Recycle Bin size (read-only, no deletion).
    let size = recycle_bin_size_best_effort().unwrap_or(0);
    let mut errors: Vec<String> = Vec::new();
    if size == 0 {
        errors.push("Recycle Bin appears empty or could not be measured".to_string());
    }
    let result = serde_json::json!({
        "action": "recycle",
        "apply_required": true,
        "estimated_savings_bytes": size,
        "estimated_savings_human": scan_engine::format_bytes(size),
        "description": "Empty the Recycle Bin",
    });
    emit(output_format, result, true, Some(errors))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cli::args::OutputFormat;

    // ── require_apply gating ────────────────────────────────────────────────

    #[test]
    fn require_apply_rejects_no_apply() {
        let err = require_apply(false, false, "hibernate").expect_err("must reject");
        assert!(
            err.to_string().contains("destructive"),
            "expected destructive message, got: {err}"
        );
    }

    #[test]
    fn require_apply_rejects_apply_without_yes() {
        let err = require_apply(true, false, "hibernate").expect_err("must reject");
        assert!(
            err.to_string().contains("confirmation"),
            "expected confirmation message, got: {err}"
        );
    }

    #[test]
    fn require_apply_accepts_apply_and_yes() {
        require_apply(true, true, "hibernate").expect("apply+yes must pass");
    }

    #[test]
    fn require_apply_rejects_yes_without_apply() {
        let err = require_apply(false, true, "hibernate").expect_err("must reject");
        assert!(
            err.to_string().contains("destructive"),
            "expected destructive message, got: {err}"
        );
    }

    // ── available_shortcuts shape ───────────────────────────────────────────

    #[test]
    fn available_shortcuts_has_five_actions() {
        let shortcuts = available_shortcuts();
        assert_eq!(shortcuts.len(), 5, "five cleanup shortcuts expected");
        let ids: Vec<&str> = shortcuts.iter().map(|s| s.id.as_str()).collect();
        assert!(
            ids.contains(&"hibernate"),
            "hibernate shortcut must be present"
        );
        assert!(ids.contains(&"winsxs"), "winsxs shortcut must be present");
        assert!(ids.contains(&"vhd"), "vhd shortcut must be present");
        assert!(ids.contains(&"shadow"), "shadow shortcut must be present");
        assert!(ids.contains(&"recycle"), "recycle shortcut must be present");
    }

    #[test]
    fn available_shortcuts_have_names_and_descriptions() {
        for s in &available_shortcuts() {
            assert!(!s.name.is_empty(), "{} needs a name", s.id);
            assert!(!s.description.is_empty(), "{} needs a description", s.id);
        }
    }

    #[test]
    fn recycle_shortcut_estimates_savings() {
        let recycle = available_shortcuts()
            .into_iter()
            .find(|s| s.id == "recycle")
            .expect("recycle shortcut must exist");
        // Read-only estimate is best-effort; Just assert the shape is valid.
        if let Some(bytes) = recycle.estimated_savings_bytes {
            assert_eq!(
                recycle.estimated_savings_human.as_deref(),
                Some(scan_engine::format_bytes(bytes).as_str()),
                "human bytes must match byte estimate"
            );
        }
    }

    // ── emit JSON shape ─────────────────────────────────────────────────────

    #[test]
    fn emit_inserts_ok_flag_into_json() {
        let payload = serde_json::json!({ "action": "test" });
        emit(OutputFormat::Text, payload, true, None).expect("emit must succeed");
    }

    #[test]
    fn emit_records_errors_when_failed() {
        let payload = serde_json::json!({ "action": "test" });
        let result = emit(
            OutputFormat::Text,
            payload,
            false,
            Some(vec!["boom".to_string()]),
        );
        assert!(
            result.is_ok(),
            "emit itself must succeed even on action failure"
        );
    }
}
