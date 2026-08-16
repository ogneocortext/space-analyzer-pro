//! File/directory origin tracing and deletion-safety analysis.
//!
//! This is the read-only safety layer that prevents users from deleting
//! important files when reclaiming disk space. It maps each scanned path to
//! the application or system that created it (its "origin"), classifies it,
//! and assigns a deletion-safety verdict with human-readable reasoning.
//!
//! Used by the CLI (`--trace-origins`) and the markdown report generator so
//! users can see *where* files came from and *whether* they are safe to remove
//! before deleting anything.

use serde::Serialize;
use std::path::Path;

use crate::file_relations;
use crate::gui_common::{DirEntry, ScanReport};

/// Deletion safety verdict.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum SafetyLevel {
    /// Regenerable / reinstallable. Deleting loses no permanent data.
    Safe,
    /// Likely safe but verify first (may hold settings/sessions you want to keep).
    Review,
    /// Probably needed; keep unless you know exactly what you are doing.
    Caution,
    /// Critical user data, credentials, source control, or installed applications.
    DoNotDelete,
}

impl SafetyLevel {
    /// Short human-readable label.
    pub fn label(self) -> &'static str {
        match self {
            SafetyLevel::Safe => "SAFE TO DELETE",
            SafetyLevel::Review => "REVIEW FIRST",
            SafetyLevel::Caution => "KEEP (LIKELY NEEDED)",
            SafetyLevel::DoNotDelete => "DO NOT DELETE",
        }
    }

    /// Single-glyph emoji used in CLI/report output.
    pub fn emoji(self) -> &'static str {
        match self {
            SafetyLevel::Safe => "🟢",
            SafetyLevel::Review => "🟡",
            SafetyLevel::Caution => "🟠",
            SafetyLevel::DoNotDelete => "🔴",
        }
    }

    /// Sort rank (most cautionary first when grouping).
    pub fn rank(self) -> u8 {
        match self {
            SafetyLevel::DoNotDelete => 0,
            SafetyLevel::Caution => 1,
            SafetyLevel::Review => 2,
            SafetyLevel::Safe => 3,
        }
    }
}

/// A single origin + safety assessment for a directory or file.
#[derive(Debug, Clone, Serialize)]
pub struct OriginAssessment {
    /// Absolute path that was assessed.
    pub path: String,
    /// Final path component (display name).
    pub name: String,
    /// Size in bytes (aggregated for directories).
    pub size: u64,
    /// Number of files underneath (directories only).
    pub file_count: u64,
    /// True for directories, false for individual files.
    pub is_directory: bool,
    /// Application or system that created/owns this path.
    pub origin: String,
    /// Coarse storage category (Cache, Build Output, Dev Dependencies, ...).
    pub category: String,
    /// Deletion safety verdict.
    pub safety: SafetyLevel,
    /// True if the contents can be regenerated or reinstalled after deletion.
    pub recoverable: bool,
    /// Whether the owning application appears installed (`Some(true/false)` when
    /// detectable, `None` when not applicable).
    pub app_installed: Option<bool>,
    /// Related paths traced from this entry (parent projects, symlinks, siblings).
    pub related_paths: Vec<String>,
    /// Human-readable explanation of the verdict.
    pub reasoning: String,
}

/// Aggregated origin-tracing report for a full scan.
#[derive(Debug, Clone, Serialize)]
pub struct OriginReport {
    /// Root path that was scanned.
    pub scan_path: String,
    /// Number of entries assessed.
    pub total_assessed: usize,
    /// Total bytes judged safe to delete.
    pub safe_to_delete_bytes: u64,
    /// Total bytes that need review before deletion.
    pub review_bytes: u64,
    /// Total bytes that should be kept (likely needed).
    pub caution_bytes: u64,
    /// Total bytes that must not be deleted.
    pub keep_bytes: u64,
    /// Per-entry assessments, largest first.
    pub assessments: Vec<OriginAssessment>,
}

impl OriginReport {
    /// Total bytes assessed.
    pub fn assessed_bytes(&self) -> u64 {
        self.safe_to_delete_bytes
            .saturating_add(self.review_bytes)
            .saturating_add(self.caution_bytes)
            .saturating_add(self.keep_bytes)
    }
}

/// Internal classification result used by [`classify_path`].
struct Classification {
    origin: &'static str,
    category: &'static str,
    safety: SafetyLevel,
    recoverable: bool,
    /// Candidate tools whose presence confirms the owning app is installed.
    apps: &'static [&'static str],
    reasoning: String,
}

/// Case-insensitive path context shared across classifier helpers.
struct Ctx<'a> {
    p: &'a str,
    p_norm: &'a str,
    basename: &'a str,
}

/// Classify a single path into an origin + safety verdict.
///
/// Checks run from most specific to most general; the first match wins.
fn classify_path(path: &str) -> Classification {
    let p = path.to_lowercase();
    let p_norm = p.replace('/', "\\");
    let basename = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();
    let ctx = Ctx {
        p: &p,
        p_norm: &p_norm,
        basename: &basename,
    };

    classify_credentials(&ctx)
        .or_else(|| classify_vcs(&ctx))
        .or_else(|| classify_user_data(&ctx))
        .or_else(|| classify_temp(&ctx))
        .or_else(|| classify_rust(&ctx))
        .or_else(|| classify_dotnet(&ctx))
        .or_else(|| classify_node_python(&ctx))
        .or_else(|| classify_user_profile(&ctx))
        .or_else(|| classify_build_output(path, &ctx))
        .or_else(|| classify_ai_tools(&ctx))
        .or_else(|| classify_editors(&ctx))
        .or_else(|| classify_virtualization(&ctx))
        .or_else(|| classify_appdata(&ctx))
        .or_else(|| classify_generic_cache(&ctx))
        .or_else(|| classify_project_source(path, &ctx))
        .or_else(|| classify_system(&ctx))
        .unwrap_or_else(default_classification)
}

fn default_classification() -> Classification {
    Classification {
        origin: "Unknown",
        category: "Other",
        safety: SafetyLevel::Review,
        recoverable: false,
        apps: &[],
        reasoning: "Origin could not be traced automatically. Inspect the contents \
            before deleting to avoid losing something important."
            .to_string(),
    }
}

fn classify_credentials(c: &Ctx) -> Option<Classification> {
    if c.p_norm.contains("\\.ssh")
        || c.p_norm.contains("\\.gnupg")
        || c.p_norm.contains("\\.aws")
        || c.p_norm.contains("\\.kube")
        || c.p_norm.contains("\\secrets")
        || c.basename == ".env"
        || c.basename.ends_with(".env")
        || c.basename.ends_with(".pem")
        || c.basename.ends_with(".key")
        || c.basename.ends_with(".keystore")
        || c.basename.ends_with(".ppk")
    {
        Some(Classification {
            origin: "Credentials / Secrets",
            category: "Credentials",
            safety: SafetyLevel::DoNotDelete,
            recoverable: false,
            apps: &[],
            reasoning: "Contains credentials or secret keys. Deleting these can \
                permanently lock you out of accounts, servers, or services."
                .to_string(),
        })
    } else {
        None
    }
}

fn classify_vcs(c: &Ctx) -> Option<Classification> {
    if c.basename == ".git"
        || c.p_norm.contains("\\.git\\")
        || c.basename == ".hg"
        || c.basename == ".svn"
    {
        Some(Classification {
            origin: "Version Control (Git/Mercurial/SVN)",
            category: "VCS",
            safety: SafetyLevel::DoNotDelete,
            recoverable: false,
            apps: &["git"],
            reasoning: "Version-control metadata and full commit history. Deleting \
                this destroys project history and is not recoverable without a remote."
                .to_string(),
        })
    } else {
        None
    }
}

fn classify_user_data(c: &Ctx) -> Option<Classification> {
    let is_user_media = c.p_norm.ends_with("\\documents")
        || c.p_norm.contains("\\documents\\")
        || c.p_norm.ends_with("\\desktop")
        || c.p_norm.ends_with("\\pictures")
        || c.p_norm.contains("\\pictures\\")
        || c.p_norm.ends_with("\\videos")
        || c.p_norm.contains("\\videos\\")
        || c.p_norm.ends_with("\\music")
        || c.p_norm.contains("\\music\\")
        || c.p_norm.ends_with("\\3d objects")
        || c.p_norm.contains("\\3d objects\\");

    if is_user_media {
        return Some(Classification {
            origin: "Windows user profile (personal files)",
            category: "User Data",
            safety: SafetyLevel::DoNotDelete,
            recoverable: false,
            apps: &[],
            reasoning: "Personal user documents, media, or desktop files. These are \
                irreplaceable user data — keep unless you have a backup."
                .to_string(),
        });
    }

    if c.p_norm.ends_with("\\downloads") || c.p_norm.contains("\\downloads\\") {
        return Some(Classification {
            origin: "Windows user profile (Downloads)",
            category: "User Data",
            safety: SafetyLevel::Review,
            recoverable: false,
            apps: &[],
            reasoning: "User downloads — a mix of installers (often safe to remove \
                after install) and personal files. Inspect contents before deleting."
                .to_string(),
        });
    }

    if c.p_norm.contains("$recycle.bin") {
        return Some(Classification {
            origin: "Windows Recycle Bin",
            category: "Trash",
            safety: SafetyLevel::Safe,
            recoverable: false,
            apps: &[],
            reasoning: "Already-deleted files held by the Recycle Bin. Empty it to \
                reclaim space once you are sure you do not want to restore anything."
                .to_string(),
        });
    }

    None
}

fn classify_temp(c: &Ctx) -> Option<Classification> {
    if c.p_norm.ends_with("\\temp")
        || c.p_norm.contains("\\temp\\")
        || c.p_norm.ends_with("\\tmp")
        || c.p_norm.contains("\\tmp\\")
        || c.p_norm.contains("\\crashdumps")
        || c.p_norm.contains("\\crash reports")
        || c.basename.ends_with(".dmp")
        || c.basename.ends_with(".dump")
    {
        return Some(Classification {
            origin: "Windows / applications (temporary & crash data)",
            category: "Temp/Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &[],
            reasoning: "Temporary files, crash dumps, or transient data. Safe to \
                delete; applications recreate what they need."
                .to_string(),
        });
    }

    if c.basename == "logs" || c.basename.ends_with(".log") {
        return Some(Classification {
            origin: "Application logs",
            category: "Logs",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "Log files. Usually safe to clear, but keep recent ones if \
                you are debugging an issue."
                .to_string(),
        });
    }

    None
}

fn classify_rust(c: &Ctx) -> Option<Classification> {
    if c.basename == "target" {
        return Some(Classification {
            origin: "Rust / Cargo (build output)",
            category: "Build Output",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &["cargo"],
            reasoning: "Cargo build artifacts (`target/`). Fully regenerated by \
                `cargo build`; safe to delete."
                .to_string(),
        });
    }
    if c.basename == "registry" && c.p_norm.contains("\\.cargo\\") {
        return Some(Classification {
            origin: "Rust / Cargo (registry cache)",
            category: "Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &["cargo"],
            reasoning: "Cargo downloaded-crate cache. Re-downloaded on demand; safe \
                to clear with `cargo cache --autoclean` or by deleting."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.cargo\\bin") {
        return Some(Classification {
            origin: "Rust / Cargo (installed toolchain binaries)",
            category: "App Data",
            safety: SafetyLevel::Caution,
            recoverable: true,
            apps: &["cargo"],
            reasoning: "Rust toolchain binaries installed via `cargo install`. \
                Reinstallable, but deleting breaks `cargo`/tools until reinstalled."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.rustup") || c.p_norm.contains("\\.rustup\\") {
        return Some(Classification {
            origin: "Rustup (toolchain manager)",
            category: "App Data",
            safety: SafetyLevel::Caution,
            recoverable: true,
            apps: &["rustup", "cargo"],
            reasoning: "Rust toolchains managed by rustup. Reinstallable via rustup, \
                but removing breaks the Rust compiler until restored."
                .to_string(),
        });
    }
    None
}

fn classify_dotnet(c: &Ctx) -> Option<Classification> {
    if c.p_norm.contains("\\.nuget\\packages") || c.p_norm.ends_with("\\.nuget\\packages") {
        return Some(Classification {
            origin: ".NET / NuGet (global package cache)",
            category: "Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &["dotnet"],
            reasoning: "NuGet global package cache. Restored automatically on build; \
                safe to clear with `dotnet nuget locals global-packages --clear`."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.nuget") {
        return Some(Classification {
            origin: ".NET / NuGet",
            category: "App Data",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &["dotnet"],
            reasoning: "NuGet user data folder. The packages subfolder is safe to \
                clear; keep the rest."
                .to_string(),
        });
    }
    None
}

fn classify_node_python(c: &Ctx) -> Option<Classification> {
    if c.basename == "node_modules" {
        return Some(Classification {
            origin: "Node.js / npm (project dependencies)",
            category: "Dev Dependencies",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &["npm", "node"],
            reasoning: "npm/Yarn/pnpm project dependencies. Regenerated by \
                `npm install`; safe to delete (run install again before building)."
                .to_string(),
        });
    }

    if c.basename == "__pycache__"
        || c.basename == ".pytest_cache"
        || c.basename == ".ruff_cache"
        || c.basename == ".mypy_cache"
        || c.basename == ".nox"
        || c.basename == ".tox"
    {
        return Some(Classification {
            origin: "Python (bytecode/tool caches)",
            category: "Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &["python"],
            reasoning: "Python bytecode or tool caches. Regenerated automatically; \
                safe to delete."
                .to_string(),
        });
    }
    if c.basename == "venv"
        || c.basename == ".venv"
        || c.basename == "env"
        || c.basename == ".env-win"
    {
        return Some(Classification {
            origin: "Python (virtual environment)",
            category: "Dev Dependencies",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &["python"],
            reasoning: "Python virtual environment. Recreated with `python -m venv` \
                and `pip install -r requirements.txt`; safe to delete."
                .to_string(),
        });
    }
    if c.p_norm.contains("\\site-packages\\") {
        return Some(Classification {
            origin: "Python (installed packages)",
            category: "Dev Dependencies",
            safety: SafetyLevel::Caution,
            recoverable: true,
            apps: &["pip", "python"],
            reasoning: "Installed Python packages (site-packages). Reinstallable via \
                `pip install`, but deleting breaks the affected packages until reinstalled."
                .to_string(),
        });
    }
    if c.p_norm.contains("\\pip\\cache") || c.p_norm.contains("\\pip\\cache\\") {
        return Some(Classification {
            origin: "Python pip (download cache)",
            category: "Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &["pip", "python"],
            reasoning: "pip wheel download cache. Safe to clear with `pip cache purge`."
                .to_string(),
        });
    }

    None
}

fn classify_user_profile(c: &Ctx) -> Option<Classification> {
    if c.basename == ".browserclaw" || c.p_norm.contains("\\.browserclaw\\") {
        return Some(Classification {
            origin: "BrowserClaw / BrowserOS (AI browser agent)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "BrowserClaw/BrowserOS replays and agent data. Review for \
                sessions/snapshots you want to keep before deleting."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.local\\share\\kilo")
        || c.p_norm.ends_with("\\.kilo")
        || c.p_norm.contains("\\.local\\share\\kilo\\")
    {
        return Some(Classification {
            origin: "Kilo Code (AI coding agent)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "Kilo Code data (settings, history, node_modules). \
                Reinstallable; review for sessions/settings you want to keep."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.local\\share\\opencode")
        || c.p_norm.contains("\\.local\\share\\opencode\\")
    {
        return Some(Classification {
            origin: "OpenCode (AI coding assistant)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "OpenCode desktop data (includes DB and extensions). \
                Reinstallable; review for history/settings before deleting."
                .to_string(),
        });
    }
    if c.basename == ".u2net" || c.p_norm.ends_with("\\.u2net") {
        return Some(Classification {
            origin: "U2Net (AI segmentation model)",
            category: "AI Models",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "U2Net model weights. Re-downloadable; safe to remove if you \
                no longer use the app that depends on it."
                .to_string(),
        });
    }
    if c.p_norm.contains("\\.codeium\\windsurf\\") || c.p_norm.contains("\\.windsurf\\") {
        return Some(Classification {
            origin: "Windsurf (AI IDE)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &["windsurf"],
            reasoning: "Windsurf IDE data, extensions, and implicit caches. \
                Reinstallable; review for settings/sessions before deleting."
                .to_string(),
        });
    }
    if c.basename == ".pkg-cache" || c.p_norm.ends_with("\\.pkg-cache") {
        return Some(Classification {
            origin: "Package manager cache",
            category: "Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &[],
            reasoning: "Generic package download cache. Regenerated on next install; \
                safe to delete."
                .to_string(),
        });
    }
    if c.basename == ".safety" || c.p_norm.ends_with("\\.safety") {
        return Some(Classification {
            origin: "Chrome Safety / browser data",
            category: "App Data",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "Browser Safety check / quota data. Usually safe to clear; \
                review for any pinned state you rely on."
                .to_string(),
        });
    }
    if c.basename == ".zcode" || c.p_norm.ends_with("\\.zcode") {
        return Some(Classification {
            origin: "ZCode (AI coding agent)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "ZCode CLI/agent rollout data. Reinstallable; review for \
                history/settings before deleting."
                .to_string(),
        });
    }
    if c.basename == "library" && c.p_norm.contains("\\setup guide") {
        return Some(Classification {
            origin: "Game/editor project cache (Library)",
            category: "Build Output",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &[],
            reasoning: "Game/editor project Library folder. Regenerated by the editor; \
                safe to delete."
                .to_string(),
        });
    }
    if c.basename == ".npm" || c.p_norm.ends_with("\\.npm") {
        return Some(Classification {
            origin: "Node.js / npm (global cache)",
            category: "Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &["npm", "node"],
            reasoning: "npm global cache. Regenerated on next install; safe to clear.".to_string(),
        });
    }
    if c.basename == ".next" || c.basename == ".nuxt" {
        return Some(Classification {
            origin: "Web framework build output",
            category: "Build Output",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &[],
            reasoning: "Next.js/Nuxt build output. Regenerated by the build; safe to delete."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\go\\bin") {
        return Some(Classification {
            origin: "Go (installed binaries)",
            category: "App Data",
            safety: SafetyLevel::Caution,
            recoverable: true,
            apps: &["go"],
            reasoning: "Go-installed binaries (`go install`). Reinstallable, but \
                deleting breaks the installed tools until restored."
                .to_string(),
        });
    }
    if c.basename == "bin" && c.p_norm.starts_with("c:\\users\\") {
        return Some(Classification {
            origin: "User-installed binaries",
            category: "App Data",
            safety: SafetyLevel::Review,
            recoverable: false,
            apps: &[],
            reasoning: "`bin` folder in the user profile. Likely holds user-installed \
                tools; inspect before deleting."
                .to_string(),
        });
    }
    if c.p_norm.contains("\\updater\\") || c.basename.ends_with("-updater") {
        return Some(Classification {
            origin: "Application updater cache",
            category: "Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &[],
            reasoning: "App updater download cache (installers/stubs). Safe to delete; \
                the owning app re-downloads what it needs."
                .to_string(),
        });
    }
    if c.basename == "daemon" && c.p_norm.contains("\\.gradle\\") {
        return Some(Classification {
            origin: "Gradle (daemon logs/state)",
            category: "Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &["gradle"],
            reasoning: "Gradle daemon state/logs. Killing the daemon and re-running \
                the build regenerates this; safe to delete."
                .to_string(),
        });
    }
    None
}

fn classify_build_output(path: &str, c: &Ctx) -> Option<Classification> {
    if c.basename == "build" || c.basename == "dist" || c.basename == "out" {
        return Some(Classification {
            origin: "Project build output",
            category: "Build Output",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &[],
            reasoning: "Project build/output directory. Regenerated by the build \
                system; safe to delete."
                .to_string(),
        });
    }
    if c.basename == "bin" {
        // Inside a project → build output (safe); otherwise may be app binaries.
        let safety = if is_inside_project(path) {
            SafetyLevel::Safe
        } else {
            SafetyLevel::Review
        };
        return Some(Classification {
            origin: "Binary output directory",
            category: "Build Output",
            safety,
            recoverable: safety == SafetyLevel::Safe,
            apps: &[],
            reasoning: "`bin` directory — build output when inside a project (safe), \
                but may hold installed binaries otherwise. Verify before deleting."
                .to_string(),
        });
    }
    if c.basename == ".gradle" {
        return Some(Classification {
            origin: "Gradle (build cache)",
            category: "Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &["gradle"],
            reasoning: "Gradle build cache. Regenerated on next build; safe to delete.".to_string(),
        });
    }
    None
}

fn classify_ai_tools(c: &Ctx) -> Option<Classification> {
    if c.p_norm.contains("\\.ollama") {
        return Some(Classification {
            origin: "Ollama (local LLM models)",
            category: "AI Models",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &["ollama"],
            reasoning: "Ollama model blobs. Re-pullable with `ollama pull`, but large. \
                Remove only models you no longer use via `ollama rm <model>`."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.gemini") || c.p_norm.contains("\\.gemini\\") {
        return Some(Classification {
            origin: "Google Gemini CLI / Antigravity",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &["gemini"],
            reasoning: "Gemini CLI / Antigravity data. May contain session history \
                and OAuth tokens; review before deleting (re-login required after)."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.codex") || c.p_norm.contains("\\.codex\\") {
        return Some(Classification {
            origin: "OpenAI Codex CLI",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &["codex"],
            reasoning: "Codex CLI data. May hold auth and session state; review \
                before deleting (re-authentication required after removal)."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.cline") || c.p_norm.contains("\\.cline\\") {
        return Some(Classification {
            origin: "Cline (AI coding agent)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "Cline agent workspace/data. May contain task history; review \
                before deleting."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.kilocode")
        || c.p_norm.ends_with("\\.kilo")
        || c.p_norm.contains("\\.kilocode\\")
    {
        return Some(Classification {
            origin: "Kilo Code (AI coding agent)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "Kilo Code data (includes node_modules). Reinstallable, but \
                review for settings/history you want to keep."
                .to_string(),
        });
    }
    classify_ai_tools_part2(c)
}

fn classify_ai_tools_part2(c: &Ctx) -> Option<Classification> {
    if c.p_norm.ends_with("\\.windsurf") || c.p_norm.contains("\\.windsurf\\") {
        return Some(Classification {
            origin: "Windsurf (AI IDE)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &["windsurf"],
            reasoning: "Windsurf IDE data and extensions. Reinstallable; review for \
                settings/sessions before deleting."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.antigravity") || c.p_norm.contains("\\.antigravity\\") {
        return Some(Classification {
            origin: "Google Antigravity (AI IDE)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "Antigravity IDE data and extensions. Reinstallable; review \
                for settings/sessions before deleting."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.aitk") || c.p_norm.contains("\\.aitk\\") {
        return Some(Classification {
            origin: "AI Toolkit (AITK)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "AI Toolkit data/evals. Review for eval results you want to \
                keep before deleting."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.eigent") || c.p_norm.contains("\\.eigent\\") {
        return Some(Classification {
            origin: "Eigent (AI agent)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "Eigent agent data (includes venvs). Reinstallable; review for \
                settings/history before deleting."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.continue") || c.p_norm.contains("\\.continue\\") {
        return Some(Classification {
            origin: "Continue (AI coding assistant)",
            category: "AI Tools",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "Continue assistant config/data. Review for settings you want \
                to keep before deleting."
                .to_string(),
        });
    }
    None
}

fn classify_editors(c: &Ctx) -> Option<Classification> {
    if c.p_norm.contains("\\.vscode\\extensions")
        || c.p_norm.contains("\\.vscode-insiders\\extensions")
    {
        return Some(Classification {
            origin: "VS Code (extensions)",
            category: "App Data",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &["code"],
            reasoning: "VS Code extensions. Reinstallable from the marketplace, but \
                removing all extensions loses your setup until reinstalled."
                .to_string(),
        });
    }
    if c.p_norm.ends_with("\\.vscode") || c.p_norm.contains("\\.vscode\\") {
        return Some(Classification {
            origin: "VS Code (user data)",
            category: "App Data",
            safety: SafetyLevel::Caution,
            recoverable: true,
            apps: &["code"],
            reasoning: "VS Code user data/settings. Reinstallable but contains your \
                preferences and snippets; keep unless resetting."
                .to_string(),
        });
    }
    if c.p_norm.contains("\\.windsurf\\extensions") {
        return Some(Classification {
            origin: "Windsurf (extensions)",
            category: "App Data",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &["windsurf"],
            reasoning: "Windsurf extensions. Reinstallable from the marketplace.".to_string(),
        });
    }
    None
}

fn classify_virtualization(c: &Ctx) -> Option<Classification> {
    // WSL distribution disk images (.vhdx) — deleting destroys the Linux distro.
    if c.p_norm.contains("\\appdata\\local\\wsl\\") || c.p_norm.contains("\\wsl\\") {
        return Some(Classification {
            origin: "WSL (Linux distribution disk image)",
            category: "Virtualization",
            safety: SafetyLevel::Caution,
            recoverable: true,
            apps: &["wsl"],
            reasoning: "WSL distribution virtual disk (.vhdx). Deleting destroys the \
                Linux distro and its files; reinstallable via `wsl --install` but data is lost."
                .to_string(),
        });
    }
    // Google Play Games / Android emulator (AVD) and SDK system-image data.
    if c.p_norm.contains("\\play games\\")
        || c.p_norm.contains("\\android\\avd\\")
        || c.p_norm.contains("\\android\\sdk\\")
        || c.basename.ends_with(".avd")
    {
        return Some(Classification {
            origin: "Android emulator / SDK (AVD data)",
            category: "Virtualization",
            safety: SafetyLevel::Review,
            recoverable: true,
            apps: &[],
            reasoning: "Android emulator (AVD) or SDK system-image data. Re-downloadable, \
                but large and may hold emulator state/snapshots; review before deleting."
                .to_string(),
        });
    }
    None
}

fn classify_appdata(c: &Ctx) -> Option<Classification> {
    if c.p_norm.contains("\\appdata\\local\\temp") {
        return Some(Classification {
            origin: "Windows (per-user Temp)",
            category: "Temp/Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &[],
            reasoning: "Per-user temporary files. Safe to clear (close apps first).".to_string(),
        });
    }
    if c.p_norm.contains("\\appdata\\local\\") {
        if c.p.contains("cache")
            || c.p.contains("\\caches")
            || c.p.contains("\\cacheddata")
            || c.p.contains("dxcache")
            || c.p.contains("code cache")
            || c.p.contains("gpu cache")
        {
            return Some(Classification {
                origin: "Application cache (AppData\\Local)",
                category: "Cache",
                safety: SafetyLevel::Safe,
                recoverable: true,
                apps: &[],
                reasoning: "Application cache under AppData\\Local. Regenerated by \
                    the owning app; safe to delete."
                    .to_string(),
            });
        }
        if c.p.contains("\\packages\\") {
            return Some(Classification {
                origin: "UWP / Store apps (AppData\\Local\\Packages)",
                category: "App Data",
                safety: SafetyLevel::Caution,
                recoverable: false,
                apps: &[],
                reasoning: "UWP/Store app local state. Deleting breaks the app's \
                    local data; keep unless uninstalling the app."
                    .to_string(),
            });
        }
        if c.p.contains("\\updater\\") || c.basename.ends_with("-updater") {
            return Some(Classification {
                origin: "Application updater cache (AppData\\Local)",
                category: "Cache",
                safety: SafetyLevel::Safe,
                recoverable: true,
                apps: &[],
                reasoning: "App updater download cache (installers/stubs). Safe to delete; \
                    the owning app re-downloads what it needs."
                    .to_string(),
            });
        }
        return Some(Classification {
            origin: "Application data (AppData\\Local)",
            category: "App Data",
            safety: SafetyLevel::Review,
            recoverable: false,
            apps: &[],
            reasoning: "Per-application local data. Safety depends on the app: \
                caches are fine to clear, but some folders hold needed state. Inspect first."
                .to_string(),
        });
    }
    if c.p_norm.contains("\\appdata\\roaming\\") {
        if c.p.contains("cache") || c.p.contains("\\caches") {
            return Some(Classification {
                origin: "Application cache (AppData\\Roaming)",
                category: "Cache",
                safety: SafetyLevel::Safe,
                recoverable: true,
                apps: &[],
                reasoning: "Application cache under AppData\\Roaming. Safe to clear.".to_string(),
            });
        }
        return Some(Classification {
            origin: "Application data (AppData\\Roaming)",
            category: "App Data",
            safety: SafetyLevel::Caution,
            recoverable: false,
            apps: &[],
            reasoning: "Roaming application data (settings, profiles, sometimes \
                databases). Keep unless you are resetting the owning app."
                .to_string(),
        });
    }
    None
}

fn classify_generic_cache(c: &Ctx) -> Option<Classification> {
    if c.basename == "cache"
        || c.basename == "caches"
        || c.basename == "cacheddata"
        || c.basename == ".cache"
        || c.basename == "gpu cache"
        || c.basename == "code cache"
        || c.basename == "shader cache"
        || c.basename == "dxcache"
    {
        return Some(Classification {
            origin: "Application cache",
            category: "Cache",
            safety: SafetyLevel::Safe,
            recoverable: true,
            apps: &[],
            reasoning: "Generic cache directory. Regenerated by the owning app; safe \
                to delete."
                .to_string(),
        });
    }
    None
}

fn classify_project_source(path: &str, _c: &Ctx) -> Option<Classification> {
    if is_project_root(path) {
        return Some(Classification {
            origin: "User project (source code)",
            category: "Source Code",
            safety: SafetyLevel::Caution,
            recoverable: false,
            apps: &[],
            reasoning: "Looks like a project root (has package.json / Cargo.toml / \
                .git / pyproject.toml). This is source code — keep it."
                .to_string(),
        });
    }
    None
}

fn classify_system(c: &Ctx) -> Option<Classification> {
    if c.p_norm.contains(":\\windows\\") || c.p_norm.starts_with("c:\\windows") {
        return Some(Classification {
            origin: "Windows operating system",
            category: "System",
            safety: SafetyLevel::DoNotDelete,
            recoverable: false,
            apps: &[],
            reasoning: "Windows system files. Deleting can break the operating system.".to_string(),
        });
    }
    if c.p_norm.contains("\\program files\\") || c.p_norm.contains("\\program files (x86)\\") {
        return Some(Classification {
            origin: "Installed application",
            category: "Program Files",
            safety: SafetyLevel::DoNotDelete,
            recoverable: false,
            apps: &[],
            reasoning: "Installed application files. Remove via the app's uninstaller, \
                not by direct deletion."
                .to_string(),
        });
    }
    None
}

/// Quick check: does this path look like a project root?
fn is_project_root(path: &str) -> bool {
    let p = Path::new(path);
    if !p.is_dir() {
        return false;
    }
    const MARKERS: &[&str] = &[
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "setup.py",
        ".git",
        "go.mod",
        "pom.xml",
        "build.gradle",
        "CMakeLists.txt",
        "Gemfile",
    ];
    MARKERS.iter().any(|m| p.join(m).exists())
}

/// Is the path located somewhere inside a project root (within a few parents)?
fn is_inside_project(path: &str) -> bool {
    let mut current = Path::new(path).parent();
    for _ in 0..6 {
        match current {
            Some(parent) => {
                if is_project_root(parent.to_str().unwrap_or("")) {
                    return true;
                }
                current = parent.parent();
            }
            None => break,
        }
    }
    false
}

/// Detect whether any of the candidate tools are installed and on PATH.
fn any_app_installed(apps: &[&str]) -> Option<bool> {
    if apps.is_empty() {
        return None;
    }
    let found = apps.iter().any(|app| which::which(app).is_ok());
    Some(found)
}

/// Trace lightweight relationships for a directory: parent project + symlink status.
fn trace_dir_relations(path: &str) -> Vec<String> {
    let mut related = Vec::new();
    let p = Path::new(path);

    if let Ok(meta) = std::fs::symlink_metadata(p) {
        if meta.file_type().is_symlink() {
            if let Ok(target) = std::fs::read_link(p) {
                related.push(format!("symlink → {}", target.display()));
            }
        }
    }

    // Find the nearest enclosing project root.
    let mut current = p.parent();
    while let Some(parent) = current {
        if is_project_root(parent.to_str().unwrap_or("")) {
            related.push(format!("belongs to project: {}", parent.display()));
            break;
        }
        current = parent.parent();
    }

    related
}

/// Build an [`OriginAssessment`] for a scanned directory entry.
pub fn assess_directory(dir: &DirEntry) -> OriginAssessment {
    let class = classify_path(&dir.path);
    let related = trace_dir_relations(&dir.path);
    let app_installed = any_app_installed(class.apps);

    OriginAssessment {
        path: dir.path.clone(),
        name: dir.name.clone(),
        size: dir.total_size,
        file_count: dir.file_count,
        is_directory: true,
        origin: class.origin.to_string(),
        category: class.category.to_string(),
        safety: class.safety,
        recoverable: class.recoverable,
        app_installed,
        related_paths: related,
        reasoning: class.reasoning,
    }
}

/// Build an [`OriginAssessment`] for an individual large file.
///
/// Uses [`file_relations::analyze_file_dependencies`] to trace siblings,
/// hardlinks and symlinks so deletion impact is visible.
pub fn assess_file(path: &str, size: u64) -> OriginAssessment {
    let class = classify_path(path);
    let name = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path)
        .to_string();
    let app_installed = any_app_installed(class.apps);

    // Trace file-level relationships via the existing dependency analyzer.
    let mut related: Vec<String> = Vec::new();
    let dep = file_relations::analyze_file_dependencies(path);
    if dep.is_symlink {
        if let Some(t) = &dep.symlink_target {
            related.push(format!("symlink → {t}"));
        }
    }
    if dep.hardlink_count > 0 {
        related.push(format!(
            "{} hardlink/duplicate candidate(s) — deleting one copy keeps the data",
            dep.hardlink_count
        ));
    }
    for f in dep.same_stem_files.iter().take(5) {
        related.push(format!("same-stem file: {}", f.path));
    }
    for f in dep.symlink_sources.iter().take(5) {
        related.push(format!("symlink source: {}", f.path));
    }
    if !dep.summary.is_empty() {
        related.push(dep.summary);
    }

    OriginAssessment {
        path: path.to_string(),
        name,
        size,
        file_count: 0,
        is_directory: false,
        origin: class.origin.to_string(),
        category: class.category.to_string(),
        safety: class.safety,
        recoverable: class.recoverable,
        app_installed,
        related_paths: related,
        reasoning: class.reasoning,
    }
}

/// Build a full [`OriginReport`] from a scan result.
///
/// Assesses the top directories and the largest individual files, then
/// aggregates the safety verdicts into reclaimable-space totals.
pub fn build_report(result: &ScanReport, max_dirs: usize, max_files: usize) -> OriginReport {
    let mut assessments: Vec<OriginAssessment> = Vec::new();

    for dir in result.top_directories.iter().take(max_dirs) {
        assessments.push(assess_directory(dir));
    }

    // Assess largest files, skipping ones already covered by their parent dir.
    let dir_paths: std::collections::HashSet<&str> = result
        .top_directories
        .iter()
        .take(max_dirs)
        .map(|d| d.path.as_str())
        .collect();
    for file in result.largest_files.iter().take(max_files) {
        let path = &file.path;
        let size = file.size;
        let covered = dir_paths.iter().any(|dp| path.starts_with(dp));
        if covered {
            continue;
        }
        assessments.push(assess_file(path, size));
    }

    // De-duplicate by path, keep largest, sort by size descending.
    assessments.sort_by_key(|a| std::cmp::Reverse(a.size));
    let mut seen = std::collections::HashSet::new();
    assessments.retain(|a| seen.insert(a.path.clone()));

    let mut safe = 0u64;
    let mut review = 0u64;
    let mut caution = 0u64;
    let mut keep = 0u64;
    for a in &assessments {
        match a.safety {
            SafetyLevel::Safe => safe += a.size,
            SafetyLevel::Review => review += a.size,
            SafetyLevel::Caution => caution += a.size,
            SafetyLevel::DoNotDelete => keep += a.size,
        }
    }

    OriginReport {
        scan_path: result.path.clone(),
        total_assessed: assessments.len(),
        safe_to_delete_bytes: safe,
        review_bytes: review,
        caution_bytes: caution,
        keep_bytes: keep,
        assessments,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_credentials_as_do_not_delete() {
        let c = classify_path("C:\\Users\\someone\\.ssh\\id_rsa");
        assert_eq!(c.safety, SafetyLevel::DoNotDelete);
        assert_eq!(c.category, "Credentials");
    }

    #[test]
    fn classifies_git_as_do_not_delete() {
        let c = classify_path("C:\\proj\\.git");
        assert_eq!(c.safety, SafetyLevel::DoNotDelete);
        assert_eq!(c.category, "VCS");
    }

    #[test]
    fn classifies_node_modules_as_safe() {
        let c = classify_path("C:\\proj\\node_modules");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert!(c.recoverable);
    }

    #[test]
    fn classifies_target_as_safe() {
        let c = classify_path("C:\\proj\\target");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert_eq!(c.category, "Build Output");
    }

    #[test]
    fn classifies_documents_as_do_not_delete() {
        let c = classify_path("C:\\Users\\someone\\Documents");
        assert_eq!(c.safety, SafetyLevel::DoNotDelete);
    }

    #[test]
    fn classifies_recycle_bin_as_safe() {
        let c = classify_path("C:\\$Recycle.Bin\\S-1-5-21");
        assert_eq!(c.safety, SafetyLevel::Safe);
    }

    #[test]
    fn classifies_ollama_as_review() {
        let c = classify_path("C:\\Users\\someone\\.ollama");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.origin, "Ollama (local LLM models)");
    }

    #[test]
    fn classifies_nuget_packages_as_safe() {
        let c = classify_path("C:\\Users\\someone\\.nuget\\packages\\newtonsoft.json");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert!(c.recoverable);
    }

    #[test]
    fn classifies_appdata_roaming_as_caution() {
        let c = classify_path("C:\\Users\\someone\\AppData\\Roaming\\SomeApp");
        assert_eq!(c.safety, SafetyLevel::Caution);
    }

    #[test]
    fn classifies_appdata_local_cache_as_safe() {
        let c = classify_path("C:\\Users\\someone\\AppData\\Local\\SomeApp\\Cache");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert_eq!(c.category, "Cache");
    }

    #[test]
    fn classifies_site_packages_as_caution() {
        // Installed package contents (e.g. torch) must NOT be flagged safe.
        let c = classify_path("C:\\Python311\\Lib\\site-packages\\torch\\lib");
        assert_eq!(c.safety, SafetyLevel::Caution);
        assert_eq!(c.origin, "Python (installed packages)");
    }

    #[test]
    fn classifies_venv_root_as_safe() {
        let c = classify_path("C:\\proj\\.venv");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert_eq!(c.origin, "Python (virtual environment)");
    }

    #[test]
    fn classifies_wsl_vhdx_as_caution() {
        let c = classify_path("C:\\Users\\someone\\AppData\\Local\\wsl\\{guid}\\ext4.vhdx");
        assert_eq!(c.safety, SafetyLevel::Caution);
        assert_eq!(c.category, "Virtualization");
    }

    #[test]
    fn classifies_android_avd_as_review() {
        let c = classify_path("C:\\Users\\someone\\.android\\avd\\Moto_API_35.avd");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.category, "Virtualization");
    }

    #[test]
    fn classifies_unknown_as_review() {
        let c = classify_path("C:\\Users\\someone\\some_mystery_folder");
        assert_eq!(c.safety, SafetyLevel::Review);
    }

    #[test]
    fn classifies_program_files_as_do_not_delete() {
        let c = classify_path("C:\\Program Files\\SomeApp");
        assert_eq!(c.safety, SafetyLevel::DoNotDelete);
    }

    #[test]
    fn safety_rank_orders_caution_first() {
        assert!(SafetyLevel::DoNotDelete.rank() < SafetyLevel::Safe.rank());
    }

    #[test]
    fn build_report_aggregates_totals() {
        let mut result = ScanReport::new();
        result.path = "C:\\test".to_string();
        result.top_directories.push(DirEntry {
            path: "C:\\test\\node_modules".to_string(),
            name: "node_modules".to_string(),
            total_size: 1_000_000,
            file_count: 100,
            dir_count: 5,
        });
        result.top_directories.push(DirEntry {
            path: "C:\\test\\Documents".to_string(),
            name: "Documents".to_string(),
            total_size: 5_000_000,
            file_count: 50,
            dir_count: 2,
        });

        let report = build_report(&result, 50, 50);
        assert_eq!(report.total_assessed, 2);
        assert_eq!(report.safe_to_delete_bytes, 1_000_000);
        assert_eq!(report.keep_bytes, 5_000_000);
        assert_eq!(report.assessed_bytes(), 6_000_000);
    }

    #[test]
    fn classifies_browserclaw_as_review() {
        let c = classify_path("C:\\Users\\someone\\.browserclaw\\replays");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.origin, "BrowserClaw / BrowserOS (AI browser agent)");
    }

    #[test]
    fn classifies_kilo_local_share_as_review() {
        let c = classify_path("C:\\Users\\someone\\.local\\share\\kilo");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.origin, "Kilo Code (AI coding agent)");
    }

    #[test]
    fn classifies_updater_cache_as_safe() {
        let c = classify_path("C:\\Users\\someone\\AppData\\Local\\eigent-updater");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert_eq!(c.category, "Cache");
    }

    #[test]
    fn classifies_u2net_as_review() {
        let c = classify_path("C:\\Users\\someone\\.u2net");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.origin, "U2Net (AI segmentation model)");
    }

    #[test]
    fn classifies_user_profile_bin_as_review() {
        let c = classify_path("C:\\Users\\someone\\bin");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.origin, "User-installed binaries");
    }

    #[test]
    fn classifies_setup_guide_library_as_safe() {
        let c = classify_path("C:\\Users\\Aomega Imaging\\Setup Guide In-Editor Tutorial\\Library");
        eprintln!(
            "DEBUG setup guide: safety={:?}, origin={}, category={}",
            c.safety, c.origin, c.category
        );
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert_eq!(c.category, "Build Output");
    }
}
