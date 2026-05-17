//! Cross-Platform Archive Manager Library
//! 
//! Comprehensive archive management with multiple format support, cloud integration,
//! and intelligent compression for Space Analyzer Pro.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{Result, Context};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::{debug, info, warn, error};

/// Archive format types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ArchiveFormat {
    Zip,
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    TarLz4,
    TarZstd,
    SevenZip,
}

impl ArchiveFormat {
    pub fn extension(&self) -> &'static str {
        match self {
            ArchiveFormat::Zip => ".zip",
            ArchiveFormat::Tar => ".tar",
            ArchiveFormat::TarGz => ".tar.gz",
            ArchiveFormat::TarBz2 => ".tar.bz2",
            ArchiveFormat::TarXz => ".tar.xz",
            ArchiveFormat::TarLz4 => ".tar.lz4",
            ArchiveFormat::TarZstd => ".tar.zst",
            ArchiveFormat::SevenZip => ".7z",
        }
    }

    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext.to_lowercase().as_str() {
            ".zip" => Some(ArchiveFormat::Zip),
            ".tar" => Some(ArchiveFormat::Tar),
            ".tar.gz" | ".tgz" => Some(ArchiveFormat::TarGz),
            ".tar.bz2" | ".tbz2" => Some(ArchiveFormat::TarBz2),
            ".tar.xz" | ".txz" => Some(ArchiveFormat::TarXz),
            ".tar.lz4" | ".tlz4" => Some(ArchiveFormat::TarLz4),
            ".tar.zst" | ".tzst" => Some(ArchiveFormat::TarZstd),
            ".7z" => Some(ArchiveFormat::SevenZip),
            _ => None,
        }
    }
}

/// Compression levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CompressionLevel {
    None,
    Fast,
    Default,
    Maximum,
    Ultra,
}

impl CompressionLevel {
    pub fn as_u32(&self) -> u32 {
        match self {
            CompressionLevel::None => 0,
            CompressionLevel::Fast => 1,
            CompressionLevel::Default => 6,
            CompressionLevel::Maximum => 9,
            CompressionLevel::Ultra => 12,
        }
    }
}

/// Archive configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveConfig {
    pub format: ArchiveFormat,
    pub compression_level: CompressionLevel,
    pub include_hidden: bool,
    pub follow_symlinks: bool,
    pub preserve_permissions: bool,
    pub preserve_timestamps: bool,
    pub chunk_size: usize,
    pub parallel_compression: bool,
    pub exclude_patterns: Vec<String>,
    pub include_patterns: Vec<String>,
}

impl Default for ArchiveConfig {
    fn default() -> Self {
        Self {
            format: ArchiveFormat::TarGz,
            compression_level: CompressionLevel::Default,
            include_hidden: false,
            follow_symlinks: false,
            preserve_permissions: true,
            preserve_timestamps: true,
            chunk_size: 8192,
            parallel_compression: true,
            exclude_patterns: vec![
                "*.tmp".to_string(),
                "*.log".to_string(),
                "*.cache".to_string(),
                "node_modules".to_string(),
                ".git".to_string(),
                "__pycache__".to_string(),
            ],
            include_patterns: vec![],
        }
    }
}

/// File information for archiving
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveFileInfo {
    pub path: PathBuf,
    pub size: u64,
    pub modified: DateTime<Utc>,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub compression_ratio: Option<f64>,
}

/// Archive operation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveResult {
    pub archive_path: PathBuf,
    pub format: ArchiveFormat,
    pub original_size: u64,
    pub compressed_size: u64,
    pub compression_ratio: f64,
    pub files_processed: usize,
    pub directories_processed: usize,
    pub errors: Vec<String>,
    pub duration: std::time::Duration,
}

/// Cloud storage configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudConfig {
    pub provider: CloudProvider,
    pub bucket_name: String,
    pub region: Option<String>,
    pub access_key: String,
    pub secret_key: String,
    pub endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CloudProvider {
    AwsS3,
    AzureBlob,
    GoogleCloud,
}

/// Main archive manager
pub struct ArchiveManager {
    config: ArchiveConfig,
    cloud_config: Option<CloudConfig>,
}

impl ArchiveManager {
    pub fn new(config: ArchiveConfig) -> Self {
        Self {
            config,
            cloud_config: None,
        }
    }

    pub fn with_cloud_config(mut self, cloud_config: CloudConfig) -> Self {
        self.cloud_config = Some(cloud_config);
        self
    }

    /// Create archive from directory or file
    pub async fn create_archive<P: AsRef<Path>, Q: AsRef<Path>>(
        &self,
        source: P,
        output: Q,
    ) -> Result<ArchiveResult> {
        let source = source.as_ref();
        let output = output.as_ref();
        
        info!("Creating archive: {} -> {}", source.display(), output.display());
        
        let start_time = std::time::Instant::now();
        let mut result = ArchiveResult {
            archive_path: output.to_path_buf(),
            format: self.config.format.clone(),
            original_size: 0,
            compressed_size: 0,
            compression_ratio: 0.0,
            files_processed: 0,
            directories_processed: 0,
            errors: Vec::new(),
            duration: std::time::Duration::default(),
        };

        // Collect files to archive
        let files = self.collect_files(source)?;
        
        // Calculate original size
        result.original_size = files.iter()
            .filter(|f| !f.is_directory)
            .map(|f| f.size)
            .sum();
        
        result.files_processed = files.iter()
            .filter(|f| !f.is_directory)
            .count();
        
        result.directories_processed = files.iter()
            .filter(|f| f.is_directory)
            .count();

        // Create archive based on format
        match self.config.format {
            ArchiveFormat::Zip => {
                self.create_zip_archive(&files, output, &mut result).await?;
            }
            ArchiveFormat::Tar => {
                self.create_tar_archive(&files, output, &mut result, false).await?;
            }
            ArchiveFormat::TarGz => {
                self.create_tar_archive(&files, output, &mut result, true).await?;
            }
            ArchiveFormat::TarBz2 => {
                self.create_tar_bz2_archive(&files, output, &mut result).await?;
            }
            ArchiveFormat::TarXz => {
                self.create_tar_xz_archive(&files, output, &mut result).await?;
            }
            ArchiveFormat::TarLz4 => {
                self.create_tar_lz4_archive(&files, output, &mut result).await?;
            }
            ArchiveFormat::TarZstd => {
                self.create_tar_zstd_archive(&files, output, &mut result).await?;
            }
            ArchiveFormat::SevenZip => {
                self.create_7z_archive(&files, output, &mut result).await?;
            }
        }

        // Get compressed size
        result.compressed_size = fs::metadata(output)?.len();
        result.compression_ratio = if result.original_size > 0 {
            result.compressed_size as f64 / result.original_size as f64
        } else {
            1.0
        };

        result.duration = start_time.elapsed();

        info!("Archive created successfully: {} ({} -> {}, {:.1}% compression)",
            output.display(),
            self.format_bytes(result.original_size),
            self.format_bytes(result.compressed_size),
            (1.0 - result.compression_ratio) * 100.0
        );

        Ok(result)
    }

    /// Extract archive
    pub async fn extract_archive<P: AsRef<Path>, Q: AsRef<Path>>(
        &self,
        archive: P,
        output: Q,
    ) -> Result<ArchiveResult> {
        let archive = archive.as_ref();
        let output = output.as_ref();
        
        info!("Extracting archive: {} -> {}", archive.display(), output.display());
        
        let start_time = std::time::Instant::now();
        
        // Create output directory
        fs::create_dir_all(output)?;

        // Determine format from file extension
        let format = self.detect_archive_format(archive)?;
        
        let mut result = ArchiveResult {
            archive_path: archive.to_path_buf(),
            format,
            original_size: 0,
            compressed_size: fs::metadata(archive)?.len(),
            compression_ratio: 0.0,
            files_processed: 0,
            directories_processed: 0,
            errors: Vec::new(),
            duration: std::time::Duration::default(),
        };

        // Extract based on format
        match result.format {
            ArchiveFormat::Zip => {
                self.extract_zip_archive(archive, output, &mut result).await?;
            }
            ArchiveFormat::Tar => {
                self.extract_tar_archive(archive, output, &mut result, false).await?;
            }
            ArchiveFormat::TarGz => {
                self.extract_tar_archive(archive, output, &mut result, true).await?;
            }
            _ => {
                return Err(anyhow::anyhow!("Extraction not yet implemented for {:?}", result.format));
            }
        }

        result.duration = start_time.elapsed();

        info!("Archive extracted successfully: {} files processed", result.files_processed);
        Ok(result)
    }

    /// Upload archive to cloud storage
    pub async fn upload_to_cloud<P: AsRef<Path>>(&self, archive_path: P) -> Result<String> {
        let cloud_config = self.cloud_config.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Cloud configuration not set"))?;

        let archive_path = archive_path.as_ref();
        let file_name = archive_path.file_name()
            .ok_or_else(|| anyhow::anyhow!("Invalid archive path"))?
            .to_string_lossy();

        info!("Uploading {} to cloud storage", archive_path.display());

        match cloud_config.provider {
            CloudProvider::AwsS3 => {
                self.upload_to_s3(archive_path, &file_name, cloud_config).await
            }
            CloudProvider::AzureBlob => {
                self.upload_to_azure(archive_path, &file_name, cloud_config).await
            }
            CloudProvider::GoogleCloud => {
                self.upload_to_gcs(archive_path, &file_name, cloud_config).await
            }
        }
    }

    /// Collect files for archiving
    fn collect_files(&self, source: &Path) -> Result<Vec<ArchiveFileInfo>> {
        let mut files = Vec::new();
        
        if source.is_file() {
            // Single file
            let metadata = fs::metadata(source)?;
            let modified = metadata.modified()
                .map(|t| DateTime::from(t))
                .unwrap_or_else(|_| Utc::now());

            files.push(ArchiveFileInfo {
                path: source.to_path_buf(),
                size: metadata.len(),
                modified,
                is_directory: false,
                is_symlink: metadata.file_type().is_symlink(),
                compression_ratio: None,
            });
        } else {
            // Directory - walk recursively
            for entry in walkdir::WalkDir::new(source)
                .follow_links(self.config.follow_symlinks)
                .into_iter()
            {
                let entry = entry?;
                let path = entry.path();

                // Skip if should not process
                if !self.should_process_file(path) {
                    continue;
                }

                let metadata = match fs::metadata(path) {
                    Ok(meta) => meta,
                    Err(e) => {
                        warn!("Failed to read metadata for {}: {}", path.display(), e);
                        continue;
                    }
                };

                let modified = metadata.modified()
                    .map(|t| DateTime::from(t))
                    .unwrap_or_else(|_| Utc::now());

                files.push(ArchiveFileInfo {
                    path: path.to_path_buf(),
                    size: metadata.len(),
                    modified,
                    is_directory: metadata.is_dir(),
                    is_symlink: metadata.file_type().is_symlink(),
                    compression_ratio: None,
                });
            }
        }

        Ok(files)
    }

    /// Check if file should be included in archive
    fn should_process_file(&self, path: &Path) -> bool {
        let path_str = path.to_string_lossy();

        // Skip hidden files unless included
        if !self.config.include_hidden {
            if let Some(name) = path.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    return false;
                }
            }
        }

        // Check exclude patterns
        for pattern in &self.config.exclude_patterns {
            if path_str.contains(pattern) {
                return false;
            }
        }

        // Check include patterns (if any specified)
        if !self.config.include_patterns.is_empty() {
            for pattern in &self.config.include_patterns {
                if path_str.contains(pattern) {
                    return true;
                }
            }
            return false;
        }

        true
    }

    /// Detect archive format from file extension
    fn detect_archive_format(&self, path: &Path) -> Result<ArchiveFormat> {
        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .ok_or_else(|| anyhow::anyhow!("No file extension found"))?;

        let full_ext = if extension == "tar" {
            // Check for compound extensions like .tar.gz
            let file_name = path.file_name()
                .and_then(|name| name.to_str())
                .ok_or_else(|| anyhow::anyhow!("Invalid filename"))?;
            
            if let Some(pos) = file_name.rfind(".tar.") {
                &file_name[pos..]
            } else {
                extension
            }
        } else {
            extension
        };

        ArchiveFormat::from_extension(&format!(".{}", full_ext))
            .ok_or_else(|| anyhow::anyhow!("Unsupported archive format: {}", full_ext))
    }

    /// Create ZIP archive
    async fn create_zip_archive(
        &self,
        files: &[ArchiveFileInfo],
        output: &Path,
        result: &mut ArchiveResult,
    ) -> Result<()> {
        use zip::{ZipWriter, write::FileOptions};
        
        let file = File::create(output)?;
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .compression_level(Some(self.config.compression_level.as_u32() as i32));

        for file_info in files {
            if file_info.is_directory {
                zip.add_directory(
                    file_info.path.to_string_lossy(),
                    options,
                )?;
            } else if !file_info.is_symlink {
                let mut file = File::open(&file_info.path)?;
                zip.start_file(
                    file_info.path.to_string_lossy(),
                    options,
                )?;
                io::copy(&mut file, &mut zip)?;
            }
        }

        zip.finish()?;
        Ok(())
    }

    /// Create TAR archive
    async fn create_tar_archive(
        &self,
        files: &[ArchiveFileInfo],
        output: &Path,
        compress: bool,
    ) -> Result<()> {
        use tar::Builder;
        
        if compress {
            use flate2::write::GzEncoder;
            use flate2::Compression;
            
            let file = File::create(output)?;
            let encoder = GzEncoder::new(file, Compression::new(self.config.compression_level.as_u32() as u32));
            let mut tar = Builder::new(encoder);

            for file_info in files {
                if !file_info.is_symlink {
                    tar.append_path_with_name(&file_info.path, &file_info.path)?;
                }
            }

            tar.finish()?;
        } else {
            let file = File::create(output)?;
            let mut tar = Builder::new(file);

            for file_info in files {
                if !file_info.is_symlink {
                    tar.append_path_with_name(&file_info.path, &file_info.path)?;
                }
            }

            tar.finish()?;
        }

        Ok(())
    }

    /// Create TAR.BZ2 archive
    async fn create_tar_bz2_archive(
        &self,
        files: &[ArchiveFileInfo],
        output: &Path,
        result: &mut ArchiveResult,
    ) -> Result<()> {
        use tar::Builder;
        use bzip2::write::BzEncoder;
        use bzip2::Compression as BzCompression;
        
        let file = File::create(output)?;
        let encoder = BzEncoder::new(file, BzCompression::new(self.config.compression_level.as_u32() as u32));
        let mut tar = Builder::new(encoder);

        for file_info in files {
            if !file_info.is_symlink {
                tar.append_path_with_name(&file_info.path, &file_info.path)?;
            }
        }

        tar.finish()?;
        Ok(())
    }

    /// Create TAR.XZ archive
    async fn create_tar_xz_archive(
        &self,
        files: &[ArchiveFileInfo],
        output: &Path,
        result: &mut ArchiveResult,
    ) -> Result<()> {
        use tar::Builder;
        use xz2::write::XzEncoder;
        use xz2::stream::{MtStreamBuilder, Check};
        
        let file = File::create(output)?;
        let stream = MtStreamBuilder::new()
            .threads(num_cpus::get())
            .check(Check::Crc64)
            .preset(self.config.compression_level.as_u32() as u32)
            .create()?;
        let encoder = XzEncoder::new_stream(file, stream);
        let mut tar = Builder::new(encoder);

        for file_info in files {
            if !file_info.is_symlink {
                tar.append_path_with_name(&file_info.path, &file_info.path)?;
            }
        }

        tar.finish()?;
        Ok(())
    }

    /// Create TAR.LZ4 archive
    async fn create_tar_lz4_archive(
        &self,
        files: &[ArchiveFileInfo],
        output: &Path,
        result: &mut ArchiveResult,
    ) -> Result<()> {
        use tar::Builder;
        use lz4::EncoderBuilder;
        
        let file = File::create(output)?;
        let encoder = EncoderBuilder::new()
            .level(self.config.compression_level.as_u32() as u32)
            .build(file)?;
        let mut tar = Builder::new(encoder);

        for file_info in files {
            if !file_info.is_symlink {
                tar.append_path_with_name(&file_info.path, &file_info.path)?;
            }
        }

        tar.finish()?;
        Ok(())
    }

    /// Create TAR.ZSTD archive
    async fn create_tar_zstd_archive(
        &self,
        files: &[ArchiveFileInfo],
        output: &Path,
        result: &mut ArchiveResult,
    ) -> Result<()> {
        use tar::Builder;
        use zstd::stream::write::Encoder;
        
        let file = File::create(output)?;
        let encoder = Encoder::new(file, self.config.compression_level.as_u32())?;
        let mut tar = Builder::new(encoder);

        for file_info in files {
            if !file_info.is_symlink {
                tar.append_path_with_name(&file_info.path, &file_info.path)?;
            }
        }

        tar.finish()?;
        Ok(())
    }

    /// Create 7Z archive
    async fn create_7z_archive(
        &self,
        files: &[ArchiveFileInfo],
        output: &Path,
        result: &mut ArchiveResult,
    ) -> Result<()> {
        // Note: This is a simplified implementation
        // In practice, you'd want to use a more robust 7z library
        warn!("7Z archive creation is not fully implemented yet");
        
        // Fallback to ZIP for now
        self.create_zip_archive(files, output, result).await
    }

    /// Extract ZIP archive
    async fn extract_zip_archive(
        &self,
        archive: &Path,
        output: &Path,
        result: &mut ArchiveResult,
    ) -> Result<()> {
        use zip::ZipArchive;
        
        let file = File::open(archive)?;
        let mut archive = ZipArchive::new(file)?;
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let output_path = output.join(file.mangled_name());
            
            if file.name().ends_with('/') {
                fs::create_dir_all(&output_path)?;
                result.directories_processed += 1;
            } else {
                if let Some(parent) = output_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                
                let mut output_file = File::create(&output_path)?;
                io::copy(&mut file, &mut output_file)?;
                result.files_processed += 1;
            }
        }

        Ok(())
    }

    /// Extract TAR archive
    async fn extract_tar_archive(
        &self,
        archive: &Path,
        output: &Path,
        compress: bool,
    ) -> Result<()> {
        use tar::Archive;
        
        if compress {
            use flate2::read::GzDecoder;
            let file = File::open(archive)?;
            let decoder = GzDecoder::new(file);
            let mut archive = Archive::new(decoder);
            archive.unpack(output)?;
        } else {
            let file = File::open(archive)?;
            let mut archive = Archive::new(file);
            archive.unpack(output)?;
        }

        Ok(())
    }

    /// Upload to AWS S3
    async fn upload_to_s3(
        &self,
        archive_path: &Path,
        file_name: &str,
        cloud_config: &CloudConfig,
    ) -> Result<String> {
        use aws_config::BehaviorVersion;
        use aws_sdk_s3::{Client, Config, primitives::ByteStream};
        
        let config = aws_config::defaults(BehaviorVersion::latest())
            .region(aws_config::Region::new(cloud_config.region.clone().unwrap_or_default()))
            .load();
        
        let client = Client::new(&config);
        
        let body = ByteStream::from_path(archive_path).await?;
        
        let resp = client
            .put_object()
            .bucket(&cloud_config.bucket_name)
            .key(file_name)
            .body(body)
            .send()
            .await?;

        let url = format!("https://{}.s3.{}.amazonaws.com/{}",
            cloud_config.bucket_name,
            cloud_config.region.as_ref().unwrap_or(&"us-east-1".to_string()),
            file_name
        );

        info!("Successfully uploaded to S3: {}", url);
        Ok(url)
    }

    /// Upload to Azure Blob Storage
    async fn upload_to_azure(
        &self,
        archive_path: &Path,
        file_name: &str,
        cloud_config: &CloudConfig,
    ) -> Result<String> {
        use azure_storage_blobs::prelude::*;
        use azure_storage::core::prelude::*;
        
        let storage_account = cloud_config.access_key.clone();
        let access_key = cloud_config.secret_key.clone();
        
        let container_client = ContainerClient::new(
            storage_account,
            cloud_config.bucket_name.clone(),
            new_access_key(&access_key),
        );
        
        let blob_client = container_client.blob_client(file_name);
        
        let file = File::open(archive_path)?;
        blob_client.put_blob(file).await?;
        
        let url = format!("https://{}.blob.core.windows.net/{}/{}",
            storage_account,
            cloud_config.bucket_name,
            file_name
        );

        info!("Successfully uploaded to Azure Blob: {}", url);
        Ok(url)
    }

    /// Upload to Google Cloud Storage
    async fn upload_to_gcs(
        &self,
        archive_path: &Path,
        file_name: &str,
        cloud_config: &CloudConfig,
    ) -> Result<String> {
        // Note: This is a placeholder implementation
        // In practice, you'd use the google-cloud-storage crate
        warn!("Google Cloud Storage upload not fully implemented yet");
        
        let url = format!("https://storage.googleapis.com/{}/{}", 
            cloud_config.bucket_name, file_name);
        
        info!("Simulated upload to GCS: {}", url);
        Ok(url)
    }

    /// Format bytes to human readable string
    fn format_bytes(&self, bytes: u64) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
        let mut size = bytes as f64;
        let mut unit_index = 0;

        while size >= 1024.0 && unit_index < UNITS.len() - 1 {
            size /= 1024.0;
            unit_index += 1;
        }

        format!("{:.2} {}", size, UNITS[unit_index])
    }
}

impl Default for ArchiveManager {
    fn default() -> Self {
        Self::new(ArchiveConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_archive_format_detection() {
        let manager = ArchiveManager::default();
        
        assert_eq!(
            manager.detect_archive_format(Path::new("test.zip")).unwrap(),
            ArchiveFormat::Zip
        );
        assert_eq!(
            manager.detect_archive_format(Path::new("test.tar.gz")).unwrap(),
            ArchiveFormat::TarGz
        );
        assert_eq!(
            manager.detect_archive_format(Path::new("test.7z")).unwrap(),
            ArchiveFormat::SevenZip
        );
    }

    #[test]
    fn test_file_filtering() {
        let config = ArchiveConfig {
            exclude_patterns: vec!["*.tmp".to_string(), ".git".to_string()],
            include_patterns: vec![],
            ..Default::default()
        };
        
        let manager = ArchiveManager::new(config);
        
        assert!(!manager.should_process_file(Path::new("test.tmp")));
        assert!(!manager.should_process_file(Path::new(".git/config")));
        assert!(manager.should_process_file(Path::new("important.txt")));
    }

    #[test]
    fn test_compression_level_conversion() {
        assert_eq!(CompressionLevel::None.as_u32(), 0);
        assert_eq!(CompressionLevel::Default.as_u32(), 6);
        assert_eq!(CompressionLevel::Maximum.as_u32(), 9);
        assert_eq!(CompressionLevel::Ultra.as_u32(), 12);
    }
}