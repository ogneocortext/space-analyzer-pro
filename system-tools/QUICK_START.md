# Quick Start Guide - System Tools for LLM Agents

## 🚀 Immediate Usage

### 1. File Origin Analyzer (PowerShell)
**Purpose**: Trace file origins and detect system associations
**Speed**: Instant - No compilation required

```powershell
# Basic analysis of your target directory
.\FileOriginAnalyzer.ps1 -Path "C:\Users\Aomega Imaging"

# Detailed analysis with JSON output
.\FileOriginAnalyzer.ps1 -Path "C:\Users\Aomega Imaging" -Detailed -OutputFormat JSON

# Export to CSV for spreadsheet analysis
.\FileOriginAnalyzer.ps1 -Path "C:\Users\Aomega Imaging" -OutputFormat CSV > analysis.csv
```

### 2. Quick File Browser (C# WinForms)
**Purpose**: Instant visual file browser with origin analysis
**Speed**: Compile once, run instantly

```batch
# Compile the tool
BuildQuickFileBrowser.bat

# Run the compiled tool
QuickFileBrowser.exe
```

### 3. Safe Cleanup Assistant (PowerShell)
**Purpose**: Intelligent cleanup with safety checks
**Speed**: Instant - No compilation required

```powershell
# Preview cleanup opportunities (SAFE - no changes)
.\SafeCleanupAssistant.ps1 -TargetPath "C:\Users\Aomega Imaging" -DryRun

# Include medium risk files
.\SafeCleanupAssistant.ps1 -TargetPath "C:\Users\Aomega Imaging" -RiskThreshold Medium -DryRun

# Create backup and clean safe files (D drive only for critical files)
.\SafeCleanupAssistant.ps1 -TargetPath "C:\Users\Aomega Imaging" -CriticalBackupOnly
```

## 🎯 Target Directory Analysis

### For "C:\Users\Aomega Imaging"
```powershell
# Step 1: Quick origin analysis
.\FileOriginAnalyzer.ps1 -Path "C:\Users\Aomega Imaging" -Detailed

# Step 2: Preview cleanup candidates
.\SafeCleanupAssistant.ps1 -TargetPath "C:\Users\Aomega Imaging" -DryRun

# Step 3: Visual inspection
QuickFileBrowser.exe
# Navigate to C:\Users\Aomega Imaging
# Click "Analyze Origin" button
# Review color-coded results

# Step 4: Safe cleanup (if satisfied)
.\SafeCleanupAssistant.ps1 -TargetPath "C:\Users\Aomega Imaging" -CreateBackup
```

## 📊 Understanding Results

### Risk Levels
- **🟢 LOW**: Safe to delete (temp files, cache, old backups)
- **🟡 MEDIUM**: Review before deletion (program files, unknown types)
- **🔴 HIGH**: Do not delete (system files, critical applications)

### Origin Types
- **Windows System**: OS files - NEVER delete
- **Installed Program**: Application files - CAUTION
- **Temporary/Cache**: Safe to delete
- **Unknown**: Manual review recommended

### Confidence Levels
- **High**: Certain analysis
- **Medium**: Probable analysis
- **Low**: Estimated analysis

## ⚡ Performance Tips

### Fastest Analysis
```powershell
# Quick scan (less detail, faster)
.\FileOriginAnalyzer.ps1 -Path "C:\Users\Aomega Imaging"

# Only large files (>10MB)
.\SafeCleanupAssistant.ps1 -TargetPath "C:\Users\Aomega Imaging" -MinSizeMB 10 -DryRun
```

### Most Comprehensive
```powershell
# Detailed analysis with full reporting
.\FileOriginAnalyzer.ps1 -Path "C:\Users\Aomega Imaging" -Detailed -OutputFormat JSON > full_report.json
```

## 🛡️ Safety Features

### Built-in Protections
- **System File Detection**: Automatically protects Windows files
- **Program Dependencies**: Identifies installed application files
- **Backup Creation**: Optional backup before deletion
- **Dry Run Mode**: Preview changes before execution

### User Controls
- **Risk Thresholds**: Choose maximum risk level (Low/Medium/High)
- **Size Filters**: Only analyze files above specified size
- **Manual Review**: Visual inspection with Quick File Browser

## 📋 LLM Agent Workflow

### Recommended Analysis Sequence
1. **Initial Scan**: `FileOriginAnalyzer.ps1` for overview
2. **Visual Inspection**: `QuickFileBrowser.exe` for detailed review
3. **Cleanup Planning**: `SafeCleanupAssistant.ps1 -DryRun`
4. **Safe Execution**: `SafeCleanupAssistant.ps1 -CreateBackup`
5. **Verification**: Re-run analysis to confirm results

### Decision Points
- **Stop if**: High-risk files found in critical locations
- **Proceed if**: Only low-risk temp/cache files identified
- **Manual Review**: Medium-risk files or unknown origins

## 🔧 Troubleshooting

### PowerShell Execution Policy
```powershell
# Allow scripts to run
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### C# Compilation Issues
```batch
# If BuildQuickFileBrowser.bat fails
# Install .NET SDK from: https://dotnet.microsoft.com/download
# Or use PowerShell version instead
```

### Permission Issues
```powershell
# Run as Administrator for system directories
# Right-click PowerShell -> "Run as Administrator"
```

## 📈 Expected Results

### Typical User Directory Analysis
- **Temp Files**: 50-200 MB safe to delete
- **Cache Files**: 100-500 MB safe to delete
- **Old Files**: Variable, depends on usage
- **Program Files**: Usually 0 MB safe (medium/high risk)

### Success Indicators
- ✅ No high-risk files in user directories
- ✅ Clear origin identification for most files
- ✅ Safe cleanup candidates identified
- ✅ Backup created before any deletion

## 🎯 Quick Commands for Your Use Case

### Analyze "C:\Users\Aomega Imaging" Now
```powershell
cd "E:\Self Built Web and Mobile Apps\Space Analyzer\system-tools"

# Quick overview
.\FileOriginAnalyzer.ps1 -Path "C:\Users\Aomega Imaging"

# Cleanup preview
.\SafeCleanupAssistant.ps1 -TargetPath "C:\Users\Aomega Imaging" -DryRun

# Visual inspection
BuildQuickFileBrowser.bat
QuickFileBrowser.exe
```

### One-Command Analysis
```powershell
# Complete analysis in one command
.\FileOriginAnalyzer.ps1 -Path "C:\Users\Aomega Imaging" -Detailed | Out-File -FilePath "analysis_report.txt"
```

---

*These tools are designed for maximum performance with zero dependencies. Run them immediately to analyze your target directory.*
