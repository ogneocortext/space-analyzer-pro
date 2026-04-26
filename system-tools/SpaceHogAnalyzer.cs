using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class SpaceHogAnalyzer
{
    public class FileAnalysisInfo
    {
        public string Path { get; set; }
        public string Name { get; set; }
        public long Size { get; set; }
        public long ActualSizeOnDisk { get; set; }
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
        public string RiskLevel { get; set; }
        public string Reason { get; set; }
        public string SourceApp { get; set; }
        public string RegenerationMechanism { get; set; }
        public string CreationMethod { get; set; }
        public List<string> AffectedComponents { get; set; }
        public List<string> Consequences { get; set; }
        public List<string> RecoveryOptions { get; set; }

        public FileAnalysisInfo()
        {
            AffectedComponents = new List<string>();
            Consequences = new List<string>();
            RecoveryOptions = new List<string>();
        }
    }

    // Windows API imports for fast file enumeration
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr FindFirstFileEx(string lpFileName, int fInfoLevelId, out WIN32_FIND_DATA lpFindFileData, int fSearchOp, IntPtr lpSearchFilter, int dwAdditionalFlags);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool FindNextFile(IntPtr hFindFile, out WIN32_FIND_DATA lpFindFileData);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool FindClose(IntPtr hFindFile);

    // Constants for fast enumeration
    private const int FindExInfoBasic = 0;
    private const int FindExSearchNameMatch = 0;
    private const int FIND_FIRST_EX_LARGE_FETCH = 2;
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
            Console.WriteLine("Scanning for space hogs: " + directoryPath);

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

                        if (scannedCount % 1000 == 0)
                        {
                            Console.WriteLine("Scanned " + scannedCount + " files...");
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

    private static void AnalyzeFileQuick(FileAnalysisInfo fileInfo)
    {
        // Quick analysis without system calls
        fileInfo.SourceApp = FindSourceApplication(fileInfo.Path);
        fileInfo.RegenerationMechanism = CheckRegenerationMechanism(fileInfo.Path);
        fileInfo.CreationMethod = DetermineCreationMethod(fileInfo.Name);
        AnalyzeFileImpact(fileInfo);
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

    private static void PrintSpaceHogAnalysis(List<FileAnalysisInfo> files)
    {
        Console.WriteLine("\n=== SPACE HOG ANALYSIS ===");
        Console.WriteLine("Total files analyzed: " + files.Count + "\n");

        // Calculate statistics
        long totalSize = files.Sum(f => f.Size);
        var sortedBySize = files.OrderByDescending(f => f.Size).ToList();
        var top100 = sortedBySize.Take(100).ToList();
        var top50 = sortedBySize.Take(50).ToList();
        var top20 = sortedBySize.Take(20).ToList();
        var top10 = sortedBySize.Take(10).ToList();

        Console.WriteLine("=== OVERALL SPACE BREAKDOWN ===");
        Console.WriteLine("Total Size: " + string.Format("{0:F2}", totalSize / 1024.0 / 1024.0 / 1024.0) + " GB");
        Console.WriteLine("Top 10 files: " + string.Format("{0:F2}", top10.Sum(f => f.Size) / 1024.0 / 1024.0 / 1024.0) + " GB (" + string.Format("{0:P1}", (double)top10.Sum(f => f.Size) / totalSize) + ")");
        Console.WriteLine("Top 20 files: " + string.Format("{0:F2}", top20.Sum(f => f.Size) / 1024.0 / 1024.0 / 1024.0) + " GB (" + string.Format("{0:P1}", (double)top20.Sum(f => f.Size) / totalSize) + ")");
        Console.WriteLine("Top 50 files: " + string.Format("{0:F2}", top50.Sum(f => f.Size) / 1024.0 / 1024.0 / 1024.0) + " GB (" + string.Format("{0:P1}", (double)top50.Sum(f => f.Size) / totalSize) + ")");
        Console.WriteLine("Top 100 files: " + string.Format("{0:F2}", top100.Sum(f => f.Size) / 1024.0 / 1024.0 / 1024.0) + " GB (" + string.Format("{0:P1}", (double)top100.Sum(f => f.Size) / totalSize) + ")\n");

        Console.WriteLine("=== TOP 20 SPACE HOGS ===");
        for (int i = 0; i < Math.Min(20, top20.Count); i++)
        {
            var file = top20[i];
            string emoji = "📄";
            if (file.RiskLevel == "Critical") emoji = "🔴";
            else if (file.RiskLevel == "High") emoji = "🟠";
            else if (file.RiskLevel == "Medium") emoji = "🟡";
            else if (file.RiskLevel == "Low") emoji = "✅";

            Console.WriteLine(emoji + " #" + (i + 1) + ": " + file.Name);
            Console.WriteLine("     Size: " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB (" + string.Format("{0:P1}", (double)file.Size / totalSize) + " of total)");
            Console.WriteLine("     Age: " + file.DaysOld + " days | Modified: " + file.Modified.ToString("yyyy-MM-dd"));
            Console.WriteLine("     Type: " + file.Extension.ToUpper() + " | Risk: " + file.RiskLevel);
            Console.WriteLine("     Source: " + file.SourceApp);
            Console.WriteLine("     Reason: " + file.Reason);
            if (!string.IsNullOrEmpty(file.RegenerationMechanism))
            {
                Console.WriteLine("     🔄 Regeneration: " + file.RegenerationMechanism);
            }
            Console.WriteLine("     📁 Path: " + file.Path);
            Console.WriteLine("     ⚠️  Impact: " + string.Join(", ", file.Consequences));
            Console.WriteLine("     🛡️  Recovery: " + string.Join(", ", file.RecoveryOptions) + "\n");
        }

        // Group by file extension
        var extensionGroups = files
            .Where(f => f.Size > 10 * 1024 * 1024) // Only files > 10MB
            .GroupBy(f => f.Extension.ToLower())
            .OrderByDescending(g => g.Sum(f => f.Size))
            .Take(10)
            .ToList();

        Console.WriteLine("=== SPACE BY FILE TYPE ===");
        foreach (var group in extensionGroups)
        {
            string ext = string.IsNullOrEmpty(group.Key) ? "[No Extension]" : group.Key.ToUpper();
            long groupSize = group.Sum(f => f.Size);
            int fileCount = group.Count();
            double percentage = (double)groupSize / totalSize;

            Console.WriteLine(ext + ": " + string.Format("{0:F2}", groupSize / 1024.0 / 1024.0 / 1024.0) + " GB (" + string.Format("{0:P1}", percentage) + ") - " + fileCount + " files");
        }

        // Group by source application
        var appGroups = files
            .Where(f => f.Size > 10 * 1024 * 1024) // Only files > 10MB
            .GroupBy(f => f.SourceApp)
            .OrderByDescending(g => g.Sum(f => f.Size))
            .Take(10)
            .ToList();

        Console.WriteLine("\n=== SPACE BY APPLICATION ===");
        foreach (var group in appGroups)
        {
            long groupSize = group.Sum(f => f.Size);
            int fileCount = group.Count();
            double percentage = (double)groupSize / totalSize;

            Console.WriteLine(group.Key + ": " + string.Format("{0:F2}", groupSize / 1024.0 / 1024.0 / 1024.0) + " GB (" + string.Format("{0:P1}", percentage) + ") - " + fileCount + " files");
        }

        // Group by risk level
        var riskGroups = files
            .Where(f => f.Size > 10 * 1024 * 1024) // Only files > 10MB
            .GroupBy(f => f.RiskLevel)
            .OrderByDescending(g => g.Sum(f => f.Size))
            .ToList();

        Console.WriteLine("\n=== SPACE BY RISK LEVEL ===");
        foreach (var group in riskGroups)
        {
            long groupSize = group.Sum(f => f.Size);
            int fileCount = group.Count();
            double percentage = (double)groupSize / totalSize;

            string emoji = "⚪";
            if (group.Key == "Critical") emoji = "🔴";
            else if (group.Key == "High") emoji = "🟠";
            else if (group.Key == "Medium") emoji = "🟡";
            else if (group.Key == "Low") emoji = "✅";

            Console.WriteLine(emoji + " " + group.Key + ": " + string.Format("{0:F2}", groupSize / 1024.0 / 1024.0 / 1024.0) + " GB (" + string.Format("{0:P1}", percentage) + ") - " + fileCount + " files");
        }

        Console.WriteLine("\n=== QUICK CLEANUP RECOMMENDATIONS ===");
        
        var safeToDelete = files
            .Where(f => f.RiskLevel == "Low" && f.Size > 10 * 1024 * 1024)
            .OrderByDescending(f => f.Size)
            .Take(10)
            .ToList();

        if (safeToDelete.Count > 0)
        {
            Console.WriteLine("✅ SAFE TO DELETE (Low Risk, >10MB):");
            foreach (var file in safeToDelete)
            {
                Console.WriteLine("  📄 " + file.Name + " - " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB");
            }
            long safeSpace = safeToDelete.Sum(f => f.Size);
            Console.WriteLine("  💾 Total space recovery: " + string.Format("{0:F2}", safeSpace / 1024.0 / 1024.0) + " MB\n");
        }

        var reviewFirst = files
            .Where(f => f.RiskLevel == "Medium" && f.Size > 50 * 1024 * 1024)
            .OrderByDescending(f => f.Size)
            .Take(10)
            .ToList();

        if (reviewFirst.Count > 0)
        {
            Console.WriteLine("🟡 REVIEW BEFORE DELETING (Medium Risk, >50MB):");
            foreach (var file in reviewFirst)
            {
                Console.WriteLine("  📄 " + file.Name + " - " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB");
                Console.WriteLine("     📁 " + file.Path);
            }
            long reviewSpace = reviewFirst.Sum(f => f.Size);
            Console.WriteLine("  💾 Potential space recovery: " + string.Format("{0:F2}", reviewSpace / 1024.0 / 1024.0) + " MB\n");
        }

        var doNotDelete = files
            .Where(f => (f.RiskLevel == "Critical" || f.RiskLevel == "High") && f.Size > 10 * 1024 * 1024)
            .OrderByDescending(f => f.Size)
            .Take(10)
            .ToList();

        if (doNotDelete.Count > 0)
        {
            Console.WriteLine("🔴 DO NOT DELETE (Critical/High Risk):");
            foreach (var file in doNotDelete)
            {
                Console.WriteLine("  📄 " + file.Name + " - " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB");
                Console.WriteLine("     ⚠️  " + file.Reason);
            }
        }
    }

    public static int Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.WriteLine("Usage: SpaceHogAnalyzer.exe <directory_path>");
            Console.WriteLine("Example: SpaceHogAnalyzer.exe \"C:\\Users\\Aomega Imaging\"");
            return 1;
        }

        string directoryPath = args[0];

        if (!Directory.Exists(directoryPath))
        {
            Console.WriteLine("Error: Directory does not exist: " + directoryPath);
            return 1;
        }

        Console.WriteLine("Starting SPACE HOG analysis...");
        Console.WriteLine("Target directory: " + directoryPath + "\n");

        InitializeDirectories();

        var stopwatch = Stopwatch.StartNew();

        try
        {
            // Fast scanning using Windows API
            var files = FastScanDirectory(directoryPath, 200000);
            
            // Quick analysis for all files
            Console.WriteLine("Analyzing files for space impact...");
            foreach (var file in files)
            {
                AnalyzeFileQuick(file);
            }
            
            stopwatch.Stop();

            Console.WriteLine("\nAnalysis completed in " + string.Format("{0:F2}", stopwatch.Elapsed.TotalSeconds) + " seconds\n");
            PrintSpaceHogAnalysis(files);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error during analysis: " + ex.Message);
            return 1;
        }

        Console.WriteLine("\nSpace hog analysis complete!");
        return 0;
    }
}
