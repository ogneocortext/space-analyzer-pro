//! `usn` subcommand: inspect NTFS USN change journals for incremental scanning.

use crate::cli::args::{OutputFormat, UsnCommand};
use space_analyzer_pro_desktop::error::{AppError, AppResult};

/// Convert a user-supplied drive spec (`C:`, `C:\`, `C`, `c`) into the
/// `\\.\X` volume path expected by the Win32 volume-open API.
fn to_volume_path(drive: &str) -> String {
    let letter = drive
        .trim()
        .trim_end_matches([':', '\\', '/', '.', '\\', '/'])
        .chars()
        .last()
        .unwrap_or('C');
    format!("\\\\.\\{}", letter)
}

/// Dispatch the `usn` subcommand. USN journals are Windows/NTFS only.
pub fn run(command: UsnCommand, format: OutputFormat) -> AppResult<()> {
    #[cfg(windows)]
    {
        run_windows(command, format)
    }
    #[cfg(not(windows))]
    {
        let _ = (command, format);
        Err(AppError::Validation(
            "USN journal inspection is only available on Windows/NTFS".to_string(),
        ))
    }
}

#[cfg(windows)]
fn run_windows(command: UsnCommand, format: OutputFormat) -> AppResult<()> {
    use space_scanner::usn_journal_scanner::utils::format_change_type;
    use space_scanner::usn_journal_scanner::utils::get_usn_journal_volumes;
    use space_scanner::usn_journal_scanner::UsnJournalScanner;

    let to_err = |e: String| AppError::Validation(e);

    match command {
        UsnCommand::Volumes => {
            let volumes = get_usn_journal_volumes().map_err(to_err)?;
            if format == OutputFormat::Json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&volumes).unwrap_or_default()
                );
            } else {
                println!("USN journal volumes ({}):", volumes.len());
                for v in &volumes {
                    println!("  {v}");
                }
            }
        }
        UsnCommand::Status { drive } => {
            let drive = drive.unwrap_or_else(|| "C:".to_string());
            let volume_path = to_volume_path(&drive);
            let mut scanner = UsnJournalScanner::new();
            scanner.initialize_volume(&volume_path).map_err(to_err)?;
            let info = scanner
                .get_journal_info()
                .cloned()
                .ok_or_else(|| AppError::Validation("Could not read journal info".to_string()))?;
            if format == OutputFormat::Json {
                println!("{}", serde_json::to_string_pretty(&info).unwrap_or_default());
            } else {
                println!("Volume:            {}", info.volume_path);
                println!("Journal ID:        {}", info.usn_journal_id);
                println!("Next USN:          {}", info.next_usn);
                println!("Lowest USN:        {}", info.lowest_usn);
                println!("Max USN:           {}", info.max_usn);
                println!("Journal size:      {}", info.journal_size);
                println!("Allocation delta:  {}", info.allocation_delta);
            }
        }
        UsnCommand::Changes { drive, max } => {
            let volume_path = to_volume_path(&drive);
            let mut scanner = UsnJournalScanner::new();
            scanner.initialize_volume(&volume_path).map_err(to_err)?;
            scanner.start_monitoring().map_err(to_err)?;
            let changes = scanner.read_changes(Some(max)).map_err(to_err)?;
            if format == OutputFormat::Json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&changes).unwrap_or_default()
                );
            } else {
                println!(
                    "Read {} change(s) for {} (USN {}..{})",
                    changes.total_changes, changes.volume_path, changes.start_usn, changes.end_usn
                );
                for c in &changes.changes {
                    println!(
                        "  [{}] {} (USN {})",
                        format_change_type(&c.change_type),
                        c.file_name,
                        c.usn
                    );
                }
            }
        }
    }
    Ok(())
}
