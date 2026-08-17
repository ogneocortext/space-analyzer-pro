use serde::Serialize;

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
    /// Human-readable companion for `total_wasted_bytes`, so a `--format json`
    /// consumer gets a readable size without re-implementing byte formatting.
    pub total_wasted_human: String,
}
