use super::*;

impl SpaceAnalyzerApp {
    pub fn refresh_system_info(&mut self) {
        self.disk_volumes = SystemMonitor::get_disk_volumes();
        self.system_resources = Some(SystemMonitor::get_system_resources());
        self.gpu_info = Some(SystemMonitor::detect_gpu());
    }

    pub fn export_results(&self) {
        if let Some(ref result) = self.scan_result {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("JSON", &["json"])
                .save_file()
            {
                if let Ok(json_content) = serde_json::to_string_pretty(result) {
                    let _ = std::fs::write(path, json_content);
                }
            }
        }
    }

    /// Update running model status based on system monitoring
    pub fn update_model_resource_usage(&mut self) {
        if !self.settings.ollama_enabled || !self.ollama_available {
            return;
        }

        // Throttle tasklist subprocess to once per ~60 frames (~1s at 60fps)
        if self.frame_counter % 60 != 0 {
            return;
        }

        // Check if any Ollama models are running via nvidia-smi or process list
        #[cfg(windows)]
        {
            // Check for ollama process
            if let Ok(output) = std::process::Command::new("tasklist")
                .args(["/FI", "IMAGENAME eq ollama.exe", "/NH", "/FO", "CSV"])
                .output() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                let is_running = output_str.contains("ollama.exe");
                
                for model in &mut self.discovered_models {
                    model.is_running = is_running;
                    if is_running {
                        // Estimate VRAM usage based on model size
                        if let Some(size_gb) = model.size.split_whitespace().next().and_then(|s| s.parse::<f32>().ok()) {
                            model.vram_usage_mb = Some((size_gb * 1024.0 * 0.8) as u64); // ~80% of model size in VRAM
                        }
                        model.cpu_usage_percent = Some(5.0); // Estimate
                    } else {
                        model.vram_usage_mb = None;
                        model.cpu_usage_percent = None;
                    }
                }
            }
        }
    }

    pub(crate) fn render_system(&mut self, ui: &mut egui::Ui) {
        ui.heading("System Monitor");
        ui.separator();

        if ui.button("Refresh").clicked() {
            self.refresh_system_info();
        }
        ui.separator();

        // CPU & Memory
        if let Some(ref resources) = self.system_resources {
            ui.label(format!("CPU Usage: {:.1}%", resources.cpu_percent));
            ui.add(egui::ProgressBar::new(resources.cpu_percent / 100.0).show_percentage());
            ui.label(format!("Memory: {} / {} ({:.1}%)",
                formatting::format_bytes(resources.memory_used_bytes),
                formatting::format_bytes(resources.memory_total_bytes),
                resources.memory_percent));
            ui.add(egui::ProgressBar::new(resources.memory_percent / 100.0).show_percentage());
            ui.separator();
        }

        // Disk volumes
        ui.heading("Disk Volumes");
        for volume in &self.disk_volumes {
            ui.label(format!("{} ({}) - {:.1}% used",
                volume.mount_point,
                formatting::format_bytes(volume.total_bytes),
                volume.usage_percent));
            ui.add(egui::ProgressBar::new(volume.usage_percent / 100.0).show_percentage());
        }
        ui.separator();

        // GPU
        if let Some(ref gpu) = self.gpu_info {
            ui.heading("GPU");
            if gpu.available {
                ui.label(egui::RichText::new(format!("{} (VRAM: {})", 
                    gpu.name.as_deref().unwrap_or("Unknown"),
                    gpu.vram_bytes.map(formatting::format_bytes).unwrap_or("Unknown".to_string())
                )).color(egui::Color32::GREEN));
            } else {
                ui.label(egui::RichText::new("No NVIDIA GPU detected. Using CPU fallback.").color(egui::Color32::YELLOW));
            }
        }
        
        // AI Model Resource Usage
        if self.settings.ollama_enabled && self.ollama_available {
            ui.separator();
            ui.heading("AI Model Resource Usage");
            
            let mut any_running = false;
            for model in &self.discovered_models {
                if model.is_running {
                    any_running = true;
                    ui.horizontal(|ui| {
                        ui.label(egui::RichText::new(&model.name).color(egui::Color32::YELLOW));
                        ui.small("(Running)");
                    });
                    
                    if let Some(vram) = model.vram_usage_mb {
                        ui.small(format!("VRAM Usage: {} MB", vram));
                        if let Some(gpu_vram) = self.gpu_info.as_ref().and_then(|g| g.vram_bytes) {
                            let vram_percent = (vram as f32 / gpu_vram as f32) * 100.0;
                            ui.add(egui::ProgressBar::new(vram_percent / 100.0).show_percentage());
                        }
                    }
                    
                    if let Some(cpu) = model.cpu_usage_percent {
                        ui.small(format!("CPU Usage: {:.1}%", cpu));
                    }
                    
                    if let Some(tokens) = model.performance_metrics.tokens_per_second {
                        ui.small(format!("Performance: ~{:.0} tokens/sec", tokens));
                    }
                }
            }
            
            if !any_running {
                ui.small("No AI models currently running");
            }
            
            // Total AI resource impact
            let total_vram: u64 = self.discovered_models.iter()
                .filter(|m| m.is_running)
                .filter_map(|m| m.vram_usage_mb)
                .sum();
            let total_cpu: f32 = self.discovered_models.iter()
                .filter(|m| m.is_running)
                .filter_map(|m| m.cpu_usage_percent)
                .sum();
            
            if total_vram > 0 || total_cpu > 0.0 {
                ui.separator();
                ui.small("Total AI Impact:");
                if total_vram > 0 {
                    ui.small(format!("VRAM: {} MB", total_vram));
                }
                if total_cpu > 0.0 {
                    ui.small(format!("CPU: {:.1}%", total_cpu));
                }
            }
        }
    }
}
