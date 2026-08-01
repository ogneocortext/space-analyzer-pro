//! Image thumbnail generation and caching for Space Analyzer Pro
//!
//! Loads images as thumbnails for display in scan results and history views.
//! Supports PNG, JPEG, GIF, and WebP formats.

use std::path::Path;
use std::sync::{Arc, Mutex};

/// Image thumbnail cache entry
#[derive(Debug, Clone)]
pub struct ThumbnailEntry {
    pub path: String,
    pub data: Arc<egui::ColorImage>,
    pub width: usize,
    pub height: usize,
}

/// Thumbnail cache manager
#[derive(Clone)]
pub struct ThumbnailCache {
    entries: Arc<Mutex<std::collections::HashMap<String, ThumbnailEntry>>>,
    max_entries: usize,
    thumbnail_size: usize,
}

impl Default for ThumbnailCache {
    fn default() -> Self {
        Self {
            entries: Arc::new(Mutex::new(std::collections::HashMap::new())),
            max_entries: 100,
            thumbnail_size: 128,
        }
    }
}

impl ThumbnailCache {
    pub fn new(max_entries: usize, thumbnail_size: usize) -> Self {
        Self {
            entries: Arc::new(Mutex::new(std::collections::HashMap::new())),
            max_entries,
            thumbnail_size,
        }
    }

    /// Check if a file extension is an image type
    pub fn is_image_extension(ext: &str) -> bool {
        matches!(
            ext.to_lowercase().as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "ico"
        )
    }

    /// Load and create thumbnail for an image file
    pub fn load_thumbnail(&self, file_path: &str) -> Option<ThumbnailEntry> {
        let path = Path::new(file_path);

        // Check if it's an image
        let ext = path.extension()?.to_str()?.to_lowercase();
        if !Self::is_image_extension(&ext) {
            return None;
        }

        // Check cache
        {
            let cache = self.entries.lock().ok()?;
            if let Some(entry) = cache.get(file_path) {
                return Some(entry.clone());
            }
        }

        // Load image
        let img_bytes = std::fs::read(file_path).ok()?;
        let dyn_img = image::load_from_memory(&img_bytes).ok()?;

        // Resize to thumbnail size while maintaining aspect ratio
        let thumbnail = dyn_img.thumbnail(self.thumbnail_size as u32, self.thumbnail_size as u32);

        // Convert to rgba8 and then to egui ColorImage
        let rgba_img = thumbnail.to_rgba8();
        let (width, height) = (rgba_img.width() as usize, rgba_img.height() as usize);
        let color_image = egui::ColorImage::from_rgba_premultiplied(
            [width, height],
            rgba_img.as_flat_samples().as_slice(),
        );

        let entry = ThumbnailEntry {
            path: file_path.to_string(),
            data: Arc::new(color_image),
            width,
            height,
        };

        // Cache the entry
        {
            let mut cache = self.entries.lock().ok()?;
            if cache.len() >= self.max_entries {
                // Remove oldest entry
                if let Some(key) = cache.keys().next().cloned() {
                    cache.remove(&key);
                }
            }
            cache.insert(file_path.to_string(), entry.clone());
        }

        Some(entry)
    }

    /// Get thumbnail from cache without loading
    pub fn get_cached(&self, file_path: &str) -> Option<ThumbnailEntry> {
        self.entries.lock().ok()?.get(file_path).cloned()
    }

    /// Clear the cache
    pub fn clear(&self) {
        if let Ok(mut cache) = self.entries.lock() {
            cache.clear();
        }
    }
}

/// Extract image paths from scan results for thumbnail loading
pub fn find_image_files(result: &super::gui_common::ScanResult) -> Vec<(String, u64, String)> {
    let mut images = Vec::new();
    for file in &result.largest_files {
        let path = &file.path;
        let size = file.size;
        let ext = std::path::Path::new(path)
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();
        if ThumbnailCache::is_image_extension(&ext) {
            images.push((path.clone(), size, ext));
        }
    }
    images
}

/// Get most common image extensions from file types
pub fn get_image_extensions(
    types: &std::collections::HashMap<String, usize>,
) -> Vec<(String, usize)> {
    let mut images: Vec<_> = types
        .iter()
        .filter(|(ext, _)| ThumbnailCache::is_image_extension(ext))
        .map(|(ext, count)| (ext.clone(), *count))
        .collect();
    images.sort_by_key(|b| std::cmp::Reverse(b.1));
    images
}
