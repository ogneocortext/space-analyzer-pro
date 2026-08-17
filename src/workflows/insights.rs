//! AI-powered storage insights.
//!
//! This module contains the `StorageInsights` struct with methods
//! for generating recommendations based on scan results.

use super::models::{AIRecommendation, StorageInsights};
use super::types::*;
use scan_engine::format_bytes;

impl StorageInsights {
    /// Generate AI recommendations based on scan results
    pub fn generate_recommendations(
        scan_result: &crate::gui_common::ScanReport,
    ) -> Vec<AIRecommendation> {
        let mut recommendations = Vec::new();

        // Check for large number of small files (potential fragmentation)
        if scan_result.total_files > 10000 {
            recommendations.push(AIRecommendation {
                priority: RecommendationPriority::Medium,
                category: RecommendationCategory::Performance,
                title: "High File Count Detected".to_string(),
                description: format!(
                    "Found {} files. Consider consolidating small files or cleaning up cache directories.",
                    scan_result.total_files
                ),
                action: RecommendationAction::Optimize,
            });
        }

        // Check for dominance of specific file types
        if let Some((ext, count)) = scan_result.file_types.iter().max_by_key(|(_, &c)| c) {
            if scan_result.total_files == 0 {
                return recommendations;
            }
            let percentage = (*count as f64 / scan_result.total_files as f64) * 100.0;
            if percentage > 30.0 {
                recommendations.push(AIRecommendation {
                    priority: RecommendationPriority::High,
                    category: RecommendationCategory::Storage,
                    title: format!("{} File Dominance", ext.to_uppercase()),
                    description: format!(
                        "{:.1}% of files are .{} files. Consider archiving or reviewing if appropriate.",
                        percentage, ext
                    ),
                    action: RecommendationAction::Review,
                });
            }
        }

        // Size-based recommendations
        let avg_file_size = if scan_result.total_files > 0 {
            scan_result.total_size_bytes as f64 / scan_result.total_files as f64
        } else {
            0.0
        };

        if avg_file_size < 1024.0 && scan_result.total_files > 1000 {
            recommendations.push(AIRecommendation {
                priority: RecommendationPriority::Low,
                category: RecommendationCategory::Storage,
                title: "Many Small Files".to_string(),
                description: format!(
                    "Average file size is only {:.0} bytes. This may indicate cache files or logs that could be cleaned.",
                    avg_file_size
                ),
                action: RecommendationAction::Cleanup,
            });
        }

        // Check for large files
        if let Some(file) = scan_result.largest_files.first() {
            let path = &file.path;
            let size = file.size;
            if size > 100 * 1024 * 1024 {
                recommendations.push(AIRecommendation {
                    priority: RecommendationPriority::High,
                    category: RecommendationCategory::Storage,
                    title: "Very Large File Found".to_string(),
                    description: format!(
                        "File '{}' is {} in size. Consider moving to external storage or archiving.",
                        path, format_bytes(size)
                    ),
                    action: RecommendationAction::Archive,
                });
            }
        }

        recommendations
    }
}
