use serde::Serialize;

/// Deletion safety verdict.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum SafetyLevel {
    Safe,
    Review,
    Caution,
    DoNotDelete,
}

impl SafetyLevel {
    pub fn label(self) -> &'static str {
        match self {
            SafetyLevel::Safe => "SAFE TO DELETE",
            SafetyLevel::Review => "REVIEW FIRST",
            SafetyLevel::Caution => "KEEP (LIKELY NEEDED)",
            SafetyLevel::DoNotDelete => "DO NOT DELETE",
        }
    }

    pub fn emoji(self) -> &'static str {
        match self {
            SafetyLevel::Safe => "🟢",
            SafetyLevel::Review => "🟡",
            SafetyLevel::Caution => "🟠",
            SafetyLevel::DoNotDelete => "🔴",
        }
    }

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
    pub path: String,
    pub name: String,
    pub size: u64,
    pub file_count: u64,
    pub is_directory: bool,
    pub origin: String,
    pub category: String,
    pub safety: SafetyLevel,
    pub recoverable: bool,
    pub app_installed: Option<bool>,
    pub related_paths: Vec<String>,
    pub reasoning: String,
}

/// Aggregated origin-tracing report for a full scan.
#[derive(Debug, Clone, Serialize)]
pub struct OriginReport {
    pub scan_path: String,
    pub total_assessed: usize,
    pub safe_to_delete_bytes: u64,
    pub review_bytes: u64,
    pub caution_bytes: u64,
    pub keep_bytes: u64,
    pub assessments: Vec<OriginAssessment>,
}

impl OriginReport {
    pub fn assessed_bytes(&self) -> u64 {
        self.safe_to_delete_bytes
            .saturating_add(self.review_bytes)
            .saturating_add(self.caution_bytes)
            .saturating_add(self.keep_bytes)
    }
}

/// Internal classification result used by [`classify_path`].
pub struct Classification {
    pub origin: &'static str,
    pub category: &'static str,
    pub safety: SafetyLevel,
    pub recoverable: bool,
    pub apps: &'static [&'static str],
    pub reasoning: String,
}

/// Case-insensitive path context shared across classifier helpers.
pub struct Ctx<'a> {
    pub p: &'a str,
    pub p_norm: &'a str,
    pub basename: &'a str,
}
