//! Ollama process management functions
//!
//! This module contains functions for checking Ollama availability,
//! finding the Ollama executable, and starting the Ollama process.

use super::super::OllamaMessage;
use std::process::{Command, Stdio};
use std::sync::mpsc;

use super::super::SpaceAnalyzerApp;

impl SpaceAnalyzerApp {
    /// Probe Ollama for availability + server version.
    ///
    /// Builds a fresh client from the current settings URL/model (rather than
    /// reusing `self.ollama_client`, which may be stale after an URL change)
    /// and queries both `/api/version` and the bare TCP connection. The
    /// outcome is reported via `OllamaMessage::AvailabilityDetailed` so the
    /// UI can show the version and any error message — the old `Availability`
    /// variant only carried a `bool` and silently dropped both pieces of
    /// information.
    pub(crate) fn check_ollama(&mut self) {
        if self.ollama_receiver.is_some() {
            return;
        }
        self.ollama_checking = true;
        let client = match super::super::ollama::OllamaClient::new(
            &self.settings.ollama_url,
            &self.settings.ollama_model,
        ) {
            Ok(c) => c,
            Err(e) => {
                self.ollama_checking = false;
                let msg = format!("Ollama config error: {}", e);
                self.last_ollama_error = Some(msg.clone());
                self.status_message = Some(msg);
                return;
            }
        };

        // Keep `self.ollama_client` in sync with the URL the user just typed,
        // even if the probe hasn't completed yet.
        self.ollama_client = Some(client.clone());

        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let rt = super::super::shared_runtime();
            // First probe: is the server up at all?
            let available = rt.block_on(async { client.is_available().await });
            // Second probe (only if reachable): what version is it? Older
            // servers don't expose /api/version, so a 404 is not a failure
            // of the overall check.
            let (version, error) = if available {
                match rt.block_on(async { client.get_version().await }) {
                    Ok(v) => (Some(v), None),
                    Err(e) => (
                        None,
                        Some(format!("Server reachable but /api/version failed: {}", e)),
                    ),
                }
            } else {
                (None, None)
            };
            let _ = tx.send(OllamaMessage::AvailabilityDetailed {
                available,
                version,
                error,
            });
        });
        self.ollama_receiver = Some(rx);
    }

    /// Try to find the Ollama executable on the system
    pub(crate) fn find_ollama_exe() -> Option<std::path::PathBuf> {
        let candidates = [
            // Common Windows install paths
            format!(
                "{}\\Programs\\Ollama\\ollama.exe",
                std::env::var("LOCALAPPDATA").unwrap_or_default()
            ),
            format!(
                "{}\\Ollama\\ollama.exe",
                std::env::var("PROGRAMFILES").unwrap_or_default()
            ),
            format!(
                "{}\\Ollama\\ollama.exe",
                std::env::var("PROGRAMFILES(X86)").unwrap_or_default()
            ),
        ];
        for path in &candidates {
            let p = std::path::PathBuf::from(path);
            if p.exists() {
                return Some(p);
            }
        }
        // Fallback: try PATH lookup
        if let Ok(output) = Command::new("where").arg("ollama.exe").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    let p = std::path::PathBuf::from(path.lines().next().unwrap_or("").trim());
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }
        None
    }

    /// Spawn the Ollama background process
    pub(crate) fn start_ollama_process(&mut self) {
        if let Some(exe) = Self::find_ollama_exe() {
            match Command::new(&exe)
                .arg("serve")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .stdin(Stdio::null())
                .spawn()
            {
                Ok(child) => {
                    // Detach - do not store the handle, let it run independently
                    std::mem::drop(child);
                    self.status_message = Some(format!("Started Ollama from {}", exe.display()));
                }
                Err(e) => {
                    eprintln!("Warning: failed to start Ollama: {}", e);
                    self.status_message = Some(format!("Failed to start Ollama: {}", e));
                }
            }
        } else {
            self.status_message = Some(
                "Ollama executable not found. Install it from https://ollama.com/download"
                    .to_string(),
            );
        }
    }
}
