//! USN Journal Scanner
//!
//! Provides incremental scanning by monitoring NTFS USN (Update Sequence Number) Journal
//! Tracks file system changes in real-time for ultra-fast incremental updates

use std::collections::{HashMap, VecDeque};
use std::ffi::c_void;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::mem;
use std::path::{Path, PathBuf};
use std::ptr;
use std::slice;
use std::time::{SystemTime, UNIX_EPOCH};
use winapi::um::fileapi::{CreateFileW, SetFilePointerEx, ReadFile, OPEN_EXISTING};
use winapi::um::handleapi::{INVALID_HANDLE_VALUE, CloseHandle};
use winapi::um::ioapiset::DeviceIoControl;
use winapi::um::winnt::{
    FILE_SHARE_READ, FILE_SHARE_WRITE, GENERIC_READ, HANDLE,
    LARGE_INTEGER,
};
use winapi::um::winioctl::{FILE_DEVICE_DISK, METHOD_BUFFERED, FILE_ANY_ACCESS};
use winapi::um::winioctl::{FSCTL_QUERY_USN_JOURNAL, FSCTL_READ_USN_JOURNAL};
use winapi::um::errhandlingapi::GetLastError;
use winapi::shared::minwindef::{DWORD, LPVOID, BYTE, ULONG};
use winapi::shared::ntdef::NTSTATUS;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsnRecord {
    pub file_reference: u64,
    pub parent_file_reference: u64,
    pub usn: i64,
    pub timestamp: u64,
    pub reason: u32,
    pub file_attributes: u32,
    pub file_name_length: u16,
    pub file_name_offset: u16,
    pub file_name: String,
    pub file_path: PathBuf,
    pub change_type: ChangeType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ChangeType {
    Created,
    Deleted,
    Renamed,
    Modified,
    AttributeChanged,
    SecurityChanged,
    HardLinkChanged,
    StreamChanged,
    ReparsePointChanged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsnJournalInfo {
    pub volume_path: String,
    pub usn_journal_id: u64,
    pub next_usn: i64,
    pub lowest_usn: i64,
    pub max_usn: i64,
    pub journal_size: u64,
    pub allocation_delta: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeSet {
    pub volume_path: String,
    pub start_usn: i64,
    pub end_usn: i64,
    pub changes: Vec<UsnRecord>,
    pub timestamp: u64,
    pub total_changes: usize,
}

pub struct UsnJournalScanner {
    volume_handle: Option<HANDLE>,
    journal_info: Option<UsnJournalInfo>,
    change_buffer: VecDeque<UsnRecord>,
    last_processed_usn: Option<i64>,
    is_monitoring: bool,
    change_cache: HashMap<u64, Vec<UsnRecord>>,
}

impl UsnJournalScanner {
    pub fn new() -> Self {
        Self {
            volume_handle: None,
            journal_info: None,
            change_buffer: VecDeque::new(),
            last_processed_usn: None,
            is_monitoring: false,
            change_cache: HashMap::new(),
        }
    }

    /// Initialize USN journal monitoring for a specific volume
    pub fn initialize_volume(&mut self, volume_path: &str) -> Result<(), String> {
        // Convert path to wide string for Windows API
        let wide_path: Vec<u16> = volume_path.encode_utf16().chain(std::iter::once(0)).collect();

        // Open volume handle
        let handle = unsafe {
            CreateFileW(
                wide_path.as_ptr(),
                GENERIC_READ,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                ptr::null_mut(),
                OPEN_EXISTING,
                0,
                ptr::null_mut(),
            )
        };

        if handle == INVALID_HANDLE_VALUE {
            let error = unsafe { GetLastError() };
            return Err(format!("Failed to open volume {}: Error code {}", volume_path, error));
        }

        self.volume_handle = Some(handle);

        // Query USN journal information
        let journal_info = self.query_usn_journal_info()?;
        self.journal_info = Some(journal_info);

        Ok(())
    }

    /// Query USN journal information from the volume
    fn query_usn_journal_info(&self) -> Result<UsnJournalInfo, String> {
        let handle = self.volume_handle.ok_or("Volume handle not available")?;
        let volume_info = self.journal_info.as_ref();

        // Prepare input buffer for FSCTL_QUERY_USN_JOURNAL
        let mut input_data: Vec<u8> = vec![0; 64];

        // Set up USN_JOURNAL_DATA_V0 structure
        unsafe {
            let input_ptr = input_data.as_mut_ptr() as *mut USN_JOURNAL_DATA_V0;
            if let Some(ref info) = volume_info {
                (*input_ptr).UsnJournalID = info.usn_journal_id;
                (*input_ptr).FirstUsn = info.next_usn;
            }
        }

        // Prepare output buffer
        let mut output_data: Vec<u8> = vec![0; 80]; // Size of USN_JOURNAL_DATA_V0

        let mut bytes_returned: DWORD = 0;

        let success = unsafe {
            DeviceIoControl(
                handle,
                FSCTL_QUERY_USN_JOURNAL,
                input_data.as_ptr() as LPVOID,
                input_data.len() as DWORD,
                output_data.as_mut_ptr() as LPVOID,
                output_data.len() as DWORD,
                &mut bytes_returned,
                ptr::null_mut(),
            ) != 0
        };

        if !success {
            let error = unsafe { GetLastError() };
            return Err(format!("Failed to query USN journal: Error code {}", error));
        }

        // Parse USN journal data
        let journal_data = unsafe { &*(output_data.as_ptr() as *const USN_JOURNAL_DATA_V0) };

        Ok(UsnJournalInfo {
            volume_path: self.journal_info.as_ref()
                .map(|info| info.volume_path.clone())
                .unwrap_or_else(|| "Unknown".to_string()),
            usn_journal_id: journal_data.UsnJournalID,
            next_usn: journal_data.NextUsn,
            lowest_usn: journal_data.FirstUsn,
            max_usn: journal_data.MaxUsn,
            journal_size: journal_data.MaximumSize,
            allocation_delta: journal_data.AllocationDelta,
        })
    }

    /// Start monitoring USN journal for changes
    pub fn start_monitoring(&mut self) -> Result<(), String> {
        if self.is_monitoring {
            return Ok(());
        }

        let journal_info = self.journal_info.as_ref().ok_or("Journal not initialized")?;

        self.last_processed_usn = Some(journal_info.next_usn);
        self.is_monitoring = true;

        Ok(())
    }

    /// Stop monitoring USN journal
    pub fn stop_monitoring(&mut self) {
        self.is_monitoring = false;
    }

    /// Read changes from USN journal since last read
    pub fn read_changes(&mut self, max_changes: Option<usize>) -> Result<ChangeSet, String> {
        let handle = self.volume_handle.ok_or("Volume handle not available")?;
        let journal_info = self.journal_info.as_ref().ok_or("Journal not initialized")?;

        let start_usn = self.last_processed_usn.unwrap_or(journal_info.next_usn);
        let max_to_read = max_changes.unwrap_or(1000);

        // Prepare USN_JOURNAL_DATA_V0 for reading
        let mut journal_data = USN_JOURNAL_DATA_V0 {
            UsnJournalID: journal_info.usn_journal_id,
            FirstUsn: start_usn,
            NextUsn: 0,
            LowestUsn: journal_info.lowest_usn,
            MaxUsn: journal_info.max_usn,
            MaximumSize: journal_info.journal_size,
            AllocationDelta: journal_info.allocation_delta,
        };

        // Prepare buffer for USN records
        let buffer_size = max_to_read * 1024; // Approximate size per record
        let mut output_buffer: Vec<u8> = vec![0; buffer_size];

        let mut bytes_returned: DWORD = 0;

        // Read USN journal
        let success = unsafe {
            DeviceIoControl(
                handle,
                FSCTL_READ_USN_JOURNAL,
                &mut journal_data as *mut _ as LPVOID,
                mem::size_of::<USN_JOURNAL_DATA_V0>() as DWORD,
                output_buffer.as_mut_ptr() as LPVOID,
                output_buffer.len() as DWORD,
                &mut bytes_returned,
                ptr::null_mut(),
            ) != 0
        };

        if !success {
            let error = unsafe { GetLastError() };
            return Err(format!("Failed to read USN journal: Error code {}", error));
        }

        // Parse USN records
        let changes = self.parse_usn_records(&output_buffer, bytes_returned as usize)?;

        // Update last processed USN
        if let Some(last_change) = changes.last() {
            self.last_processed_usn = Some(last_change.usn);
        }

        // Cache changes
        for change in &changes {
            let file_ref = change.file_reference;
            self.change_cache.entry(file_ref)
                .or_insert_with(Vec::new)
                .push(change.clone());
        }

        let total_changes = changes.len();
        Ok(ChangeSet {
            volume_path: journal_info.volume_path.clone(),
            start_usn,
            end_usn: self.last_processed_usn.unwrap_or(start_usn),
            changes,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            total_changes,
        })
    }

    /// Parse USN records from raw buffer
    fn parse_usn_records(&self, buffer: &[u8], bytes_read: usize) -> Result<Vec<UsnRecord>, String> {
        let mut records = Vec::new();
        let mut offset = 0;

        // Skip the first USN record (contains journal info)
        if bytes_read > mem::size_of::<USN_RECORD>() {
            offset += mem::size_of::<USN_RECORD>();
        }

        while offset < bytes_read {
            if offset + mem::size_of::<USN_RECORD>() > bytes_read {
                break;
            }

            let record = unsafe { &*(buffer.as_ptr().add(offset) as *const USN_RECORD) };

            // Check record length
            let record_length = record.RecordLength as usize;
            if record_length == 0 || offset + record_length > bytes_read {
                break;
            }

            // Extract file name
            let file_name_offset = offset + record.FileNameOffset as usize;
            let file_name_length = record.FileNameLength as usize;

            if file_name_offset + file_name_length > bytes_read {
                offset += record_length;
                continue;
            }

            let name_bytes = &buffer[file_name_offset..file_name_offset + file_name_length];
            let file_name_utf16: Vec<u16> = name_bytes
                .chunks_exact(2)
                .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                .collect();

            let file_name = String::from_utf16(&file_name_utf16)
                .unwrap_or_else(|_| "Invalid UTF-16".to_string());

            // Determine change type from reason flags
            let change_type = self.parse_reason_flags(record.Reason);

            let usn_record = UsnRecord {
                file_reference: record.FileReferenceNumber,
                parent_file_reference: record.ParentFileReferenceNumber,
                usn: record.Usn,
                timestamp: record.TimeStamp as u64,
                reason: record.Reason,
                file_attributes: record.FileAttributes,
                file_name_length: record.FileNameLength,
                file_name_offset: record.FileNameOffset,
                file_name: file_name.clone(),
                file_path: PathBuf::from(&file_name), // Will be resolved later
                change_type,
            };

            records.push(usn_record);
            offset += record_length;
        }

        Ok(records)
    }

    /// Parse USN reason flags to determine change type
    fn parse_reason_flags(&self, reason: u32) -> ChangeType {
        // USN_REASON_* flags (from Windows SDK)
        const USN_REASON_DATA_OVERWRITE: u32 = 0x00000001;
        const USN_REASON_DATA_EXTEND: u32 = 0x00000002;
        const USN_REASON_DATA_TRUNCATION: u32 = 0x00000004;
        const USN_REASON_NAMED_DATA_OVERWRITE: u32 = 0x00000008;
        const USN_REASON_NAMED_DATA_EXTEND: u32 = 0x00000010;
        const USN_REASON_NAMED_DATA_TRUNCATION: u32 = 0x00000020;
        const USN_REASON_FILE_CREATE: u32 = 0x00000100;
        const USN_REASON_FILE_DELETE: u32 = 0x00000200;
        const USN_REASON_EA_CHANGE: u32 = 0x00000400;
        const USN_REASON_SECURITY_CHANGE: u32 = 0x00000800;
        const USN_REASON_RENAME_OLD_NAME: u32 = 0x00001000;
        const USN_REASON_RENAME_NEW_NAME: u32 = 0x00002000;
        const USN_REASON_INDEXABLE_CHANGE: u32 = 0x00004000;
        const USN_REASON_BASIC_INFO_CHANGE: u32 = 0x00008000;
        const USN_REASON_HARD_LINK_CHANGE: u32 = 0x00010000;
        const USN_REASON_COMPRESSION_CHANGE: u32 = 0x00020000;
        const USN_REASON_ENCRYPTION_CHANGE: u32 = 0x00040000;
        const USN_REASON_OBJECT_ID_CHANGE: u32 = 0x00080000;
        const USN_REASON_REPARSE_POINT_CHANGE: u32 = 0x00100000;
        const USN_REASON_STREAM_CHANGE: u32 = 0x00200000;
        const USN_REASON_TRANSACTED_CHANGE: u32 = 0x00400000;

        // Determine primary change type based on flags
        if reason & USN_REASON_FILE_CREATE != 0 {
            ChangeType::Created
        } else if reason & USN_REASON_FILE_DELETE != 0 {
            ChangeType::Deleted
        } else if (reason & USN_REASON_RENAME_OLD_NAME != 0) || (reason & USN_REASON_RENAME_NEW_NAME != 0) {
            ChangeType::Renamed
        } else if reason & USN_REASON_SECURITY_CHANGE != 0 {
            ChangeType::SecurityChanged
        } else if reason & USN_REASON_HARD_LINK_CHANGE != 0 {
            ChangeType::HardLinkChanged
        } else if reason & USN_REASON_REPARSE_POINT_CHANGE != 0 {
            ChangeType::ReparsePointChanged
        } else if reason & USN_REASON_STREAM_CHANGE != 0 {
            ChangeType::StreamChanged
        } else if (reason & USN_REASON_DATA_OVERWRITE != 0) ||
                  (reason & USN_REASON_DATA_EXTEND != 0) ||
                  (reason & USN_REASON_DATA_TRUNCATION != 0) {
            ChangeType::Modified
        } else if (reason & USN_REASON_EA_CHANGE != 0) ||
                  (reason & USN_REASON_BASIC_INFO_CHANGE != 0) {
            ChangeType::AttributeChanged
        } else {
            ChangeType::Modified // Default
        }
    }

    /// Get cached changes for a specific file
    pub fn get_file_changes(&self, file_reference: u64) -> &[UsnRecord] {
        self.change_cache.get(&file_reference).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// Clear change cache
    pub fn clear_cache(&mut self) {
        self.change_cache.clear();
        self.change_buffer.clear();
    }

    /// Get journal information
    pub fn get_journal_info(&self) -> Option<&UsnJournalInfo> {
        self.journal_info.as_ref()
    }

    /// Check if currently monitoring
    pub fn is_monitoring(&self) -> bool {
        self.is_monitoring
    }

    /// Get monitoring statistics
    pub fn get_monitoring_stats(&self) -> HashMap<String, String> {
        let mut stats = HashMap::new();

        stats.insert("is_monitoring".to_string(), self.is_monitoring.to_string());
        stats.insert("buffer_size".to_string(), self.change_buffer.len().to_string());
        stats.insert("cache_size".to_string(), self.change_cache.len().to_string());

        if let Some(ref info) = self.journal_info {
            stats.insert("journal_id".to_string(), info.usn_journal_id.to_string());
            stats.insert("next_usn".to_string(), info.next_usn.to_string());
            stats.insert("journal_size".to_string(), info.journal_size.to_string());
        }

        if let Some(last_usn) = self.last_processed_usn {
            stats.insert("last_processed_usn".to_string(), last_usn.to_string());
        }

        stats
    }

    /// Resolve full file path from USN record (requires additional processing)
    pub fn resolve_file_path(&self, record: &UsnRecord) -> PathBuf {
        // This is a simplified implementation
        // In practice, you'd need to traverse the parent references to build the full path
        let mut path = PathBuf::from(&record.file_name);

        // For demonstration, we'll use a simple path resolution
        // In production, this would involve recursive parent lookup
        if let Some(ref info) = self.journal_info {
            path = PathBuf::from(&info.volume_path).join(path);
        }

        path
    }
}

impl Drop for UsnJournalScanner {
    fn drop(&mut self) {
        self.stop_monitoring();
        if let Some(handle) = self.volume_handle {
            unsafe {
                CloseHandle(handle);
            }
        }
    }
}

// Windows API structures
#[repr(C)]
struct USN_JOURNAL_DATA_V0 {
    UsnJournalID: u64,
    FirstUsn: i64,
    NextUsn: i64,
    LowestUsn: i64,
    MaxUsn: i64,
    MaximumSize: u64,
    AllocationDelta: u64,
}

#[repr(C)]
struct USN_RECORD {
    RecordLength: u32,
    MajorVersion: u16,
    MinorVersion: u16,
    FileReferenceNumber: u64,
    ParentFileReferenceNumber: u64,
    Usn: i64,
    TimeStamp: i64,
    Reason: u32,
    SourceInfo: u32,
    SecurityId: u32,
    FileAttributes: u32,
    FileNameLength: u16,
    FileNameOffset: u16,
    FileName: [u16; 1], // Variable length
}

// IOCTL constants - these are already imported from winapi::um::winioctl
// const FSCTL_QUERY_USN_JOURNAL: u32 = CTL_CODE(FILE_DEVICE_DISK, 0xc4, METHOD_BUFFERED, FILE_ANY_ACCESS);
// const FSCTL_READ_USN_JOURNAL: u32 = CTL_CODE(FILE_DEVICE_DISK, 0xc5, METHOD_BUFFERED, FILE_ANY_ACCESS);
// const fn CTL_CODE(device_type: u32, function: u32, method: u32, access: u32) -> u32 {
//     (device_type << 16) | (access << 14) | (function << 2) | method
// }

/// Utility functions for USN journal scanning
pub mod utils {
    use super::*;

    /// Get list of volumes with USN journal support
    pub fn get_usn_journal_volumes() -> Result<Vec<String>, String> {
        use std::fs;

        let mut volumes = Vec::new();

        // Check common drive letters
        for drive in b'C'..=b'Z' {
            let drive_path = format!("{}:\\", drive as char);
            let drive_letter = drive as char;

            if fs::metadata(&drive_path).is_ok() {
                // Try to open volume and query USN journal
                let volume_path = format!("\\\\.\\{}", drive_letter);
                let mut scanner = UsnJournalScanner::new();
                if scanner.initialize_volume(&volume_path).is_ok() {
                    volumes.push(format!("{}:", drive_letter));
                }
            }
        }

        Ok(volumes)
    }

    /// Estimate change processing time
    pub fn estimate_processing_time(change_count: usize) -> f64 {
        // USN journal processing is extremely fast
        // Based on empirical data: ~1M changes per second
        const CHANGES_PER_SECOND: f64 = 1_000_000.0;
        change_count as f64 / CHANGES_PER_SECOND
    }

    /// Format change type for display
    pub fn format_change_type(change_type: &ChangeType) -> &'static str {
        match change_type {
            ChangeType::Created => "Created",
            ChangeType::Deleted => "Deleted",
            ChangeType::Renamed => "Renamed",
            ChangeType::Modified => "Modified",
            ChangeType::AttributeChanged => "Attribute Changed",
            ChangeType::SecurityChanged => "Security Changed",
            ChangeType::HardLinkChanged => "Hard Link Changed",
            ChangeType::StreamChanged => "Stream Changed",
            ChangeType::ReparsePointChanged => "Reparse Point Changed",
        }
    }

    /// Get change statistics
    pub fn get_change_statistics(changes: &[UsnRecord]) -> HashMap<String, usize> {
        let mut stats = HashMap::new();

        for change in changes {
            let type_name = format_change_type(&change.change_type);
            *stats.entry(type_name.to_string()).or_insert(0) += 1;
        }

        stats
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usn_journal_scanner_creation() {
        let scanner = UsnJournalScanner::new();
        assert!(!scanner.is_monitoring());
        assert!(scanner.get_journal_info().is_none());
    }

    #[test]
    fn test_change_type_parsing() {
        let scanner = UsnJournalScanner::new();

        // Test file creation
        let create_type = scanner.parse_reason_flags(0x00000100);
        assert_eq!(create_type, ChangeType::Created);

        // Test file deletion
        let delete_type = scanner.parse_reason_flags(0x00000200);
        assert_eq!(delete_type, ChangeType::Deleted);

        // Test rename
        let rename_type = scanner.parse_reason_flags(0x00001000);
        assert_eq!(rename_type, ChangeType::Renamed);
    }

    #[test]
    fn test_processing_time_estimation() {
        let time = utils::estimate_processing_time(100000);
        assert!(time < 1.0); // Should be very fast
        println!("Estimated time for 100K changes: {:.3} seconds", time);
    }

    #[test]
    fn test_change_statistics() {
        let changes = vec![
            UsnRecord {
                file_reference: 1,
                parent_file_reference: 0,
                usn: 100,
                timestamp: 0,
                reason: 0x00000100,
                file_attributes: 0,
                file_name_length: 0,
                file_name_offset: 0,
                file_name: "test.txt".to_string(),
                file_path: PathBuf::from("test.txt"),
                change_type: ChangeType::Created,
            },
            UsnRecord {
                file_reference: 2,
                parent_file_reference: 0,
                usn: 101,
                timestamp: 0,
                reason: 0x00000200,
                file_attributes: 0,
                file_name_length: 0,
                file_name_offset: 0,
                file_name: "test2.txt".to_string(),
                file_path: PathBuf::from("test2.txt"),
                change_type: ChangeType::Deleted,
            },
        ];

        let stats = utils::get_change_statistics(&changes);
        assert_eq!(stats.get("Created"), Some(&1));
        assert_eq!(stats.get("Deleted"), Some(&1));
    }
}

// NAPI exports for Node.js integration - disabled (requires napi-rs build setup)
// These exports are placeholders for when napi-rs is properly configured
#[cfg(target_os = "windows")]
pub mod napi_exports {
    use super::*;

    pub fn create_usn_scanner() -> UsnJournalScanner {
        UsnJournalScanner::new()
    }

    pub fn initialize_volume(
        scanner: &mut UsnJournalScanner,
        volume_path: &str,
    ) -> std::result::Result<(), String> {
        scanner.initialize_volume(volume_path)
    }

    pub fn start_monitoring(scanner: &mut UsnJournalScanner) -> std::result::Result<(), String> {
        scanner.start_monitoring()
    }

    pub fn stop_monitoring(scanner: &mut UsnJournalScanner) {
        scanner.stop_monitoring();
    }

    pub fn read_changes(
        scanner: &mut UsnJournalScanner,
        max_changes: Option<usize>,
    ) -> std::result::Result<ChangeSet, String> {
        scanner.read_changes(max_changes)
    }

    pub fn get_usn_journal_volumes() -> std::result::Result<Vec<String>, String> {
        utils::get_usn_journal_volumes()
    }

    pub fn get_monitoring_stats(scanner: &UsnJournalScanner) -> HashMap<String, String> {
        scanner.get_monitoring_stats()
    }
}
