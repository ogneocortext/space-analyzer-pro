<#
.SYNOPSIS
    File Origin Analyzer - High-performance file origin tracking for LLM agents
    
.DESCRIPTION
    Analyzes file origins, digital signatures, and system associations to determine
    safe deletion candidates. Optimized for speed with native Windows APIs.
    
.AUTHOR
    LLM System Tools
    
.VERSION
    1.0
    
.PARAMETER Path
        Target directory to analyze
        
.PARAMETER Detailed
        Include detailed analysis (slower but more comprehensive)
        
.PARAMETER OutputFormat
        Output format: Console, JSON, CSV
        
.EXAMPLE
    .\FileOriginAnalyzer.ps1 -Path "C:\Users\Aomega Imaging" -Detailed
    
.EXAMPLE
    .\FileOriginAnalyzer.ps1 -Path "C:\Users\Aomega Imaging" -OutputFormat JSON
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Path,
    
    [switch]$Detailed,
    
    [ValidateSet("Console", "JSON", "CSV")]
    [string]$OutputFormat = "Console"
)

# Enhanced logging for LLM visibility
function Write-LLMLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $(
        switch($Level) {
            "INFO" { "White" }
            "WARN" { "Yellow" }
            "ERROR" { "Red" }
            "SUCCESS" { "Green" }
        }
    )
}

function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-FileOriginInfo {
    param([string]$FilePath)
    
    $fileInfo = Get-Item $FilePath -ErrorAction SilentlyContinue
    if (-not $fileInfo) { return $null }
    
    $originInfo = @{
        Path = $FilePath
        Name = $fileInfo.Name
        Size = $fileInfo.Length
        Created = $fileInfo.CreationTime
        Modified = $fileInfo.LastWriteTime
        Accessed = $fileInfo.LastAccessTime
        Extension = $fileInfo.Extension
        Origin = "Unknown"
        Confidence = "Low"
        RiskLevel = "Unknown"
        AssociatedProgram = $null
        DigitalSignature = $null
        SystemFile = $false
        Hidden = $fileInfo.Attributes -band [System.IO.FileAttributes]::Hidden
    }
    
    # Check if it's a system file
    $systemPaths = @($env:WINDIR, $env:PROGRAMFILES, $env:PROGRAMFILES(X86))
    foreach ($sysPath in $systemPaths) {
        if ($FilePath -like "$sysPath*") {
            $originInfo.SystemFile = $true
            $originInfo.RiskLevel = "High"
            $originInfo.Origin = "Windows System"
            $originInfo.Confidence = "High"
            break
        }
    }
    
    # Digital signature analysis
    try {
        $signature = Get-AuthenticodeSignature $FilePath -ErrorAction SilentlyContinue
        if ($signature.Status -eq "Valid") {
            $originInfo.DigitalSignature = @{
                Status = $signature.Status
                SignerCertificate = $signature.SignerCertificate.Subject
                TimeStamp = $signature.TimeStamp
            }
            $originInfo.Origin = "Signed Application"
            $originInfo.Confidence = "High"
            $originInfo.RiskLevel = "Medium"
            $originInfo.AssociatedProgram = $signature.SignerCertificate.Subject
        }
    } catch {
        # No signature or unable to check
    }
    
    # File extension analysis
    $extensionMap = @{
        ".exe" = @{ Origin = "Executable"; Risk = "Medium" }
        ".dll" = @{ Origin = "Library"; Risk = "Medium" }
        ".sys" = @{ Origin = "System Driver"; Risk = "High" }
        ".msi" = @{ Origin = "Installer"; Risk = "Low" }
        ".log" = @{ Origin = "Log File"; Risk = "Low" }
        ".tmp" = @{ Origin = "Temporary"; Risk = "Low" }
        ".cache" = @{ Origin = "Cache"; Risk = "Low" }
    }
    
    if ($extensionMap.ContainsKey($originInfo.Extension)) {
        $extInfo = $extensionMap[$originInfo.Extension]
        if ($originInfo.Origin -eq "Unknown") {
            $originInfo.Origin = $extInfo.Origin
        }
        if ($originInfo.RiskLevel -eq "Unknown") {
            $originInfo.RiskLevel = $extInfo.Risk
        }
    }
    
    # Check common program locations
    $programPaths = @(
        "$env:PROGRAMFILES\*",
        "$env:PROGRAMFILES(X86)\*",
        "$env:LOCALAPPDATA\*",
        "$env:APPDATA\*"
    )
    
    foreach ($progPath in $programPaths) {
        if ($FilePath -like $progPath) {
            if ($originInfo.Origin -eq "Unknown") {
                $originInfo.Origin = "Installed Program"
                $originInfo.Confidence = "Medium"
                $originInfo.RiskLevel = "Medium"
            }
            break
        }
    }
    
    # Detailed analysis if requested
    if ($Detailed) {
        # Check for known bloat patterns
        $bloatPatterns = @(
            "*\Temp\*",
            "*\tmp\*",
            "*cache*",
            "*.old",
            "*.bak",
            "*.tmp"
        )
        
        foreach ($pattern in $bloatPatterns) {
            if ($FilePath -like $pattern) {
                $originInfo.Origin = "Potential Bloat"
                $originInfo.RiskLevel = "Low"
                $originInfo.Confidence = "Medium"
                break
            }
        }
        
        # File age analysis
        $daysOld = (Get-Date) - $originInfo.Modified
        if ($daysOld.Days -gt 365) {
            if ($originInfo.RiskLevel -eq "Unknown" -or $originInfo.RiskLevel -eq "Low") {
                $originInfo.Origin += " (Old)"
                $originInfo.Confidence = "Medium"
            }
        }
    }
    
    return $originInfo
}

function Get-DirectoryAnalysis {
    param([string]$DirectoryPath)
    
    Write-LLMLog "Starting analysis of: $DirectoryPath"
    Write-LLMLog "This may take a while for large directories..." "WARN"
    
    if (-not (Test-Path $DirectoryPath)) {
        Write-LLMLog "Directory not found: $DirectoryPath" "ERROR"
        return
    }
    
    $files = @()
    $totalSize = 0
    $fileCount = 0
    $riskDistribution = @{ "Low" = 0; "Medium" = 0; "High" = 0; "Unknown" = 0 }
    $originDistribution = @{}
    
    # Get all files with progress reporting
    $allFiles = Get-ChildItem -Path $DirectoryPath -Recurse -File -ErrorAction SilentlyContinue
    $totalFiles = $allFiles.Count
    $processed = 0
    
    Write-LLMLog "Found $totalFiles files to analyze"
    
    foreach ($file in $allFiles) {
        $processed++
        if ($processed % 100 -eq 0 -or $processed -eq $totalFiles) {
            $progress = [math]::Round(($processed / $totalFiles) * 100, 1)
            Write-LLMLog "Progress: $progress% ($processed/$totalFiles files)"
        }
        
        $originInfo = Get-FileOriginInfo -FilePath $file.FullName
        if ($originInfo) {
            $files += $originInfo
            $totalSize += $originInfo.Size
            $fileCount++
            
            # Update distributions
            $riskDistribution[$originInfo.RiskLevel]++
            $originKey = $originInfo.Origin
            if (-not $originDistribution.ContainsKey($originKey)) {
                $originDistribution[$originKey] = 0
            }
            $originDistribution[$originKey]++
        }
    }
    
    Write-LLMLog "Analysis complete!" "SUCCESS"
    Write-LLMLog "Total files analyzed: $fileCount"
    Write-LLMLog "Total size: $([math]::Round($totalSize / 1GB, 2)) GB"
    
    # Generate report
    $report = @{
        AnalysisPath = $DirectoryPath
        Timestamp = Get-Date
        Summary = @{
            TotalFiles = $fileCount
            TotalSize = $totalSize
            RiskDistribution = $riskDistribution
            OriginDistribution = $originDistribution
        }
        Files = $files
    }
    
    return $report
}

function Format-Report {
    param($Report, [string]$Format)
    
    switch ($Format) {
        "Console" {
            Write-LLMLog "=" * 60 "SUCCESS"
            Write-LLMLog "FILE ORIGIN ANALYSIS REPORT" "SUCCESS"
            Write-LLMLog "=" * 60 "SUCCESS"
            Write-Host ""
            
            Write-LLMLog "Target Directory: $($Report.AnalysisPath)"
            Write-LLMLog "Analysis Time: $($Report.Timestamp)"
            Write-Host ""
            
            Write-LLMLog "SUMMARY:" "INFO"
            Write-Host "  Total Files: $($Report.Summary.TotalFiles)"
            Write-Host "  Total Size: $([math]::Round($Report.Summary.TotalSize / 1GB, 2)) GB"
            Write-Host ""
            
            Write-LLMLog "RISK DISTRIBUTION:" "WARN"
            foreach ($risk in $Report.Summary.RiskDistribution.GetEnumerator()) {
                $percentage = if ($Report.Summary.TotalFiles -gt 0) { 
                    [math]::Round(($risk.Value / $Report.Summary.TotalFiles) * 100, 1) 
                } else { 0 }
                Write-Host "  $($risk.Key): $($risk.Value) files ($percentage%)"
            }
            Write-Host ""
            
            Write-LLMLog "ORIGIN DISTRIBUTION:" "INFO"
            foreach ($origin in $Report.Summary.OriginDistribution.GetEnumerator() | Sort-Object Value -Descending) {
                $percentage = if ($Report.Summary.TotalFiles -gt 0) { 
                    [math]::Round(($origin.Value / $Report.Summary.TotalFiles) * 100, 1) 
                } else { 0 }
                Write-Host "  $($origin.Key): $($origin.Value) files ($percentage%)"
            }
            Write-Host ""
            
            Write-LLMLog "HIGH RISK FILES (Review Carefully):" "ERROR"
            $highRiskFiles = $Report.Files | Where-Object { $_.RiskLevel -eq "High" }
            if ($highRiskFiles.Count -gt 0) {
                $highRiskFiles | ForEach-Object {
                    Write-Host "  🚨 $($_.Name)" -ForegroundColor Red
                    Write-Host "     Path: $($_.Path)"
                    Write-Host "     Origin: $($_.Origin)"
                    Write-Host "     Size: $([math]::Round($_.Size / 1MB, 2)) MB"
                    Write-Host ""
                }
            } else {
                Write-Host "  ✅ No high-risk files found!" -ForegroundColor Green
            }
            Write-Host ""
            
            Write-LLMLog "LOW RISK FILES (Safe to Delete):" "SUCCESS"
            $lowRiskFiles = $Report.Files | Where-Object { $_.RiskLevel -eq "Low" } | 
                           Sort-Object Size -Descending | Select-Object -First 10
            if ($lowRiskFiles.Count -gt 0) {
                $lowRiskFiles | ForEach-Object {
                    Write-Host "  ✅ $($_.Name)" -ForegroundColor Green
                    Write-Host "     Path: $($_.Path)"
                    Write-Host "     Origin: $($_.Origin)"
                    Write-Host "     Size: $([math]::Round($_.Size / 1MB, 2)) MB"
                    Write-Host "     Age: $(((Get-Date) - $_.Modified).Days) days"
                    Write-Host ""
                }
            } else {
                Write-Host "  No low-risk files found for cleanup"
            }
        }
        
        "JSON" {
            $Report | ConvertTo-Json -Depth 10
        }
        
        "CSV" {
            $Report.Files | ConvertTo-Csv -NoTypeInformation
        }
    }
}

# Main execution
Write-LLMLog "File Origin Analyzer v1.0" "SUCCESS"
Write-LLMLog "Target: $Path" "INFO"

# Check admin privileges for better analysis
if (-not (Test-AdminPrivileges)) {
    Write-LLMLog "Running without admin privileges - some analysis may be limited" "WARN"
}

# Perform analysis
$analysisResult = Get-DirectoryAnalysis -DirectoryPath $Path

if ($analysisResult) {
    Format-Report -Report $analysisResult -Format $OutputFormat
} else {
    Write-LLMLog "Analysis failed" "ERROR"
}

Write-LLMLog "Analysis complete!" "SUCCESS"
