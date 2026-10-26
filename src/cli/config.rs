//! Configuration file support for Space Analyzer Pro CLI.
//!
//! Reads defaults from a TOML config file so users can set persistent
//! preferences (default output format, top-N, thread count, etc.) without
//! re-typing flags on every invocation.
//!
//! Config file search order:
//!   1. `--config` flag (if provided)
//!   2. `<config_dir>/space-analyzer/config.toml` (platform config dir)
//!
//! CLI flags always override config file values.
//!
//! Example `config.toml`:
//!   format = "json"
//!   top = 50
//!   threads = 8
//!   no_animation = false
//!   include_hidden = false
//!   no_gpu = false

use serde::Deserialize;
use std::path::PathBuf;

/// Platform config directory + app name, e.g.
/// `C:\Users\<user>\AppData\Roaming\space-analyzer` on Windows,
/// `~/.config/space-analyzer` on Linux/macOS.
fn config_dir() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("space-analyzer"))
}

/// Default config file path: `<config_dir>/config.toml`.
pub fn default_config_path() -> Option<PathBuf> {
    config_dir().map(|d| d.join("config.toml"))
}

/// Resolve the config file path: `--config` flag wins, then default.
pub fn resolve_config_path(cli_config: Option<&str>) -> Option<PathBuf> {
    cli_config.map(PathBuf::from).or_else(default_config_path)
}

/// Parsed configuration file values. All fields are optional — absent fields
/// simply fall back to CLI flags or compile-time defaults.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct Config {
    #[serde(rename = "format")]
    pub output_format: Option<String>,
    pub top: Option<usize>,
    pub threads: Option<usize>,
    pub no_animation: Option<bool>,
    pub include_hidden: Option<bool>,
    pub no_gpu: Option<bool>,
}

/// Load config from a TOML file. Returns `None` if the file doesn't exist or
/// can't be parsed (caller falls back to CLI/defaults).
pub fn load_config(path: &std::path::Path) -> Option<Config> {
    let content = std::fs::read_to_string(path).ok()?;
    toml::from_str(&content).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_parses_all_fields() {
        let toml_str = r#"
format = "json"
top = 50
threads = 8
no_animation = true
include_hidden = false
no_gpu = true
"#;
        let config: Config = toml::from_str(toml_str).unwrap();
        assert_eq!(config.output_format.as_deref(), Some("json"));
        assert_eq!(config.top, Some(50));
        assert_eq!(config.threads, Some(8));
        assert_eq!(config.no_animation, Some(true));
        assert_eq!(config.include_hidden, Some(false));
        assert_eq!(config.no_gpu, Some(true));
    }

    #[test]
    fn config_partial_fields_are_optional() {
        let toml_str = "top = 10\n";
        let config: Config = toml::from_str(toml_str).unwrap();
        assert_eq!(config.top, Some(10));
        assert!(config.output_format.is_none());
        assert!(config.threads.is_none());
    }
}
