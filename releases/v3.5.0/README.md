# Space Analyzer Pro v3.5.0 - Release Bundle

## Quick Start

1. Extract all files to a folder of your choice
2. Run `space-analyzer-gui.exe` to launch the GUI
3. Run `space-analyzer-pro.exe -p "C:\path\to\scan"` for CLI usage

## Binaries

- `space-analyzer-pro.exe` — CLI scanner with duplicate detection, reports, cleanup recommendations
- `space-analyzer-gui.exe` — Full GUI application with dashboard, AI features, workflows
- `file-deduplicator.exe` — Standalone duplicate file finder

## Usage Examples

```powershell
# Scan C drive for files > 100MB
.\space-analyzer-pro.exe -p "C:\" --min-size 100M --top 30

# Find duplicates in Downloads folder
.\space-analyzer-pro.exe -p "C:\Users\Aomega Imaging\Downloads" --clean

# Generate space-saving recommendations
.\space-analyzer-pro.exe -p "C:\Users\Aomega Imaging" --cleanup-recommendations

# Export scan results to JSON
.\space-analyzer-pro.exe -p "C:\" --export scan.json --format json

# Generate markdown report
.\space-analyzer-pro.exe -p "C:\Users\Aomega Imaging" --report
```

## Features Added in v3.5.0

- `--cleanup-recommendations` flag for actionable space-saving suggestions
- CLI scans now saved to SQLite database for trend analytics
- Improved report naming: `{path}_{timestamp}_{hash}.md`

## Database

Scan history stored at: `%LOCALAPPDATA%\space-analyzer-pro\space-analyzer.db`

## Notes

- All binaries are self-contained (no external dependencies)
- Requires Windows 10/11 (64-bit)