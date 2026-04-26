using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class HybridFileScanner
{
    public class FileAnalysisInfo
    {
        public string Path { get; set; }
        public string Name { get; set; }
        public long Size { get; set; }
        public long ActualSizeOnDisk { get; set; }
        public long CompressedSize { get; set; }
        public DateTime Created { get; set; }
        public DateTime Modified { get; set; }
        public DateTime Accessed { get; set; }
        public string Extension { get; set; }
        public int DaysOld { get; set; }
        public bool IsSystem { get; set; }
        public bool IsHidden { get; set; }
        public bool IsCompressed { get; set; }
        public bool IsSparse { get; set; }
        public bool IsReparsePoint { get; set; }
        public bool HasAlternateStreams { get; set; }
        public int HardLinkCount { get; set; }
        public string RiskLevel { get; set; }
        public string Reason { get; set; }
        public string SourceApp { get; set; }
        public string RegenerationMechanism { get; set; }
        public string CreationMethod { get; set; }
        public List<string> AffectedComponents { get; set; }
        public List<string> Consequences { get; set; }
        public List<string> RecoveryOptions { get; set; }
        public List<string> AlternateStreams { get; set; }
        public string ReparseTarget { get; set; }

        public FileAnalysisInfo()
        {
            AffectedComponents = new List<string>();
            Consequences = new List<string>();
            RecoveryOptions = new List<string>();
            AlternateStreams = new List<string>();
        }
    }

    // Windows API imports for fast file enumeration
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr FindFirstFileEx(string lpFileName, int fInfoLevelId, out WIN32_FIND_DATA lpFindFileData, int fSearchOp, IntPtr lpSearchFilter, int dwAdditionalFlags);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool FindNextFile(IntPtr hFindFile, out WIN32_FIND_DATA lpFindFileData);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool FindClose(IntPtr hFindFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetFileAttributesEx(string lpFileName, int fInfoLevelId, out FILE_ATTRIBUTE_DATA fileData);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetCompressedFileSizeEx(string lpFileName, out long lpFileSize);

    // Constants for fast enumeration
    private const int FindExInfoBasic = 0;
    private const int FindExInfoStandard = 1;
    private const int FindExSearchNameMatch = 0;
    private const int FIND_FIRST_EX_LARGE_FETCH = 2;
    private const int GetFileExInfoStandard = 0;
    private const uint FILE_ATTRIBUTE_COMPRESSED = 0x800;
    private const uint FILE_ATTRIBUTE_SPARSE_FILE = 0x200;
    private const uint FILE_ATTRIBUTE_REPARSE_POINT = 0x400;
    private const uint FILE_ATTRIBUTE_HIDDEN = 0x2;
    private const uint FILE_ATTRIBUTE_SYSTEM = 0x4;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct WIN32_FIND_DATA
    {
        public uint dwFileAttributes;
        public FILETIME ftCreationTime;
        public FILETIME ftLastAccessTime;
        public FILETIME ftLastWriteTime;
        public uint nFileSizeHigh;
        public uint nFileSizeLow;
        public uint dwReserved0;
        public uint dwReserved1;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string cFileName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 14)]
        public string cAlternateFileName;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct FILETIME
    {
        public uint dwLowDateTime;
        public uint dwHighDateTime;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct FILE_ATTRIBUTE_DATA
    {
        public FILETIME ftCreationTime;
        public FILETIME ftLastAccessTime;
        public FILETIME ftLastWriteTime;
        public uint dwFileAttributes;
        public uint nFileSizeHigh;
        public uint nFileSizeLow;
    }

    private static List<string> TempDirectories = new List<string>();
    private static List<string> CacheDirectories = new List<string>();
    private static Dictionary<string, string> ApplicationSignatures = new Dictionary<string, string>();

    private static void InitializeDirectories()
    {
        TempDirectories.Add(Path.GetTempPath());
        TempDirectories.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Temp"));
        TempDirectories.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Temp"));

        CacheDirectories.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Windows", "INetCache"));
        CacheDirectories.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "User Data", "Default", "Cache"));
        CacheDirectories.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Mozilla", "Firefox", "Profiles"));

        ApplicationSignatures.Add("Microsoft Office", "*.docx|*.xlsx|*.pptx|*.tmp|~$*|*.asd");
        ApplicationSignatures.Add("Adobe", "*.tmp|*.cache|*.log|*.bak");
        ApplicationSignatures.Add("Google Chrome", "*.tmp|*.cache|*.log|*.bak");
        ApplicationSignatures.Add("Mozilla Firefox", "*.tmp|*.cache|*.log|*.bak");
        ApplicationSignatures.Add("Visual Studio", "*.tmp|*.cache|*.log|*.bak|*.suo|*.user");
        ApplicationSignatures.Add("Node.js", "*.tmp|*.log|node_modules");
        ApplicationSignatures.Add("Python", "*.pyc|*.pyo|__pycache__|*.tmp");
        ApplicationSignatures.Add("Java", "*.class|*.jar|*.tmp|*.log");
        ApplicationSignatures.Add("Discord", "*.tmp|*.cache|*.log");
        ApplicationSignatures.Add("Slack", "*.tmp|*.cache|*.log");
        ApplicationSignatures.Add("Zoom", "*.tmp|*.cache|*.log");
        ApplicationSignatures.Add("Teams", "*.tmp|*.cache|*.log");
    }

    // Fast file enumeration using Windows API
    private static List<FileAnalysisInfo> FastScanDirectory(string directoryPath, int maxFiles)
    {
        var files = new List<FileAnalysisInfo>();
        int scannedCount = 0;

        try
        {
            Console.WriteLine("Fast scanning: " + directoryPath);

            Stack<string> directories = new Stack<string>();
            directories.Push(directoryPath);

            while (directories.Count > 0 && scannedCount < maxFiles)
            {
                string currentDir = directories.Pop();

                WIN32_FIND_DATA findData;
                IntPtr hFind = FindFirstFileEx(
                    Path.Combine(currentDir, "*"),
                    FindExInfoBasic, // Use Basic for faster enumeration
                    out findData,
                    FindExSearchNameMatch,
                    IntPtr.Zero,
                    FIND_FIRST_EX_LARGE_FETCH // Use Large Fetch for better performance
                );

                if (hFind == new IntPtr(-1)) // INVALID_HANDLE_VALUE
                {
                    continue;
                }

                try
                {
                    do
                    {
                        if (scannedCount >= maxFiles) break;

                        string fileName = findData.cFileName;
                        if (fileName == "." || fileName == "..") continue;

                        string fullPath = Path.Combine(currentDir, fileName);

                        // Check if it's a directory
                        if ((findData.dwFileAttributes & 0x10) != 0) // FILE_ATTRIBUTE_DIRECTORY
                        {
                            directories.Push(fullPath);
                            continue;
                        }

                        // Create basic file info from WIN32_FIND_DATA (no system calls!)
                        var fileInfo = new FileAnalysisInfo
                        {
                            Path = fullPath,
                            Name = fileName,
                            Size = ((long)findData.nFileSizeHigh << 32) | findData.nFileSizeLow,
                            Created = DateTime.FromFileTime(((long)findData.ftCreationTime.dwHighDateTime << 32) | findData.ftCreationTime.dwLowDateTime),
                            Modified = DateTime.FromFileTime(((long)findData.ftLastWriteTime.dwHighDateTime << 32) | findData.ftLastWriteTime.dwLowDateTime),
                            Accessed = DateTime.FromFileTime(((long)findData.ftLastAccessTime.dwHighDateTime << 32) | findData.ftLastAccessTime.dwLowDateTime),
                            Extension = Path.GetExtension(fileName),
                            DaysOld = (int)(DateTime.Now - DateTime.FromFileTime(((long)findData.ftLastWriteTime.dwHighDateTime << 32) | findData.ftLastWriteTime.dwLowDateTime)).TotalDays,
                            IsSystem = (findData.dwFileAttributes & FILE_ATTRIBUTE_SYSTEM) != 0,
                            IsHidden = (findData.dwFileAttributes & FILE_ATTRIBUTE_HIDDEN) != 0,
                            IsCompressed = (findData.dwFileAttributes & FILE_ATTRIBUTE_COMPRESSED) != 0,
                            IsSparse = (findData.dwFileAttributes & FILE_ATTRIBUTE_SPARSE_FILE) != 0,
                            IsReparsePoint = (findData.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0,
                            ActualSizeOnDisk = ((long)findData.nFileSizeHigh << 32) | findData.nFileSizeLow // Will be calculated later
                        };

                        // Calculate actual size on disk (4KB cluster)
                        long clusterSize = 4096;
                        fileInfo.ActualSizeOnDisk = ((fileInfo.Size + clusterSize - 1) / clusterSize) * clusterSize;

                        files.Add(fileInfo);
                        scannedCount++;

                        if (scannedCount % 500 == 0)
                        {
                            Console.WriteLine("Fast scanned " + scannedCount + " files...");
                        }

                    } while (FindNextFile(hFind, out findData));
                }
                finally
                {
                    FindClose(hFind);
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error in FastScanDirectory: " + ex.Message);
        }

        return files;
    }

    // Deep analysis only for interesting files
    private static void DeepAnalyzeInterestingFiles(List<FileAnalysisInfo> files)
    {
        Console.WriteLine("Deep analyzing interesting files...");

        // Find files that need deep analysis
        var interestingFiles = files.Where(f => 
            f.Size > 10 * 1024 * 1024 || // Larger than 10MB
            f.IsSystem || 
            f.IsReparsePoint ||
            f.IsCompressed ||
            f.IsSparse ||
            f.DaysOld > 365 || // Older than 1 year
            f.Extension == ".exe" ||
            f.Extension == ".dll" ||
            f.Extension == ".sys"
        ).ToList();

        Console.WriteLine("Found " + interestingFiles.Count + " files needing deep analysis...");

        int analyzedCount = 0;
        foreach (var file in interestingFiles)
        {
            try
            {
                // Do deep analysis only for these files
                AnalyzeFileDeep(file);
                analyzedCount++;

                if (analyzedCount % 10 == 0)
                {
                    Console.WriteLine("Deep analyzed " + analyzedCount + "/" + interestingFiles.Count + " interesting files...");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error deep analyzing " + file.Name + ": " + ex.Message);
            }
        }

        // Quick analysis for remaining files
        var remainingFiles = files.Except(interestingFiles).ToList();
        Console.WriteLine("Quick analyzing " + remainingFiles.Count + " remaining files...");

        foreach (var file in remainingFiles)
        {
            try
            {
                AnalyzeFileQuick(file);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error quick analyzing " + file.Name + ": " + ex.Message);
            }
        }
    }

    private static void AnalyzeFileDeep(FileAnalysisInfo fileInfo)
    {
        // Use PowerShell only for interesting files
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-Command \"Get-Item '" + fileInfo.Path + "' -Stream * | Select-Object Stream\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            using (var process = Process.Start(psi))
            {
                var output = process.StandardOutput.ReadToEnd();
                var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                
                foreach (var line in lines)
                {
                    if (line.Contains(":") && !line.Contains("Stream"))
                    {
                        var parts = line.Split(new[] { ':' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length > 1)
                        {
                            fileInfo.AlternateStreams.Add(parts[1].Trim());
                        }
                    }
                }
            }
        }
        catch { }

        fileInfo.HasAlternateStreams = fileInfo.AlternateStreams.Count > 0;

        // Get compressed size
        if (fileInfo.IsCompressed)
        {
            try
            {
                long compressedSize;
                if (GetCompressedFileSizeEx(fileInfo.Path, out compressedSize))
                {
                    fileInfo.CompressedSize = compressedSize;
                }
            }
            catch { }
        }

        // Get reparse target
        if (fileInfo.IsReparsePoint)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = "-Command \"(Get-Item '" + fileInfo.Path + "').Target\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                using (var process = Process.Start(psi))
                {
                    var output = process.StandardOutput.ReadToEnd().Trim();
                    if (!string.IsNullOrEmpty(output) && output != "")
                    {
                        fileInfo.ReparseTarget = output;
                    }
                }
            }
            catch { }
        }

        // Get hard link count
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "fsutil.exe",
                Arguments = "hardlink list \"" + fileInfo.Path + "\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            using (var process = Process.Start(psi))
            {
                var output = process.StandardOutput.ReadToEnd();
                var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                fileInfo.HardLinkCount = lines.Length;
            }
        }
        catch
        {
            fileInfo.HardLinkCount = 1;
        }

        // Find source application
        fileInfo.SourceApp = FindSourceApplication(fileInfo.Path);
        fileInfo.RegenerationMechanism = CheckRegenerationMechanism(fileInfo.Path);
        fileInfo.CreationMethod = DetermineCreationMethod(fileInfo.Name);
        AnalyzeFileImpact(fileInfo);
    }

    private static void AnalyzeFileQuick(FileAnalysisInfo fileInfo)
    {
        // Quick analysis without system calls
        fileInfo.SourceApp = FindSourceApplication(fileInfo.Path);
        fileInfo.RegenerationMechanism = CheckRegenerationMechanism(fileInfo.Path);
        fileInfo.CreationMethod = DetermineCreationMethod(fileInfo.Name);
        AnalyzeFileImpact(fileInfo);
        fileInfo.HardLinkCount = 1; // Assume single link
    }

    private static string FindSourceApplication(string filePath)
    {
        try
        {
            string[] programFiles = {
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)
            };

            foreach (string progDir in programFiles)
            {
                foreach (var appSig in ApplicationSignatures)
                {
                    string[] patterns = appSig.Value.Split('|');
                    foreach (string pattern in patterns)
                    {
                        if (filePath.Contains(pattern))
                        {
                            return appSig.Key;
                        }
                    }
                }
            }

            string lowerPath = filePath.ToLower();
            if (lowerPath.Contains("\\windows\\") || lowerPath.Contains("\\system32\\"))
                return "Windows System";
            if (lowerPath.Contains("\\program files\\") || lowerPath.Contains("\\program files (x86)\\"))
                return "Installed Application";
            if (lowerPath.Contains("\\users\\") && lowerPath.Contains("\\appdata\\"))
                return "User Application Data";
            if (lowerPath.Contains("\\users\\") && lowerPath.Contains("\\documents\\"))
                return "User Documents";
            if (lowerPath.Contains("\\temp\\") || lowerPath.Contains("\\tmp\\"))
                return "Temporary File";
        }
        catch
        {
            // Error in source detection
        }

        return "Unknown";
    }

    private static string CheckRegenerationMechanism(string filePath)
    {
        try
        {
            string lowerPath = filePath.ToLower();

            if (lowerPath.Contains("\\temp\\") || lowerPath.Contains("\\tmp\\"))
            {
                return "Regenerated by applications on startup";
            }
            if (lowerPath.Contains("\\cache\\") || lowerPath.Contains("\\caches\\"))
            {
                return "Regenerated by applications when needed";
            }
            if (lowerPath.Contains("\\logs\\") || lowerPath.EndsWith(".log"))
            {
                return "Regenerated by applications during operation";
            }
            if (lowerPath.Contains("\\backup\\") || lowerPath.EndsWith(".bak"))
            {
                return "Regenerated by backup software";
            }
            if (lowerPath.Contains("\\windows\\") || lowerPath.Contains("\\system32\\"))
            {
                return "Regenerated by Windows Update/System Repair";
            }
        }
        catch
        {
            // Error in regeneration detection
        }

        return "Manual creation - will not regenerate";
    }

    private static string DetermineCreationMethod(string fileName)
    {
        try
        {
            string lowerName = fileName.ToLower();

            if (lowerName.StartsWith("~") || lowerName.EndsWith(".tmp") || lowerName.EndsWith(".temp"))
            {
                return "Temporary file created by application";
            }
            if (lowerName.EndsWith(".log"))
            {
                return "Application logging";
            }
            if (lowerName.Contains(".cache"))
            {
                return "Application cache";
            }

            return "Unknown";
        }
        catch
        {
            return "Unknown";
        }
    }

    private static void AnalyzeFileImpact(FileAnalysisInfo fileInfo)
    {
        string lowerPath = fileInfo.Path.ToLower();

        if (lowerPath.Contains("\\system32\\") || lowerPath.Contains("\\syswow64\\") || lowerPath.Contains("\\drivers\\"))
        {
            fileInfo.RiskLevel = "Critical";
            fileInfo.Reason = "CRITICAL SYSTEM FILE - Deleting may prevent Windows from starting";
            fileInfo.Consequences.Add("SYSTEM FAILURE: May prevent Windows from starting");
            fileInfo.RecoveryOptions.Add("Windows Repair/Recovery Console");
            fileInfo.RecoveryOptions.Add("System Restore");
            fileInfo.RecoveryOptions.Add("Windows Installation Media");
        }
        else if (lowerPath.Contains("\\windows\\") && fileInfo.Extension == ".sys")
        {
            fileInfo.RiskLevel = "Critical";
            fileInfo.Reason = "Windows system driver - Critical for hardware operation";
            fileInfo.Consequences.Add("HARDWARE FAILURE: Devices may stop working");
            fileInfo.RecoveryOptions.Add("Driver Reinstallation");
            fileInfo.RecoveryOptions.Add("System Restore");
        }
        else if (fileInfo.Extension == ".exe" && lowerPath.Contains("\\program files\\"))
        {
            fileInfo.RiskLevel = "High";
            fileInfo.Reason = "Installed application executable";
            fileInfo.Consequences.Add("APPLICATION FAILURE: Program will not run");
            fileInfo.RecoveryOptions.Add("Application Reinstallation");
            fileInfo.RecoveryOptions.Add("Restore from backup");
        }
        else if (fileInfo.Size > 100 * 1024 * 1024) // > 100MB
        {
            fileInfo.RiskLevel = "Medium";
            fileInfo.Reason = "Large file - review before deletion";
            fileInfo.Consequences.Add("STORAGE IMPACT: Significant space recovery");
            fileInfo.RecoveryOptions.Add("Check if file is needed");
            fileInfo.RecoveryOptions.Add("Backup before deletion");
        }
        else if (fileInfo.DaysOld > 365)
        {
            fileInfo.RiskLevel = "Medium";
            fileInfo.Reason = "Old file - may be no longer needed";
            fileInfo.Consequences.Add("DATA LOSS: File may contain important historical data");
            fileInfo.RecoveryOptions.Add("Review content before deletion");
            fileInfo.RecoveryOptions.Add("Archive to external storage");
        }
        else if (lowerPath.Contains("\\temp\\") || lowerPath.Contains("\\tmp\\"))
        {
            fileInfo.RiskLevel = "Low";
            fileInfo.Reason = "Temporary file - safe to delete";
            fileInfo.Consequences.Add("TEMPORARY INCONVENIENCE: Application may recreate file");
            fileInfo.RecoveryOptions.Add("File can be safely deleted");
        }
        else
        {
            fileInfo.RiskLevel = "Medium";
            fileInfo.Reason = "Unknown file type - manual review recommended";
            fileInfo.RecoveryOptions.Add("Manual review before deletion");
        }
    }

    private static void PrintAnalysis(List<FileAnalysisInfo> files)
    {
        Console.WriteLine("\n=== HYBRID FILE ANALYSIS RESULTS ===");
        Console.WriteLine("Total files analyzed: " + files.Count + "\n");

        // Calculate statistics
        long totalLogicalSize = files.Sum(f => f.Size);
        long totalActualSize = files.Sum(f => f.ActualSizeOnDisk);
        long totalCompressedSize = files.Sum(f => f.CompressedSize > 0 ? f.CompressedSize : f.Size);
        var filesWithADS = files.Where(f => f.HasAlternateStreams).ToList();
        var compressedFiles = files.Where(f => f.IsCompressed).ToList();
        var sparseFiles = files.Where(f => f.IsSparse).ToList();
        var reparsePoints = files.Where(f => f.IsReparsePoint).ToList();
        var hardLinkedFiles = files.Where(f => f.HardLinkCount > 1).ToList();

        Console.WriteLine("=== SPACE ANALYSIS ===");
        Console.WriteLine("Logical Size: " + string.Format("{0:F2}", totalLogicalSize / 1024.0 / 1024.0 / 1024.0) + " GB");
        Console.WriteLine("Actual Size on Disk: " + string.Format("{0:F2}", totalActualSize / 1024.0 / 1024.0 / 1024.0) + " GB");
        Console.WriteLine("Cluster Waste: " + string.Format("{0:F2}", (totalActualSize - totalLogicalSize) / 1024.0 / 1024.0) + " MB");
        Console.WriteLine("Files with Alternate Data Streams: " + filesWithADS.Count);
        Console.WriteLine("Compressed Files: " + compressedFiles.Count);
        Console.WriteLine("Sparse Files: " + sparseFiles.Count);
        Console.WriteLine("Reparse Points: " + reparsePoints.Count);
        Console.WriteLine("Files with Hard Links: " + hardLinkedFiles.Count + "\n");

        var groupedFiles = files.GroupBy(f => f.RiskLevel).ToDictionary(g => g.Key, g => g.ToList());

        if (groupedFiles.ContainsKey("Critical"))
        {
            Console.WriteLine("🔴 CRITICAL FILES:");
            foreach (var file in groupedFiles["Critical"])
            {
                Console.WriteLine("  ⚠️ " + file.Name);
                Console.WriteLine("     Size: " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB | Age: " + file.DaysOld + " days");
                Console.WriteLine("     Reason: " + file.Reason);
                if (file.HasAlternateStreams)
                {
                    Console.WriteLine("     🔍 Has " + file.AlternateStreams.Count + " alternate streams");
                }
                Console.WriteLine("     Path: " + file.Path);
                Console.WriteLine("     Consequences: " + string.Join(", ", file.Consequences));
                Console.WriteLine("     Recovery: " + string.Join(", ", file.RecoveryOptions) + "\n");
            }
        }

        if (groupedFiles.ContainsKey("High"))
        {
            Console.WriteLine("🟠 HIGH RISK FILES:");
            foreach (var file in groupedFiles["High"].OrderByDescending(f => f.Size).Take(10))
            {
                Console.WriteLine("  ⚠️ " + file.Name);
                Console.WriteLine("     Size: " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB | Age: " + file.DaysOld + " days");
                Console.WriteLine("     Reason: " + file.Reason);
                Console.WriteLine("     🔍 Source: " + file.SourceApp);
                Console.WriteLine("     Path: " + file.Path + "\n");
            }
        }

        if (groupedFiles.ContainsKey("Medium"))
        {
            Console.WriteLine("🟡 MEDIUM RISK FILES:");
            foreach (var file in groupedFiles["Medium"].OrderByDescending(f => f.Size).Take(20))
            {
                Console.WriteLine("  ⚠️ " + file.Name);
                Console.WriteLine("     Size: " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB | Age: " + file.DaysOld + " days");
                Console.WriteLine("     Reason: " + file.Reason);
                if (!string.IsNullOrEmpty(file.RegenerationMechanism))
                {
                    Console.WriteLine("     🔄 Regeneration: " + file.RegenerationMechanism);
                }
                Console.WriteLine("     🛠️ Creation: " + file.CreationMethod);
                Console.WriteLine("     Path: " + file.Path + "\n");
            }
        }

        if (groupedFiles.ContainsKey("Low"))
        {
            var lowRiskFiles = groupedFiles["Low"].OrderByDescending(f => f.Size).Take(20);
            Console.WriteLine("✅ LOW RISK FILES (Top 20 by size, " + groupedFiles["Low"].Count + " total):");
            foreach (var file in lowRiskFiles)
            {
                Console.WriteLine("  ✅ " + file.Name);
                Console.WriteLine("     Size: " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB | Age: " + file.DaysOld + " days");
                Console.WriteLine("     Reason: " + file.Reason);
                if (!string.IsNullOrEmpty(file.SourceApp))
                {
                    Console.WriteLine("     🔍 Source: " + file.SourceApp);
                }
                Console.WriteLine("     Path: " + file.Path + "\n");
            }
        }

        Console.WriteLine("\n=== SUMMARY ===");
        foreach (var group in groupedFiles)
        {
            string emoji = "⚪";
            if (group.Key == "Critical") emoji = "🔴";
            else if (group.Key == "High") emoji = "🟠";
            else if (group.Key == "Medium") emoji = "🟡";
            else if (group.Key == "Low") emoji = "✅";

            Console.WriteLine(emoji + " " + group.Key + ": " + group.Value.Count + " files");
        }

        Console.WriteLine("\n=== SPACE OPTIMIZATION OPPORTUNITIES ===");
        if (filesWithADS.Count > 0)
        {
            Console.WriteLine("🔍 Alternate Data Streams: " + filesWithADS.Count + " files - may contain hidden data");
        }
        if (compressedFiles.Count > 0)
        {
            Console.WriteLine("🗜️ Compressed Files: " + compressedFiles.Count + " files - saving space");
        }
        if (hardLinkedFiles.Count > 0)
        {
            long duplicateSpace = hardLinkedFiles.Sum(f => f.Size * (f.HardLinkCount - 1));
            Console.WriteLine("⛓️ Hard Links: " + hardLinkedFiles.Count + " files - " + string.Format("{0:F2}", duplicateSpace / 1024.0 / 1024.0) + " MB duplicate space");
        }
        Console.WriteLine("💾 Cluster Waste: " + string.Format("{0:F2}", (totalActualSize - totalLogicalSize) / 1024.0 / 1024.0) + " MB due to cluster size");
    }

    public static int Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.WriteLine("Usage: HybridFileScanner.exe <directory_path>");
            Console.WriteLine("Example: HybridFileScanner.exe \"C:\\Users\\Aomega Imaging\"");
            return 1;
        }

        string directoryPath = args[0];

        if (!Directory.Exists(directoryPath))
        {
            Console.WriteLine("Error: Directory does not exist: " + directoryPath);
            return 1;
        }

        Console.WriteLine("Starting HYBRID file analysis...");
        Console.WriteLine("Target directory: " + directoryPath + "\n");

        InitializeDirectories();

        var stopwatch = Stopwatch.StartNew();

        try
        {
            // Phase 1: Fast scanning using Windows API
            var files = FastScanDirectory(directoryPath, 100000);
            
            // Phase 2: Deep analysis only for interesting files
            DeepAnalyzeInterestingFiles(files);
            
            stopwatch.Stop();

            Console.WriteLine("\nAnalysis completed in " + string.Format("{0:F2}", stopwatch.Elapsed.TotalSeconds) + " seconds\n");
            PrintAnalysis(files);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error during analysis: " + ex.Message);
            return 1;
        }

        Console.WriteLine("\nHybrid analysis complete!");
        return 0;
    }
}
