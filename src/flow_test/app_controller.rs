//! Application controller for launching and managing Space Analyzer Pro

use std::path::PathBuf;
use std::process::{Child, Command};
use std::time::Duration;

/// Controller for managing the Space Analyzer Pro application
pub struct AppController {
    app_path: PathBuf,
    child_process: Option<Child>,
    is_running: bool,
}

impl AppController {
    pub fn new(app_path: PathBuf) -> Self {
        Self {
            app_path,
            child_process: None,
            is_running: false,
        }
    }

    /// Launch the application in the background
    pub fn launch(&mut self) -> Result<(), String> {
        if self.is_running {
            return Err("Application is already running".to_string());
        }

        println!("[APP CONTROLLER] Launching: {}", self.app_path.display());
        
        let child = Command::new(&self.app_path)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to launch application: {}", e))?;
        
        self.child_process = Some(child);
        self.is_running = true;
        
        println!("[APP CONTROLLER] Application launched successfully");
        Ok(())
    }

    /// Check if the application is still running
    pub fn is_running(&self) -> bool {
        if let Some(child) = &self.child_process {
            // Try to check if process is still alive
            // This is a simplified check - in production you'd use platform-specific APIs
            child.id() > 0
        } else {
            false
        }
    }

    /// Gracefully shutdown the application
    pub fn shutdown(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.child_process.take() {
            println!("[APP CONTROLLER] Shutting down application...");
            
            // Kill the process
            child.kill().map_err(|e| format!("Failed to kill process: {}", e))?;
            child.wait().map_err(|e| format!("Failed to wait for process: {}", e))?;
            self.is_running = false;
            
            println!("[APP CONTROLLER] Application shut down");
        }
        
        Ok(())
    }

    /// Wait for the application to be ready (simplified check)
    pub fn wait_for_ready(&self, timeout: Duration) -> Result<(), String> {
        let start = std::time::Instant::now();
        
        while start.elapsed() < timeout {
            // In a real implementation, we'd check for specific readiness signals
            // For now, we'll just wait a bit
            std::thread::sleep(Duration::from_millis(500));
            
            // Check if process is still running
            if !self.is_running() {
                return Err("Application exited before becoming ready".to_string());
            }
        }
        
        Ok(())
    }

    /// Get the process ID
    pub fn pid(&self) -> Option<u32> {
        self.child_process.as_ref().map(|c| c.id())
    }
}

impl Drop for AppController {
    fn drop(&mut self) {
        if self.is_running {
            let _ = self.shutdown();
        }
    }
}
