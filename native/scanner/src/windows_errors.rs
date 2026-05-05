//! Windows API Error Handling
//!
//! Provides structured error handling for Windows API calls with
//! user-friendly error messages and error categorization.

use std::fmt;

// Windows System Error Codes
// https://docs.microsoft.com/en-us/windows/win32/debug/system-error-codes

pub const ERROR_SUCCESS: u32 = 0;
pub const ERROR_INVALID_FUNCTION: u32 = 1;
pub const ERROR_FILE_NOT_FOUND: u32 = 2;
pub const ERROR_PATH_NOT_FOUND: u32 = 3;
pub const ERROR_TOO_MANY_OPEN_FILES: u32 = 4;
pub const ERROR_ACCESS_DENIED: u32 = 5;
pub const ERROR_INVALID_HANDLE: u32 = 6;
pub const ERROR_ARENA_TRASHED: u32 = 7;
pub const ERROR_NOT_ENOUGH_MEMORY: u32 = 8;
pub const ERROR_INVALID_BLOCK: u32 = 9;
pub const ERROR_BAD_ENVIRONMENT: u32 = 10;
pub const ERROR_BAD_FORMAT: u32 = 11;
pub const ERROR_INVALID_ACCESS: u32 = 12;
pub const ERROR_INVALID_DATA: u32 = 13;
pub const ERROR_OUTOFMEMORY: u32 = 14;
pub const ERROR_INVALID_DRIVE: u32 = 15;
pub const ERROR_CURRENT_DIRECTORY: u32 = 16;
pub const ERROR_NOT_SAME_DEVICE: u32 = 17;
pub const ERROR_NO_MORE_FILES: u32 = 18;
pub const ERROR_WRITE_PROTECT: u32 = 19;
pub const ERROR_BAD_UNIT: u32 = 20;
pub const ERROR_NOT_READY: u32 = 21;
pub const ERROR_BAD_COMMAND: u32 = 22;
pub const ERROR_CRC: u32 = 23;
pub const ERROR_BAD_LENGTH: u32 = 24;
pub const ERROR_SEEK: u32 = 25;
pub const ERROR_NOT_DOS_DISK: u32 = 26;
pub const ERROR_SECTOR_NOT_FOUND: u32 = 27;
pub const ERROR_OUT_OF_PAPER: u32 = 28;
pub const ERROR_WRITE_FAULT: u32 = 29;
pub const ERROR_READ_FAULT: u32 = 30;
pub const ERROR_GEN_FAILURE: u32 = 31;
pub const ERROR_SHARING_VIOLATION: u32 = 32;
pub const ERROR_LOCK_VIOLATION: u32 = 33;
pub const ERROR_WRONG_DISK: u32 = 34;
pub const ERROR_SHARING_BUFFER_EXCEEDED: u32 = 36;
pub const ERROR_HANDLE_EOF: u32 = 38;
pub const ERROR_HANDLE_DISK_FULL: u32 = 39;
pub const ERROR_NOT_SUPPORTED: u32 = 50;
pub const ERROR_REM_NOT_LIST: u32 = 51;
pub const ERROR_DUP_NAME: u32 = 52;
pub const ERROR_BAD_NETPATH: u32 = 53;
pub const ERROR_NETWORK_BUSY: u32 = 54;
pub const ERROR_DEV_NOT_EXIST: u32 = 55;
pub const ERROR_TOO_MANY_CMDS: u32 = 56;
pub const ERROR_ADAP_HDW_ERR: u32 = 57;
pub const ERROR_BAD_NET_RESP: u32 = 58;
pub const ERROR_UNEXP_NET_ERR: u32 = 59;
pub const ERROR_BAD_REM_ADAP: u32 = 60;
pub const ERROR_PRINTQ_FULL: u32 = 61;
pub const ERROR_NO_SPOOL_SPACE: u32 = 62;
pub const ERROR_PRINT_CANCELLED: u32 = 63;
pub const ERROR_NETNAME_DELETED: u32 = 64;
pub const ERROR_NETWORK_ACCESS_DENIED: u32 = 65;
pub const ERROR_BAD_DEV_TYPE: u32 = 66;
pub const ERROR_BAD_NET_NAME: u32 = 67;
pub const ERROR_TOO_MANY_NAMES: u32 = 68;
pub const ERROR_TOO_MANY_SESS: u32 = 69;
pub const ERROR_SHARING_PAUSED: u32 = 70;
pub const ERROR_REQ_NOT_ACCEP: u32 = 71;
pub const ERROR_REDIR_PAUSED: u32 = 72;
pub const ERROR_FILE_EXISTS: u32 = 80;
pub const ERROR_CANNOT_MAKE: u32 = 82;
pub const ERROR_FAIL_I24: u32 = 83;
pub const ERROR_OUT_OF_STRUCTURES: u32 = 84;
pub const ERROR_ALREADY_ASSIGNED: u32 = 85;
pub const ERROR_INVALID_PASSWORD: u32 = 86;
pub const ERROR_INVALID_PARAMETER: u32 = 87;
pub const ERROR_NET_WRITE_FAULT: u32 = 88;
pub const ERROR_PROC_NOT_FOUND: u32 = 127;
pub const ERROR_MR_MID_NOT_FOUND: u32 = 317;
pub const ERROR_INVALID_OPERATION: u32 = 4317;

/// Structured Windows error with context
#[derive(Debug, Clone)]
pub struct WindowsError {
    pub code: u32,
    pub operation: String,
    pub path: Option<String>,
}

impl WindowsError {
    /// Create a new Windows error
    pub fn new(code: u32, operation: &str) -> Self {
        Self {
            code,
            operation: operation.to_string(),
            path: None,
        }
    }

    /// Add path context to error
    pub fn with_path(mut self, path: &str) -> Self {
        self.path = Some(path.to_string());
        self
    }

    /// Get the error message for this error code
    pub fn message(&self) -> String {
        get_error_message(self.code)
    }

    /// Get user-friendly error category
    pub fn category(&self) -> ErrorCategory {
        match self.code {
            ERROR_ACCESS_DENIED | ERROR_NETWORK_ACCESS_DENIED => ErrorCategory::PermissionDenied,
            ERROR_FILE_NOT_FOUND | ERROR_PATH_NOT_FOUND => ErrorCategory::NotFound,
            ERROR_SHARING_VIOLATION | ERROR_LOCK_VIOLATION => ErrorCategory::FileLocked,
            ERROR_NOT_READY | ERROR_DEV_NOT_EXIST => ErrorCategory::DeviceNotReady,
            ERROR_NOT_ENOUGH_MEMORY | ERROR_OUTOFMEMORY => ErrorCategory::OutOfMemory,
            ERROR_INVALID_HANDLE | ERROR_INVALID_PARAMETER => ErrorCategory::InvalidArgument,
            ERROR_HANDLE_EOF => ErrorCategory::EndOfFile,
            _ => ErrorCategory::Other,
        }
    }

    /// Get recovery suggestion for this error
    pub fn suggestion(&self) -> String {
        match self.category() {
            ErrorCategory::PermissionDenied => {
                "Try running the scanner with administrator privileges or check folder permissions.".to_string()
            }
            ErrorCategory::NotFound => {
                format!("Verify that the path '{}' exists and is accessible.", 
                    self.path.as_deref().unwrap_or("specified"))
            }
            ErrorCategory::FileLocked => {
                "The file is locked by another process. Close any programs using this file and try again.".to_string()
            }
            ErrorCategory::DeviceNotReady => {
                "The drive is not ready. Check if removable media is inserted or if the drive is accessible.".to_string()
            }
            ErrorCategory::OutOfMemory => {
                "Not enough memory to complete the operation. Try closing other applications or scanning a smaller directory.".to_string()
            }
            ErrorCategory::InvalidArgument => {
                "Invalid parameter passed to Windows API. This may be a bug - please report it.".to_string()
            }
            ErrorCategory::EndOfFile => {
                "Reached end of file unexpectedly. The file may be corrupted or truncated.".to_string()
            }
            ErrorCategory::Other => {
                format!("Windows error code {}: {}", self.code, self.message())
            }
        }
    }

    /// Format full error message with context
    pub fn format_error(&self) -> String {
        let path_str = self.path.as_ref()
            .map(|p| format!(" at '{}'", p))
            .unwrap_or_default();
        
        format!(
            "{} failed{}: {} (Error {})",
            self.operation,
            path_str,
            self.message(),
            self.code
        )
    }
}

impl fmt::Display for WindowsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.format_error())
    }
}

impl std::error::Error for WindowsError {}

/// Error categories for grouping similar errors
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCategory {
    PermissionDenied,
    NotFound,
    FileLocked,
    DeviceNotReady,
    OutOfMemory,
    InvalidArgument,
    EndOfFile,
    Other,
}

impl fmt::Display for ErrorCategory {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorCategory::PermissionDenied => write!(f, "Permission Denied"),
            ErrorCategory::NotFound => write!(f, "Not Found"),
            ErrorCategory::FileLocked => write!(f, "File Locked"),
            ErrorCategory::DeviceNotReady => write!(f, "Device Not Ready"),
            ErrorCategory::OutOfMemory => write!(f, "Out of Memory"),
            ErrorCategory::InvalidArgument => write!(f, "Invalid Argument"),
            ErrorCategory::EndOfFile => write!(f, "End of File"),
            ErrorCategory::Other => write!(f, "Other"),
        }
    }
}

/// Get the error message for a Windows error code
pub fn get_error_message(code: u32) -> String {
    match code {
        ERROR_SUCCESS => "Success".to_string(),
        ERROR_INVALID_FUNCTION => "Invalid function".to_string(),
        ERROR_FILE_NOT_FOUND => "File not found".to_string(),
        ERROR_PATH_NOT_FOUND => "Path not found".to_string(),
        ERROR_TOO_MANY_OPEN_FILES => "Too many open files".to_string(),
        ERROR_ACCESS_DENIED => "Access denied".to_string(),
        ERROR_INVALID_HANDLE => "Invalid handle".to_string(),
        ERROR_ARENA_TRASHED => "Arena trashed".to_string(),
        ERROR_NOT_ENOUGH_MEMORY => "Not enough memory".to_string(),
        ERROR_INVALID_BLOCK => "Invalid block".to_string(),
        ERROR_BAD_ENVIRONMENT => "Bad environment".to_string(),
        ERROR_BAD_FORMAT => "Bad format".to_string(),
        ERROR_INVALID_ACCESS => "Invalid access".to_string(),
        ERROR_INVALID_DATA => "Invalid data".to_string(),
        ERROR_OUTOFMEMORY => "Out of memory".to_string(),
        ERROR_INVALID_DRIVE => "Invalid drive".to_string(),
        ERROR_CURRENT_DIRECTORY => "Current directory".to_string(),
        ERROR_NOT_SAME_DEVICE => "Not same device".to_string(),
        ERROR_NO_MORE_FILES => "No more files".to_string(),
        ERROR_WRITE_PROTECT => "Write protect".to_string(),
        ERROR_BAD_UNIT => "Bad unit".to_string(),
        ERROR_NOT_READY => "Drive not ready".to_string(),
        ERROR_BAD_COMMAND => "Bad command".to_string(),
        ERROR_CRC => "CRC error".to_string(),
        ERROR_BAD_LENGTH => "Bad length".to_string(),
        ERROR_SEEK => "Seek error".to_string(),
        ERROR_NOT_DOS_DISK => "Not DOS disk".to_string(),
        ERROR_SECTOR_NOT_FOUND => "Sector not found".to_string(),
        ERROR_OUT_OF_PAPER => "Out of paper".to_string(),
        ERROR_WRITE_FAULT => "Write fault".to_string(),
        ERROR_READ_FAULT => "Read fault".to_string(),
        ERROR_GEN_FAILURE => "General failure".to_string(),
        ERROR_SHARING_VIOLATION => "Sharing violation".to_string(),
        ERROR_LOCK_VIOLATION => "Lock violation".to_string(),
        ERROR_WRONG_DISK => "Wrong disk".to_string(),
        ERROR_SHARING_BUFFER_EXCEEDED => "Sharing buffer exceeded".to_string(),
        ERROR_HANDLE_EOF => "End of file reached".to_string(),
        ERROR_HANDLE_DISK_FULL => "Disk full".to_string(),
        ERROR_NOT_SUPPORTED => "Not supported".to_string(),
        ERROR_REM_NOT_LIST => "Remote not list".to_string(),
        ERROR_DUP_NAME => "Duplicate name".to_string(),
        ERROR_BAD_NETPATH => "Bad network path".to_string(),
        ERROR_NETWORK_BUSY => "Network busy".to_string(),
        ERROR_DEV_NOT_EXIST => "Device does not exist".to_string(),
        ERROR_TOO_MANY_CMDS => "Too many commands".to_string(),
        ERROR_ADAP_HDW_ERR => "Adapter hardware error".to_string(),
        ERROR_BAD_NET_RESP => "Bad network response".to_string(),
        ERROR_UNEXP_NET_ERR => "Unexpected network error".to_string(),
        ERROR_BAD_REM_ADAP => "Bad remote adapter".to_string(),
        ERROR_PRINTQ_FULL => "Print queue full".to_string(),
        ERROR_NO_SPOOL_SPACE => "No spool space".to_string(),
        ERROR_PRINT_CANCELLED => "Print cancelled".to_string(),
        ERROR_NETNAME_DELETED => "Network name deleted".to_string(),
        ERROR_NETWORK_ACCESS_DENIED => "Network access denied".to_string(),
        ERROR_BAD_DEV_TYPE => "Bad device type".to_string(),
        ERROR_BAD_NET_NAME => "Bad network name".to_string(),
        ERROR_TOO_MANY_NAMES => "Too many names".to_string(),
        ERROR_TOO_MANY_SESS => "Too many sessions".to_string(),
        ERROR_SHARING_PAUSED => "Sharing paused".to_string(),
        ERROR_REQ_NOT_ACCEP => "Request not accepted".to_string(),
        ERROR_REDIR_PAUSED => "Redirector paused".to_string(),
        ERROR_FILE_EXISTS => "File already exists".to_string(),
        ERROR_CANNOT_MAKE => "Cannot create".to_string(),
        ERROR_FAIL_I24 => "Fail on INT 24".to_string(),
        ERROR_OUT_OF_STRUCTURES => "Out of structures".to_string(),
        ERROR_ALREADY_ASSIGNED => "Already assigned".to_string(),
        ERROR_INVALID_PASSWORD => "Invalid password".to_string(),
        ERROR_INVALID_PARAMETER => "Invalid parameter".to_string(),
        ERROR_NET_WRITE_FAULT => "Network write fault".to_string(),
        ERROR_PROC_NOT_FOUND => "Procedure not found".to_string(),
        ERROR_MR_MID_NOT_FOUND => "MR mid not found".to_string(),
        ERROR_INVALID_OPERATION => "Invalid operation".to_string(),
        _ => format!("Unknown error ({})", code),
    }
}

/// Helper function to format Windows error from GetLastError()
pub fn format_last_error(operation: &str) -> String {
    #[cfg(windows)]
    {
        use winapi::um::errhandlingapi::GetLastError;
        let code = unsafe { GetLastError() };
        WindowsError::new(code, operation).format_error()
    }
    #[cfg(not(windows))]
    {
        format!("{} failed: Not running on Windows", operation)
    }
}

/// Helper function to create WindowsError from GetLastError()
pub fn last_error(operation: &str) -> WindowsError {
    #[cfg(windows)]
    {
        use winapi::um::errhandlingapi::GetLastError;
        let code = unsafe { GetLastError() };
        WindowsError::new(code, operation)
    }
    #[cfg(not(windows))]
    {
        WindowsError::new(ERROR_NOT_SUPPORTED, operation)
    }
}

/// Check if error code indicates a fatal error that should stop scanning
pub fn is_fatal_error(code: u32) -> bool {
    matches!(code, 
        ERROR_ACCESS_DENIED |
        ERROR_NOT_READY |
        ERROR_DEV_NOT_EXIST |
        ERROR_INVALID_DRIVE |
        ERROR_NOT_SUPPORTED |
        ERROR_OUTOFMEMORY |
        ERROR_NOT_ENOUGH_MEMORY
    )
}

/// Check if error code indicates a retryable error
pub fn is_retryable_error(code: u32) -> bool {
    matches!(code,
        ERROR_SHARING_VIOLATION |
        ERROR_LOCK_VIOLATION |
        ERROR_NETWORK_BUSY |
        ERROR_TOO_MANY_OPEN_FILES
    )
}
