<#
.SYNOPSIS
    Safe Cleanup Assistant - Intelligent file cleanup with safety checks
    
.DESCRIPTION
    Analyzes directories for safe cleanup opportunities with detailed impact analysis.
    Prioritizes user safety with comprehensive backup and rollback recommendations.
    
.AUTHOR
    LLM System Tools
    
.VERSION
    1.0
    
.PARAMETER TargetPath
        Directory to analyze for cleanup
        
.PARAMETER RiskThreshold
        Maximum risk level to consider for cleanup (Low, Medium, High)
        
.PARAMETER MinSizeMB
        Minimum file size in MB to consider for cleanup
        
.PARAMETER DryRun
        Show what would be deleted without actually deleting
        
.PARAMETER CreateBackup
        Create backup before deletion
        
.PARAMETER OutputFormat
        Output format: Console, JSON, CSV
        
.EXAMPLE
    .\SafeCleanupAssistant.ps1 -TargetPath "C:\Users\Aomega Imaging" -DryRun
    
.EXAMPLE
    .\SafeCleanupAssistant.ps1 -TargetPath "C:\Users\Aomega Imaging" -RiskThreshold Low -CreateBackup
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$TargetPath,
    
    [ValidateSet("Low", "Medium", "High")]
    [string]$RiskThreshold = "Low",
    
    [int]$MinSizeMB = 1,
    
    [switch]$DryRun,
    
    [switch]$CriticalBackupOnly,
    
    [ValidateSet("Console", "JSON", "CSV")]
    [string]$OutputFormat = "Console"
)

# Enhanced logging
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $colors = @{
        "INFO" = "White"
        "WARN" = "Yellow" 
        "ERROR" = "Red"
        "SUCCESS" = "Green"
        "CRITICAL" = "Magenta"
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $colors[$Level]
}

function Test-SystemCriticality {
    param([string]$FilePath)
    
    $criticalPaths = @(
        "$env:WINDIR",
        "$env:PROGRAMFILES",
        "$env:PROGRAMFILES(X86)",
        "$env:SYSTEMROOT"
    )
    
    foreach ($criticalPath in $criticalPaths) {
        if ($FilePath -like "$criticalPath*") {
            return @{
                IsCritical = $true
                Reason = "System directory"
                RiskLevel = "High"
            }
        }
    }
    
    # Check for system file extensions
    $criticalExtensions = @(".sys", ".dll", ".exe", ".com", ".bat", ".cmd", ".ps1", ".reg")
    $extension = [System.IO.Path]::GetExtension($FilePath).ToLower()
    
    if ($criticalExtensions -contains $extension) {
        # Additional checks for non-system locations
        $userPaths = @("$env:USERPROFILE", "$env:LOCALAPPDATA", "$env:APPDATA")
        $isInUserPath = $false
        
        foreach ($userPath in $userPaths) {
            if ($FilePath -like "$userPath*") {
                $isInUserPath = $true
                break
            }
        }
        
        if (-not $isInUserPath) {
            return @{
                IsCritical = $true
                Reason = "System executable in non-user directory"
                RiskLevel = "High"
            }
        }
    }
    
    return @{
        IsCritical = $false
        Reason = $null
        RiskLevel = "Unknown"
    }
}

function Get-InstalledPrograms {
    # Get list of installed programs for dependency checking
    $programs = @()
    
    # Registry paths for installed programs
    $registryPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    
    foreach ($path in $registryPaths) {
        try {
            $programs += Get-ItemProperty $path -ErrorAction SilentlyContinue | 
                        Where-Object { $_.DisplayName } | 
                        Select-Object DisplayName, InstallLocation, Publisher
        } catch {
            # Skip inaccessible registry keys
        }
    }
    
    return $programs
}

function Get-ApplicationOriginAnalysis {
    param([string]$FilePath)
    
    $originAnalysis = @{
        FilePath = $FilePath
        SourceApplications = @()
        InstallationPaths = @()
        ProcessNames = @()
        ServiceNames = @()
        ScheduledTasks = @()
        RegistryKeys = @()
        ConfigurationFiles = @()
        LogFiles = @()
        TempDirectories = @()
        CacheDirectories = @()
        AutoRunLocations = @()
        ShellExtensions = @()
        ContextMenuHandlers = @()
        FileWatchers = @()
        RegenerationMechanisms = @()
        InstallationSources = @()
        DownloadSources = @()
        CreationMethods = @()
        ApplicationSignatures = @()
        VersionInfo = @()
        PublisherInfo = @()
        InstallationDates = @()
        LastModifiedBy = @()
        DigitalSignatures = @()
        Certificates = @()
    }
    
    $fileName = [System.IO.Path]::GetFileName($FilePath).ToLower()
    $fileDir = [System.IO.Path]::GetDirectoryName($FilePath).ToLower()
    $extension = [System.IO.Path]::GetExtension($FilePath).ToLower()
    $fileSize = (Get-Item $FilePath -ErrorAction SilentlyContinue).Length
    
    # 1. Check against all installed programs
    $installedPrograms = Get-InstalledPrograms
    foreach ($program in $installedPrograms) {
        if ($program.InstallLocation) {
            # Check if file is within program directory
            if ($FilePath -like "$($program.InstallLocation)*") {
                $originAnalysis.SourceApplications += @{
                    Name = $program.DisplayName
                    Publisher = $program.Publisher
                    InstallLocation = $program.InstallLocation
                    InstallDate = $program.InstallDate
                    Confidence = "High"
                    MatchType = "Directory Match"
                }
                $originAnalysis.InstallationPaths += $program.InstallLocation
            }
            
            # Check for common program file patterns
            $programPatterns = @(
                "*$($program.DisplayName)*",
                "*$($program.DisplayName.Replace(' ', ''))*",
                "*$($program.DisplayName.Replace('.', ''))*"
            )
            
            foreach ($pattern in $programPatterns) {
                if ($fileName -like $pattern.ToLower()) {
                    $originAnalysis.SourceApplications += @{
                        Name = $program.DisplayName
                        Publisher = $program.Publisher
                        InstallLocation = $program.InstallLocation
                        InstallDate = $program.InstallDate
                        Confidence = "Medium"
                        MatchType = "Filename Pattern"
                    }
                }
            }
        }
    }
    
    # 2. Check for running processes that might create this file
    try {
        $processes = Get-Process -ErrorAction SilentlyContinue
        foreach ($process in $processes) {
            $processPath = $process.Path
            if ($processPath) {
                # Check if process directory matches file directory
                $processDir = [System.IO.Path]::GetDirectoryName($processPath).ToLower()
                if ($fileDir.StartsWith($processDir) -or $processDir.StartsWith($fileDir)) {
                    $originAnalysis.ProcessNames += @{
                        Name = $process.ProcessName
                        Path = $processPath
                        PID = $process.Id
                        StartTime = $process.StartTime
                        Confidence = "High"
                        MatchType = "Process Directory Match"
                    }
                }
                
                # Check if process name matches file pattern
                if ($fileName -like "*$($process.ProcessName.ToLower())*") {
                    $originAnalysis.ProcessNames += @{
                        Name = $process.ProcessName
                        Path = $processPath
                        PID = $process.Id
                        StartTime = $process.StartTime
                        Confidence = "Medium"
                        MatchType = "Process Name Pattern"
                    }
                }
            }
        }
    } catch {
        # Process enumeration may fail
    }
    
    # 3. Check Windows Services
    try {
        $services = Get-WmiObject -Class Win32_Service -ErrorAction SilentlyContinue
        foreach ($service in $services) {
            if ($service.PathName) {
                $servicePath = $service.PathName -replace '"', ''
                $serviceDir = [System.IO.Path]::GetDirectoryName($servicePath).ToLower()
                
                if ($fileDir.StartsWith($serviceDir) -or $serviceDir.StartsWith($fileDir)) {
                    $originAnalysis.ServiceNames += @{
                        Name = $service.Name
                        DisplayName = $service.DisplayName
                        PathName = $service.PathName
                        State = $service.State
                        StartMode = $service.StartMode
                        Confidence = "High"
                        MatchType = "Service Directory Match"
                    }
                }
            }
        }
    } catch {
        # WMI may not be accessible
    }
    
    # 4. Check Scheduled Tasks
    try {
        $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue
        foreach ($task in $tasks) {
            if ($task.Actions -and $task.Actions.Execute) {
                $taskPath = $task.Actions.Execute
                $taskDir = [System.IO.Path]::GetDirectoryName($taskPath).ToLower()
                
                if ($fileDir.StartsWith($taskDir) -or $taskDir.StartsWith($fileDir)) {
                    $originAnalysis.ScheduledTasks += @{
                        TaskName = $task.TaskName
                        Execute = $task.Actions.Execute
                        WorkingDirectory = $task.Actions.WorkingDirectory
                        State = $task.State
                        Confidence = "High"
                        MatchType = "Task Directory Match"
                    }
                }
            }
        }
    } catch {
        # Scheduled tasks may not be accessible
    }
    
    # 5. Check Registry for file associations and auto-run entries
    $registryPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
    )
    
    foreach ($regPath in $registryPaths) {
        try {
            $properties = Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue
            if ($properties) {
                foreach ($prop in $properties.PSObject.Properties) {
                    if ($prop.Value -and $prop.Value -is [string]) {
                        if ($prop.Value -like "*$FilePath*" -or $prop.Value -like "*$fileDir*") {
                            $originAnalysis.AutoRunLocations += @{
                                RegistryPath = $regPath
                                PropertyName = $prop.Name
                                Value = $prop.Value
                                Confidence = "High"
                                MatchType = "Registry AutoRun"
                            }
                        }
                    }
                }
            }
        } catch {
            # Registry access may be restricted
        }
    }
    
    # 6. Check for shell extensions and context menu handlers
    $shellPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\ShellEx\ContextMenuHandlers",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\ShellEx\ContextMenuHandlers",
        "HKLM:\SOFTWARE\Classes\*\shellex\ContextMenuHandlers",
        "HKCU:\SOFTWARE\Classes\*\shellex\ContextMenuHandlers"
    )
    
    foreach ($shellPath in $shellPaths) {
        try {
            $handlers = Get-ChildItem -Path $shellPath -ErrorAction SilentlyContinue
            foreach ($handler in $handlers) {
                $defaultVal = (Get-ItemProperty -Path $handler.PSPath -ErrorAction SilentlyContinue)."(default)"
                if ($defaultVal) {
                    try {
                        $handlerPath = "HKLM:\SOFTWARE\Classes\CLSID\$defaultVal"
                        $handlerInfo = Get-ItemProperty -Path $handlerPath -ErrorAction SilentlyContinue
                        if ($handlerInfo) {
                            $inprocServer = $handlerInfo."InprocServer32"
                            if ($inprocServer -and ($inprocServer -like "*$FilePath*" -or $inprocServer -like "*$fileDir*")) {
                                $originAnalysis.ShellExtensions += @{
                                    HandlerName = $handler.Name
                                    CLSID = $defaultVal
                                    InprocServer = $inprocServer
                                    Confidence = "Medium"
                                    MatchType = "Shell Extension"
                                }
                            }
                        }
                    } catch {
                        # CLSID lookup may fail
                    }
                }
            }
        } catch {
            # Shell extension enumeration may fail
        }
    }
    
    # 7. Check for file watchers and monitoring services
    try {
        # Check for common file monitoring patterns
        $monitoringServices = Get-Service -ErrorAction SilentlyContinue | Where-Object { 
            $_.Name -like "*monitor*" -or 
            $_.Name -like "*watch*" -or 
            $_.Name -like "*sync*" -or
            $_.Name -like "*backup*" -or
            $_.Name -like "*index*"
        }
        
        foreach ($service in $monitoringServices) {
            $originAnalysis.FileWatchers += @{
                ServiceName = $service.Name
                DisplayName = $service.DisplayName
                Status = $service.Status
                Confidence = "Low"
                MatchType = "File Monitoring Service"
            }
        }
    } catch {
        # Service enumeration may fail
    }
    
    # 8. Check digital signatures and certificates
    try {
        $signature = Get-AuthenticodeSignature $FilePath -ErrorAction SilentlyContinue
        if ($signature -and $signature.Status -eq "Valid") {
            $originAnalysis.DigitalSignatures += @{
                Status = $signature.Status
                SignerCertificate = $signature.SignerCertificate.Subject
                TimeStamp = $signature.TimeStamp
                CertificateChain = $signature.SignerCertificate
                Confidence = "High"
                MatchType = "Digital Signature"
            }
            
            # Extract publisher info from certificate
            if ($signature.SignerCertificate) {
                $originAnalysis.PublisherInfo += @{
                    Subject = $signature.SignerCertificate.Subject
                    Issuer = $signature.SignerCertificate.Issuer
                    ValidFrom = $signature.SignerCertificate.NotBefore
                    ValidTo = $signature.SignerCertificate.NotAfter
                    SerialNumber = $signature.SignerCertificate.SerialNumber
                }
            }
        }
    } catch {
        # Signature check may fail
    }
    
    # 9. Check for common application-specific patterns
    $appPatterns = @{
        "Microsoft Office" = @("*.docx", "*.xlsx", "*.pptx", "*.tmp", "~$*", "*.asd")
        "Adobe" = @("*.tmp", "*.cache", "*.log", "*.bak")
        "Google Chrome" = @("*.tmp", "*.cache", "*.log", "*.bak")
        "Mozilla Firefox" = @("*.tmp", "*.cache", "*.log", "*.bak")
        "Visual Studio" = @("*.tmp", "*.cache", "*.log", "*.bak", "*.suo", "*.user")
        "Node.js" = @("*.tmp", "*.log", "node_modules")
        "Python" = @("*.pyc", "*.pyo", "__pycache__", "*.tmp")
        "Java" = @("*.class", "*.jar", "*.tmp", "*.log")
        "Docker" = @("*.tmp", "*.log", "docker")
        "Git" = @("*.tmp", "*.log", ".git")
        "Steam" = @("*.tmp", "*.log", "*.cache")
        "Discord" = @("*.tmp", "*.cache", "*.log")
        "Slack" = @("*.tmp", "*.cache", "*.log")
        "Zoom" = @("*.tmp", "*.cache", "*.log")
        "Teams" = @("*.tmp", "*.cache", "*.log")
    }
    
    foreach ($appName in $appPatterns.Keys) {
        $patterns = $appPatterns[$appName]
        foreach ($pattern in $patterns) {
            if ($fileName -like $pattern) {
                $originAnalysis.ApplicationSignatures += @{
                    Application = $appName
                    Pattern = $pattern
                    Confidence = "Medium"
                    MatchType = "Application File Pattern"
                }
            }
        }
    }
    
    # 10. Check for regeneration mechanisms
    $regenerationMechanisms = @()
    
    # Check if file is in a known regeneration directory
    $regenerationDirs = @(
        "$env:TEMP",
        "$env:TMP",
        "$env:LOCALAPPDATA\Temp",
        "$env:APPDATA\Temp",
        "$env:WINDIR\Temp",
        "$env:USERPROFILE\AppData\Local\Temp",
        "$env:USERPROFILE\AppData\Roaming\Temp"
    )
    
    foreach ($regenDir in $regenerationDirs) {
        if ($fileDir.StartsWith($regenDir.ToLower())) {
            $regenerationMechanisms += @{
                Type = "Temporary Directory"
                Path = $regenDir
                Mechanism = "System or application temp file recreation"
                Likelihood = "High"
            }
        }
    }
    
    # Check for cache directories
    $cacheDirs = @(
        "$env:LOCALAPPDATA\Microsoft\Windows\INetCache",
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache",
        "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles\*\cache2",
        "$env:LOCALAPPDATA\Adobe",
        "$env:APPDATA\Adobe"
    )
    
    foreach ($cacheDir in $cacheDirs) {
        if ($fileDir -like $cacheDir) {
            $regenerationMechanisms += @{
                Type = "Cache Directory"
                Path = $cacheDir
                Mechanism = "Application cache regeneration"
                Likelihood = "High"
            }
        }
    }
    
    $originAnalysis.RegenerationMechanisms = $regenerationMechanisms
    
    # 11. Determine creation method and source
    $creationMethods = @()
    
    # Check file creation patterns
    if ($fileName -like "tmp*") {
        $creationMethods += @{
            Method = "Temporary File Creation"
            Source = "System or Application"
            Likelihood = "High"
        }
    }
    
    if ($fileName -like "~$*") {
        $creationMethods += @{
            Method = "Office Application Backup"
            Source = "Microsoft Office"
            Likelihood = "High"
        }
    }
    
    if ($extension -eq ".log") {
        $creationMethods += @{
            Method = "Logging"
            Source = "Application or Service"
            Likelihood = "Medium"
        }
    }
    
    $originAnalysis.CreationMethods = $creationMethods
    
    # 12. Calculate confidence scores
    $totalMatches = $originAnalysis.SourceApplications.Count + 
                   $originAnalysis.ProcessNames.Count + 
                   $originAnalysis.ServiceNames.Count + 
                   $originAnalysis.ScheduledTasks.Count +
                   $originAnalysis.DigitalSignatures.Count
    
    if ($totalMatches -ge 2) {
        $originAnalysis.OverallConfidence = "Very High"
    } elseif ($totalMatches -eq 1) {
        $originAnalysis.OverallConfidence = "High"
    } elseif ($originAnalysis.ApplicationSignatures.Count -gt 0) {
        $originAnalysis.OverallConfidence = "Medium"
    } else {
        $originAnalysis.OverallConfidence = "Low"
    }
    
    return $originAnalysis
}

function Get-SystemImpactAnalysis {
    param([string]$FilePath)
    
    $impact = @{
        FilePath = $FilePath
        ImpactLevel = "Unknown"
        AffectedComponents = @()
        SystemServices = @()
        RegistryKeys = @()
        StartupItems = @()
        ScheduledTasks = @()
        Shortcuts = @()
        FileAssociations = @()
        Consequences = @()
        RecoveryOptions = @()
        Criticality = "Low"
    }
    
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath).ToLower()
    $fileDir = [System.IO.Path]::GetDirectoryName($FilePath).ToLower()
    $extension = [System.IO.Path]::GetExtension($FilePath).ToLower()
    
    # Check for critical system files
    $criticalPatterns = @(
        "*\system32\*", "*\syswow64\*", "*\drivers\*", "*\driverstore\*"
    )
    
    foreach ($pattern in $criticalPatterns) {
        if ($FilePath -like $pattern) {
            $impact.Criticality = "Critical"
            $impact.ImpactLevel = "Severe"
            $impact.AffectedComponents += "Windows Core System"
            $impact.Consequences += "SYSTEM FAILURE: May prevent Windows from starting"
            $impact.RecoveryOptions += "Windows Repair/Recovery Console"
            $impact.RecoveryOptions += "System Restore"
            return $impact
        }
    }
    
    # Check for program files
    if ($FilePath -like "$env:PROGRAMFILES*" -or $FilePath -like "$env:PROGRAMFILES(X86)*") {
        $impact.Criticality = "High"
        $impact.ImpactLevel = "High"
        $impact.AffectedComponents += "Installed Application"
        
        # Try to identify the specific program
        $programDir = Split-Path (Split-Path $FilePath -Parent) -Parent
        if (Test-Path $programDir) {
            $programName = Split-Path $programDir -Leaf
            $impact.AffectedComponents += $programName
            
            # Check for uninstaller
            $uninstaller = Join-Path $programDir "unins*.exe"
            if (Test-Path $uninstaller) {
                $impact.RecoveryOptions += "Reinstall from: $programName installer"
            }
        }
        
        $impact.Consequences += "Application may malfunction or fail to start"
        $impact.RecoveryOptions += "Reinstall affected application"
    }
    
    # Check for startup items
    $startupPaths = @(
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup",
        "$env:PROGRAMDATA\Microsoft\Windows\Start Menu\Programs\Startup",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
    )
    
    foreach ($startupPath in $startupPaths) {
        if ($FilePath -like "$startupPath*" -or ($startupPath.StartsWith("HK") -and (Get-ItemProperty -Path $startupPath -ErrorAction SilentlyContinue).PSObject.Properties.Value -contains $FilePath)) {
            $impact.Criticality = "Medium"
            $impact.ImpactLevel = "Medium"
            $impact.AffectedComponents += "Windows Startup"
            $impact.StartupItems += $FilePath
            $impact.Consequences += "Program may not start automatically with Windows"
            $impact.RecoveryOptions += "Manually add to startup or reinstall program"
        }
    }
    
    # Check for scheduled tasks
    try {
        $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue
        foreach ($task in $tasks) {
            if ($task.Actions -and $task.Actions.Execute) {
                if ($task.Actions.Execute -like "*$FilePath*" -or $task.Actions.WorkingDirectory -like "*$([System.IO.Path]::GetDirectoryName($FilePath))*") {
                    $impact.Criticality = "Medium"
                    $impact.ImpactLevel = "Medium"
                    $impact.AffectedComponents += "Scheduled Task: $($task.TaskName)"
                    $impact.ScheduledTasks += $task.TaskName
                    $impact.Consequences += "Automated task may fail"
                    $impact.RecoveryOptions += "Recreate scheduled task"
                }
            }
        }
    } catch {
        # Scheduled tasks may not be accessible
    }
    
    # Check for services
    if ($extension -eq ".exe" -or $extension -eq ".dll") {
        try {
            $services = Get-WmiObject -Class Win32_Service -ErrorAction SilentlyContinue
            foreach ($service in $services) {
                if ($service.PathName -like "*$FilePath*" -or $service.PathName -like "*$fileName*") {
                    $impact.Criticality = "High"
                    $impact.ImpactLevel = "High"
                    $impact.AffectedComponents += "Windows Service: $($service.Name)"
                    $impact.SystemServices += $service.Name
                    $impact.Consequences += "Service may fail to start, affecting dependent services"
                    $impact.RecoveryOptions += "Service repair: sc config $($service.Name) start= auto"
                    $impact.RecoveryOptions += "System Restore"
                }
            }
        } catch {
            # WMI may not be accessible
        }
    }
    
    # Check for file associations
    if ($extension -ne "") {
        try {
            $assoc = Get-ItemProperty "HKCU:\SOFTWARE\Classes\$extension" -ErrorAction SilentlyContinue
            if ($assoc) {
                $impact.FileAssociations += $extension
                $impact.Criticality = "Medium"
                $impact.ImpactLevel = "Low"
                $impact.AffectedComponents += "File Association: .$extension"
                $impact.Consequences += "Files with .$extension may not open correctly"
                $impact.RecoveryOptions += "Reset file associations in Settings"
            }
        } catch {
            # Registry access may be restricted
        }
    }
    
    # Check for shortcuts
    try {
        $shortcuts = Get-ChildItem -Path "$env:USERPROFILE\Desktop" -Filter "*.lnk" -ErrorAction SilentlyContinue
        $shortcuts += Get-ChildItem -Path "$env:APPDATA\Microsoft\Windows\Start Menu\Programs" -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue
        
        foreach ($shortcut in $shortcuts) {
            $shell = New-Object -ComObject WScript.Shell
            $shortcutObj = $shell.CreateShortcut($shortcut.FullName)
            if ($shortcutObj.TargetPath -eq $FilePath) {
                $impact.Shortcuts += $shortcut.FullName
                $impact.Criticality = "Low"
                $impact.ImpactLevel = "Low"
                $impact.AffectedComponents += "Shortcut: $($shortcut.Name)"
                $impact.Consequences += "Shortcut will be broken"
                $impact.RecoveryOptions += "Update or remove shortcut"
            }
        }
    } catch {
        # COM objects may not be available
    }
    
    # Determine overall impact level
    if ($impact.Criticality -eq "Critical") {
        $impact.ImpactLevel = "Severe"
    } elseif ($impact.AffectedComponents.Count -gt 3) {
        $impact.ImpactLevel = "High"
    } elseif ($impact.AffectedComponents.Count -gt 0) {
        $impact.ImpactLevel = "Medium"
    } else {
        $impact.ImpactLevel = "Low"
        $impact.Criticality = "Low"
        $impact.Consequences += "No significant system impact expected"
        $impact.RecoveryOptions += "File can be safely deleted"
    }
    
    return $impact
}

function Test-ProgramDependency {
    param([string]$FilePath, [array]$InstalledPrograms)
    
    foreach ($program in $InstalledPrograms) {
        if ($program.InstallLocation -and $FilePath -like "$($program.InstallLocation)*") {
            return @{
                IsDependent = $true
                ProgramName = $program.DisplayName
                Publisher = $program.Publisher
                RiskLevel = "Medium"
            }
        }
    }
    
    return @{
        IsDependent = $false
        ProgramName = $null
        Publisher = $null
        RiskLevel = "Low"
    }
}

function Get-FileSafetyAnalysis {
    param([string]$FilePath, [array]$InstalledPrograms)
    
    $fileInfo = Get-Item $FilePath -ErrorAction SilentlyContinue
    if (-not $fileInfo) { return $null }
    
    # Get comprehensive impact analysis
    $impactAnalysis = Get-SystemImpactAnalysis -FilePath $FilePath
    
    # Get comprehensive application origin analysis
    $originAnalysis = Get-ApplicationOriginAnalysis -FilePath $FilePath
    
    $analysis = @{
        Path = $FilePath
        Name = $fileInfo.Name
        Size = $fileInfo.Length
        SizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
        Created = $fileInfo.CreationTime
        Modified = $fileInfo.LastWriteTime
        Accessed = $fileInfo.LastAccessTime
        Extension = $fileInfo.Extension.ToLower()
        DaysOld = ((Get-Date) - $fileInfo.LastWriteTime).Days
        IsSafeToDelete = $false
        RiskLevel = $impactAnalysis.Criticality
        Reason = ""
        Recommendations = @()
        
        # Impact Analysis Results
        ImpactLevel = $impactAnalysis.ImpactLevel
        AffectedComponents = $impactAnalysis.AffectedComponents
        SystemServices = $impactAnalysis.SystemServices
        StartupItems = $impactAnalysis.StartupItems
        ScheduledTasks = $impactAnalysis.ScheduledTasks
        Shortcuts = $impactAnalysis.Shortcuts
        FileAssociations = $impactAnalysis.FileAssociations
        Consequences = $impactAnalysis.Consequences
        RecoveryOptions = $impactAnalysis.RecoveryOptions
        
        # Application Origin Analysis Results
        SourceApplications = $originAnalysis.SourceApplications
        ProcessNames = $originAnalysis.ProcessNames
        ServiceNames = $originAnalysis.ServiceNames
        RegenerationMechanisms = $originAnalysis.RegenerationMechanisms
        CreationMethods = $originAnalysis.CreationMethods
        DigitalSignatures = $originAnalysis.DigitalSignatures
        PublisherInfo = $originAnalysis.PublisherInfo
        ApplicationSignatures = $originAnalysis.ApplicationSignatures
        AutoRunLocations = $originAnalysis.AutoRunLocations
        ShellExtensions = $originAnalysis.ShellExtensions
        FileWatchers = $originAnalysis.FileWatchers
        OverallConfidence = $originAnalysis.OverallConfidence
    }
    
    # Determine safety based on impact and origin analysis
    if ($impactAnalysis.Criticality -eq "Critical") {
        $analysis.IsSafeToDelete = $false
        $analysis.Reason = "CRITICAL SYSTEM FILE - Deleting may prevent Windows from starting"
        $analysis.Recommendations += "DO NOT DELETE - Critical system component"
        $analysis.Recommendations += "Use Windows System Restore if issues occur"
    } elseif ($impactAnalysis.Criticality -eq "High") {
        $analysis.IsSafeToDelete = $false
        $analysis.Reason = "High impact on system functionality"
        if ($impactAnalysis.SystemServices.Count -gt 0) {
            $analysis.Reason += " - Affects Windows services: $($impactAnalysis.SystemServices -join ', ')"
        }
        if ($originAnalysis.SourceApplications.Count -gt 0) {
            $analysis.Reason += " - Part of: $($originAnalysis.SourceApplications[0].Name)"
        }
        $analysis.Recommendations += "Manual review required before deletion"
        $analysis.Recommendations += "Consider uninstalling through Programs & Features"
    } elseif ($impactAnalysis.Criticality -eq "Medium") {
        $analysis.IsSafeToDelete = $false
        $analysis.Reason = "Medium impact - affects installed programs or startup"
        if ($originAnalysis.SourceApplications.Count -gt 0) {
            $analysis.Reason += " - Part of: $($originAnalysis.SourceApplications[0].Name)"
        }
        if ($originAnalysis.RegenerationMechanisms.Count -gt 0) {
            $analysis.Reason += " - May regenerate: $($originAnalysis.RegenerationMechanisms[0].Type)"
        }
        $analysis.Recommendations += "Review affected components before deletion"
        $analysis.Recommendations += "May need to reinstall affected applications"
        if ($originAnalysis.RegenerationMechanisms.Count -gt 0) {
            $analysis.Recommendations += "File may regenerate after deletion"
        }
    } else {
        # Low criticality - check if it's safe to delete
        $analysis.IsSafeToDelete = $true
        $analysis.Reason = "Low system impact - safe to delete"
        
        # Additional safety checks for low-risk files
        $safePatterns = @(
            "*.tmp", "*.temp", "*.old", "*.bak", "*.backup",
            "*~", "*.log", "*.cache", "*.swp", "*.dmp",
            "thumbs.db", "desktop.ini", ".DS_Store"
        )
        
        $fileName = $fileInfo.Name.ToLower()
        $isSafePattern = $false
        foreach ($pattern in $safePatterns) {
            if ($fileName -like $pattern) {
                $isSafePattern = $true
                break
            }
        }
        
        if ($isSafePattern) {
            $analysis.Reason = "Safe temporary file - no system impact"
            $analysis.Recommendations += "Safe to delete - temporary file"
        } elseif ($analysis.DaysOld -gt 365) {
            $analysis.Reason = "Old unused file - safe to delete"
            $analysis.Recommendations += "Safe to delete - old file ($(analysis.DaysOld) days)"
        } elseif ($analysis.SizeMB -lt 1) {
            $analysis.Reason = "Small file - minimal impact"
            $analysis.Recommendations += "Safe to delete - small file"
        }
        
        # Add regeneration warnings if applicable
        if ($originAnalysis.RegenerationMechanisms.Count -gt 0) {
            $analysis.Reason += " - May regenerate after deletion"
            $analysis.Recommendations += "WARNING: File may be recreated by $($originAnalysis.RegenerationMechanisms[0].Mechanism)"
        }
    }
    
    return $analysis
}
function Get-CleanupCandidates {
    param([string]$Path, [string]$RiskThreshold, [int]$MinSizeMB)
    
    Write-Log "Scanning for cleanup candidates in: $Path"
    Write-Log "Risk threshold: $RiskThreshold, Minimum size: ${MinSizeMB}MB"
    
    $installedPrograms = Get-InstalledPrograms
    Write-Log "Found $($installedPrograms.Count) installed programs for dependency checking"
    
    $candidates = @()
    $totalScanned = 0
    $totalSize = 0
    
    $files = Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue
    Write-Log "Found $($files.Count) files to analyze"
    
    $riskOrder = @{ "Low" = 1; "Medium" = 2; "High" = 3 }
    $maxRiskLevel = $riskOrder[$RiskThreshold]
    
    foreach ($file in $files) {
        $totalScanned++
        
        if ($totalScanned % 100 -eq 0) {
            Write-Log "Scanned $totalScanned files..."
        }
        
        $analysis = Get-FileSafetyAnalysis -FilePath $file.FullName -InstalledPrograms $installedPrograms
        
        if ($analysis -and $analysis.SizeMB -ge $MinSizeMB) {
            $fileRiskLevel = $riskOrder[$analysis.RiskLevel]
            if ($fileRiskLevel -le $maxRiskLevel) {
                $candidates += $analysis
                $totalSize += $analysis.Size
            }
        }
    }
    
    Write-Log "Analysis complete. Found $($candidates.Count) cleanup candidates"
    Write-Log "Total potential cleanup: $([math]::Round($totalSize / 1GB, 2)) GB"
    
    return @{
        Candidates = $candidates | Sort-Object Size -Descending
        Summary = @{
            TotalScanned = $totalScanned
            CandidatesFound = $candidates.Count
            TotalSize = $totalSize
            RiskThreshold = $RiskThreshold
            MinSizeMB = $MinSizeMB
        }
    }
}

function Show-CleanupReport {
    param($CleanupData, [string]$OutputFormat)
    
    $candidates = $CleanupData.Candidates
    $summary = $CleanupData.Summary
    
    switch ($OutputFormat) {
        "Console" {
            Write-Log "=" * 70 "SUCCESS"
            Write-Log "SAFE CLEANUP ASSISTANT REPORT" "SUCCESS"
            Write-Log "=" * 70 "SUCCESS"
            Write-Host ""
            
            Write-Log "Target Directory: $TargetPath"
            Write-Log "Analysis Time: $(Get-Date)"
            Write-Log "Risk Threshold: $($summary.RiskThreshold)"
            Write-Log "Minimum Size: $($summary.MinSizeMB)MB"
            Write-Host ""
            
            Write-Log "ANALYSIS SUMMARY:" "INFO"
            Write-Host "  Files Scanned: $($summary.TotalScanned)"
            Write-Host "  Cleanup Candidates: $($summary.CandidatesFound)"
            Write-Host "  Potential Space Saved: $([math]::Round($summary.TotalSize / 1GB, 2)) GB"
            Write-Host ""
            
            # Group by risk level
            $riskGroups = $candidates | Group-Object RiskLevel
            foreach ($group in $riskGroups) {
                $groupSize = ($group.Group | Measure-Object -Property Size -Sum).Sum
                Write-Log "$($group.Name) RISK FILES: $($group.Count) files, $([math]::Round($groupSize / 1MB, 2)) MB" $(if($group.Name -eq "High") { "ERROR" } elseif($group.Name -eq "Medium") { "WARN" } else { "SUCCESS" })
            }
            Write-Host ""
            
            # Show safe candidates first
            $safeCandidates = $candidates | Where-Object { $_.IsSafeToDelete } | Select-Object -First 20
            if ($safeCandidates.Count -gt 0) {
                Write-Log "SAFE TO DELETE (Top 20 by size):" "SUCCESS"
                foreach ($candidate in $safeCandidates) {
                    Write-Host "  ✅ $($candidate.Name)" -ForegroundColor Green
                    Write-Host "     Size: $($candidate.SizeMB) MB | Age: $($candidate.DaysOld) days | Impact: $($candidate.ImpactLevel)"
                    Write-Host "     Reason: $($candidate.Reason)"
                    Write-Host "     Path: $($candidate.Path)"
                    if ($candidate.AffectedComponents.Count -gt 0) {
                        Write-Host "     Affects: $($candidate.AffectedComponents -join ', ')" -ForegroundColor Cyan
                    }
                    Write-Host ""
                }
            }
            
            # Show risky candidates with detailed impact and origin
            $riskyCandidates = $candidates | Where-Object { -not $_.IsSafeToDelete }
            if ($riskyCandidates.Count -gt 0) {
                Write-Log "REQUIRES MANUAL REVIEW:" "WARN"
                foreach ($candidate in $riskyCandidates | Select-Object -First 10) {
                    $color = if ($candidate.RiskLevel -eq "Critical") { "Red" } elseif ($candidate.RiskLevel -eq "High") { "Yellow" } else { "Cyan" }
                    Write-Host "  ⚠️ $($candidate.Name)" -ForegroundColor $color
                    Write-Host "     Size: $($candidate.SizeMB) MB | Risk: $($candidate.RiskLevel) | Impact: $($candidate.ImpactLevel) | Age: $($candidate.DaysOld) days"
                    Write-Host "     Reason: $($candidate.Reason)"
                    
                    # Show source applications
                    if ($candidate.SourceApplications.Count -gt 0) {
                        Write-Host "     🔍 SOURCE APPLICATIONS:" -ForegroundColor Green
                        foreach ($app in $candidate.SourceApplications) {
                            Write-Host "       • $($app.Name) by $($app.Publisher)" -ForegroundColor DarkGreen
                            Write-Host "         Installed: $($app.InstallLocation)" -ForegroundColor DarkGray
                            Write-Host "         Confidence: $($app.Confidence) ($($app.MatchType))" -ForegroundColor DarkGray
                        }
                    }
                    
                    # Show running processes
                    if ($candidate.ProcessNames.Count -gt 0) {
                        Write-Host "     🔄 RUNNING PROCESSES:" -ForegroundColor Magenta
                        foreach ($process in $candidate.ProcessNames) {
                            Write-Host "       • $($process.Name) (PID: $($process.PID))" -ForegroundColor DarkMagenta
                            Write-Host "         Path: $($process.Path)" -ForegroundColor DarkGray
                            Write-Host "         Started: $($process.StartTime)" -ForegroundColor DarkGray
                        }
                    }
                    
                    # Show regeneration mechanisms
                    if ($candidate.RegenerationMechanisms.Count -gt 0) {
                        Write-Host "     🔄 REGENERATION MECHANISMS:" -ForegroundColor Yellow
                        foreach ($mechanism in $candidate.RegenerationMechanisms) {
                            Write-Host "       • $($mechanism.Type): $($mechanism.Mechanism)" -ForegroundColor DarkYellow
                            Write-Host "         Likelihood: $($mechanism.Likelihood)" -ForegroundColor DarkGray
                            if ($mechanism.Path) {
                                Write-Host "         Path: $($mechanism.Path)" -ForegroundColor DarkGray
                            }
                        }
                    }
                    
                    # Show digital signatures
                    if ($candidate.DigitalSignatures.Count -gt 0) {
                        Write-Host "     📝 DIGITAL SIGNATURES:" -ForegroundColor Cyan
                        foreach ($sig in $candidate.DigitalSignatures) {
                            Write-Host "       • Signed by: $($sig.SignerCertificate)" -ForegroundColor DarkCyan
                            Write-Host "         Status: $($sig.Status)" -ForegroundColor DarkGray
                            if ($sig.TimeStamp) {
                                Write-Host "         Timestamp: $($sig.TimeStamp)" -ForegroundColor DarkGray
                            }
                        }
                    }
                    
                    # Show creation methods
                    if ($candidate.CreationMethods.Count -gt 0) {
                        Write-Host "     🛠️ CREATION METHODS:" -ForegroundColor White
                        foreach ($method in $candidate.CreationMethods) {
                            Write-Host "       • $($method.Method)" -ForegroundColor Gray
                            Write-Host "         Source: $($method.Source) (Likelihood: $($method.Likelihood))" -ForegroundColor DarkGray
                        }
                    }
                    
                    # Show system impact
                    if ($candidate.SystemServices.Count -gt 0) {
                        Write-Host "     🛠️ Affects Services: $($candidate.SystemServices -join ', ')" -ForegroundColor Magenta
                    }
                    if ($candidate.StartupItems.Count -gt 0) {
                        Write-Host "     🚀 Affects Startup: $($candidate.StartupItems.Count) items" -ForegroundColor Yellow
                    }
                    if ($candidate.ScheduledTasks.Count -gt 0) {
                        Write-Host "     📅 Affects Tasks: $($candidate.ScheduledTasks -join ', ')" -ForegroundColor Yellow
                    }
                    if ($candidate.Shortcuts.Count -gt 0) {
                        Write-Host "     🔗 Broken Shortcuts: $($candidate.Shortcuts.Count)" -ForegroundColor Cyan
                    }
                    
                    Write-Host "     Consequences:" -ForegroundColor Red
                    foreach ($consequence in $candidate.Consequences) {
                        Write-Host "       • $consequence" -ForegroundColor DarkRed
                    }
                    
                    Write-Host "     Recovery Options:" -ForegroundColor Green
                    foreach ($option in $candidate.RecoveryOptions) {
                        Write-Host "       • $option" -ForegroundColor DarkGreen
                    }
                    Write-Host ""
                }
            }
            
            if (-not $DryRun -and $cleanupData.Candidates.Count -gt 0) {
                Write-Log "READY TO CLEANUP:" "CRITICAL"
                Write-Host "Files that will be deleted: $(($candidates | Where-Object { $_.IsSafeToDelete }).Count)"
                Write-Host "Space to be recovered: $([math]::Round(($candidates | Where-Object { $_.IsSafeToDelete } | Measure-Object -Property Size -Sum).Sum / 1GB, 2)) GB"
                Write-Host ""
                Write-Host "Run with -CriticalBackupOnly to backup critical files to D drive only"
                Write-Host "Run with -DryRun to preview only"
            }
        }
        
        "JSON" {
            $CleanupData | ConvertTo-Json -Depth 10
        }
        
        "CSV" {
            $candidates | Select-Object Name, Path, SizeMB, RiskLevel, IsSafeToDelete, Reason, DaysOld | ConvertTo-Csv -NoTypeInformation
        }
    }
}

function Invoke-Cleanup {
    param($CleanupData, [switch]$CriticalBackupOnly)
    
    $safeCandidates = $CleanupData.Candidates | Where-Object { $_.IsSafeToDelete }
    $criticalCandidates = $CleanupData.Candidates | Where-Object { $_.RiskLevel -eq "Critical" }
    
    if ($safeCandidates.Count -eq 0) {
        Write-Log "No safe files to delete" "WARN"
        return
    }
    
    # Only backup critical files if requested and D drive is available
    if ($CriticalBackupOnly -and $criticalCandidates.Count -gt 0) {
        $dDrivePath = "D:\SystemBackups"
        if (Test-Path "D:\") {
            $backupPath = "$dDrivePath\CriticalFileBackup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
            Write-Log "Creating CRITICAL FILES backup to: $backupPath" "INFO"
            
            try {
                New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
                $backupCount = 0
                
                foreach ($candidate in $criticalCandidates) {
                    $backupFile = Join-Path $backupPath ($candidate.Name + "_" + [Guid]::NewGuid().ToString().Substring(0, 8))
                    Copy-Item $candidate.Path $backupFile -ErrorAction SilentlyContinue
                    $backupCount++
                }
                
                Write-Log "Critical backup created: $backupCount files backed up to D drive" "SUCCESS"
            } catch {
                Write-Log "Failed to create backup to D drive: $_" "ERROR"
                Write-Log "Proceeding without backup - CRITICAL FILES WILL NOT BE BACKED UP" "WARN"
            }
        } else {
            Write-Log "D drive not available - CRITICAL FILES WILL NOT BE BACKED UP" "WARN"
        }
    }
    
    Write-Log "Deleting $($safeCandidates.Count) safe files..." "WARN"
    $deletedCount = 0
    $totalSize = 0
    
    foreach ($candidate in $safeCandidates) {
        try {
            Remove-Item $candidate.Path -Force -ErrorAction Stop
            $deletedCount++
            $totalSize += $candidate.Size
            
            if ($deletedCount % 10 -eq 0) {
                Write-Log "Deleted $deletedCount files..."
            }
        } catch {
            Write-Log "Failed to delete: $($candidate.Path) - $_" "ERROR"
        }
    }
    
    Write-Log "Cleanup complete!" "SUCCESS"
    Write-Log "Files deleted: $deletedCount"
    Write-Log "Space recovered: $([math]::Round($totalSize / 1GB, 2)) GB"
    Write-Log "C Drive space freed: $([math]::Round($totalSize / 1GB, 2)) GB" "SUCCESS"
}

# Main execution
Write-Log "Safe Cleanup Assistant v1.0" "SUCCESS"
Write-Log "Target: $TargetPath" "INFO"

if (-not (Test-Path $TargetPath)) {
    Write-Log "Target path does not exist: $TargetPath" "ERROR"
    exit 1
}

# Perform analysis
$cleanupData = Get-CleanupCandidates -Path $TargetPath -RiskThreshold $RiskThreshold -MinSizeMB $MinSizeMB

# Show report
Show-CleanupReport -CleanupData $cleanupData -OutputFormat $OutputFormat

# Execute cleanup if not dry run
if (-not $DryRun -and $cleanupData.Candidates.Count -gt 0) {
    Write-Host ""
    Write-Log "Proceed with cleanup? (y/N)" "CRITICAL"
    $response = Read-Host
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Invoke-Cleanup -CleanupData $cleanupData -CriticalBackupOnly:$CriticalBackupOnly
    } else {
        Write-Log "Cleanup cancelled by user" "WARN"
    }
}

Write-Log "Safe Cleanup Assistant complete!" "SUCCESS"
