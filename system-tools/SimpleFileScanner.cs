using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class SimpleFileScanner
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

    // Windows API imports for advanced file analysis
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr FindFirstFile(string lpFileName, out WIN32_FIND_DATA lpFindFileData);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool FindNextFile(IntPtr hFindFile, out WIN32_FIND_DATA lpFindFileData);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool FindClose(IntPtr hFindFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetFileAttributesEx(string lpFileName, int fInfoLevelId, out FILE_ATTRIBUTE_DATA fileData);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetCompressedFileSizeEx(string lpFileName, out long lpFileSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetDiskFreeSpaceEx(string lpDirectoryName, out long lpFreeBytesAvailable, out long lpTotalBytes, out long lpTotalFreeBytes);

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

    private const int GetFileExInfoStandard = 0;
    private const uint FILE_ATTRIBUTE_COMPRESSED = 0x800;
    private const uint FILE_ATTRIBUTE_SPARSE_FILE = 0x200;
    private const uint FILE_ATTRIBUTE_REPARSE_POINT = 0x400;
    private const uint FILE_ATTRIBUTE_HIDDEN = 0x2;
    private const uint FILE_ATTRIBUTE_SYSTEM = 0x4;

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

    private static List<string> GetAlternateDataStreams(string filePath)
    {
        var streams = new List<string>();
        try
        {
            // Use PowerShell to detect alternate data streams
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-Command \"Get-Item '" + filePath + "' -Stream * | Select-Object Stream\"",
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
                            streams.Add(parts[1].Trim());
                        }
                    }
                }
            }
        }
        catch
        {
            // PowerShell not available or other error
        }
        return streams;
    }

    private static string GetReparsePointTarget(string filePath)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-Command \"(Get-Item '" + filePath + "').Target\"",
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
                    return output;
                }
            }
        }
        catch
        {
            // PowerShell not available or other error
        }
        return "";
    }

    private static int GetHardLinkCount(string filePath)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "fsutil.exe",
                Arguments = "hardlink list \"" + filePath + "\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            using (var process = Process.Start(psi))
            {
                var output = process.StandardOutput.ReadToEnd();
                var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                return lines.Length;
            }
        }
        catch
        {
            // fsutil not available or other error
            return 1;
        }
    }

    private static FileAnalysisInfo AnalyzeFileAdvanced(string filePath)
    {
        var fileInfo = new FileAnalysisInfo
        {
            Path = filePath,
            Name = Path.GetFileName(filePath)
        };

        try
        {
            // Get basic file info
            var sysFileInfo = new System.IO.FileInfo(filePath);
            fileInfo.Size = sysFileInfo.Length;
            fileInfo.Created = sysFileInfo.CreationTime;
            fileInfo.Modified = sysFileInfo.LastWriteTime;
            fileInfo.Accessed = sysFileInfo.LastAccessTime;
            fileInfo.Extension = sysFileInfo.Extension;
            fileInfo.DaysOld = (int)(DateTime.Now - sysFileInfo.LastWriteTime).TotalDays;

            // Get advanced attributes
            FILE_ATTRIBUTE_DATA fileData;
            if (GetFileAttributesEx(filePath, GetFileExInfoStandard, out fileData))
            {
                fileInfo.IsSystem = (fileData.dwFileAttributes & FILE_ATTRIBUTE_SYSTEM) != 0;
                fileInfo.IsHidden = (fileData.dwFileAttributes & FILE_ATTRIBUTE_HIDDEN) != 0;
                fileInfo.IsCompressed = (fileData.dwFileAttributes & FILE_ATTRIBUTE_COMPRESSED) != 0;
                fileInfo.IsSparse = (fileData.dwFileAttributes & FILE_ATTRIBUTE_SPARSE_FILE) != 0;
                fileInfo.IsReparsePoint = (fileData.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0;
            }

            // Get compressed size if file is compressed
            if (fileInfo.IsCompressed)
            {
                long compressedSize;
                if (GetCompressedFileSizeEx(filePath, out compressedSize))
                {
                    fileInfo.CompressedSize = compressedSize;
                }
            }

            // Get actual size on disk (considering cluster size)
            try
            {
                // Use a standard cluster size of 4KB for NTFS
                long clusterSize = 4096;
                fileInfo.ActualSizeOnDisk = ((fileInfo.Size + clusterSize - 1) / clusterSize) * clusterSize;
            }
            catch
            {
                fileInfo.ActualSizeOnDisk = fileInfo.Size;
            }

            // Check for alternate data streams
            fileInfo.AlternateStreams = GetAlternateDataStreams(filePath);
            fileInfo.HasAlternateStreams = fileInfo.AlternateStreams.Count > 0;

            // Get hard link count
            fileInfo.HardLinkCount = GetHardLinkCount(filePath);

            // Get reparse point target
            if (fileInfo.IsReparsePoint)
            {
                fileInfo.ReparseTarget = GetReparsePointTarget(filePath);
            }

            // Find source application
            fileInfo.SourceApp = FindSourceApplication(filePath);

            // Check regeneration mechanism
            fileInfo.RegenerationMechanism = CheckRegenerationMechanism(filePath);

            // Determine creation method
            fileInfo.CreationMethod = DetermineCreationMethod(fileInfo.Name);

            // Analyze impact
            AnalyzeFileImpact(fileInfo);
        }
        catch (Exception ex)
        {
            fileInfo.RiskLevel = "Medium";
            fileInfo.Reason = "Error analyzing file: " + ex.Message;
        }

        return fileInfo;
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
                if (filePath.StartsWith(progDir, StringComparison.OrdinalIgnoreCase))
                {
                    string relativePath = filePath.Substring(progDir.Length);
                    string[] parts = relativePath.Split(new[] { Path.DirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length > 0)
                    {
                        return parts[0];
                    }
                }
            }

            string fileName = Path.GetFileName(filePath).ToLower();
            foreach (KeyValuePair<string, string> app in ApplicationSignatures)
            {
                string[] patterns = app.Value.Split('|');
                foreach (string pattern in patterns)
                {
                    string patternWithoutWildcards = pattern.Replace("*", "");
                    if (fileName.Contains(patternWithoutWildcards) || fileName.EndsWith(patternWithoutWildcards))
                    {
                        return app.Key;
                    }
                }
            }
        }
        catch
        {
            // Ignore errors in source detection
        }

        return "Unknown";
    }

    private static string CheckRegenerationMechanism(string filePath)
    {
        try
        {
            foreach (string tempDir in TempDirectories)
            {
                if (filePath.StartsWith(tempDir, StringComparison.OrdinalIgnoreCase))
                {
                    return "Temporary Directory - System Recreation";
                }
            }

            foreach (string cacheDir in CacheDirectories)
            {
                if (filePath.StartsWith(cacheDir, StringComparison.OrdinalIgnoreCase))
                {
                    return "Cache Directory - Application Regeneration";
                }
            }
        }
        catch
        {
            // Ignore errors in regeneration detection
        }

        return "";
    }

    private static string DetermineCreationMethod(string fileName)
    {
        string lowerName = fileName.ToLower();

        if (lowerName.StartsWith("tmp") || lowerName.Contains("temp"))
        {
            return "Temporary File Creation";
        }
        if (lowerName.StartsWith("~$"))
        {
            return "Office Application Backup";
        }
        if (lowerName.EndsWith(".log"))
        {
            return "Application Logging";
        }
        if (lowerName.Contains(".cache"))
        {
            return "Application Cache";
        }

        return "Unknown";
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
            return;
        }

        if (lowerPath.Contains("\\program files\\") || lowerPath.Contains("\\program files (x86)\\"))
        {
            fileInfo.RiskLevel = "High";
            fileInfo.Reason = "Part of installed application";
            if (!string.IsNullOrEmpty(fileInfo.SourceApp))
            {
                fileInfo.Reason += " - " + fileInfo.SourceApp;
            }
            fileInfo.Consequences.Add("Application may malfunction or fail to start");
            fileInfo.RecoveryOptions.Add("Reinstall affected application");
            return;
        }

        if (!string.IsNullOrEmpty(fileInfo.RegenerationMechanism))
        {
            fileInfo.RiskLevel = "Medium";
            fileInfo.Reason = "File may regenerate after deletion - " + fileInfo.RegenerationMechanism;
            fileInfo.Consequences.Add("File will be recreated by system or application");
            fileInfo.RecoveryOptions.Add("Disable regeneration mechanism");
            return;
        }

        if (fileInfo.DaysOld > 365)
        {
            fileInfo.RiskLevel = "Low";
            fileInfo.Reason = "Old unused file - safe to delete";
            fileInfo.RecoveryOptions.Add("File can be safely deleted");
        }
        else if (fileInfo.Size < 1024 * 1024)
        {
            fileInfo.RiskLevel = "Low";
            fileInfo.Reason = "Small file - minimal impact";
            fileInfo.RecoveryOptions.Add("File can be safely deleted");
        }
        else
        {
            fileInfo.RiskLevel = "Medium";
            fileInfo.Reason = "Unknown file type - manual review recommended";
            fileInfo.RecoveryOptions.Add("Manual review before deletion");
        }
    }

    private static List<FileAnalysisInfo> ScanDirectory(string directoryPath, int maxDepth, int maxFiles)
    {
        List<FileAnalysisInfo> files = new List<FileAnalysisInfo>();
        int scannedCount = 0;

        try
        {
            Console.WriteLine("Scanning: " + directoryPath);

            Stack<string> directories = new Stack<string>();
            directories.Push(directoryPath);

            while (directories.Count > 0 && scannedCount < maxFiles)
            {
                string currentDir = directories.Pop();

                try
                {
                    DirectoryInfo dirInfo = new DirectoryInfo(currentDir);

                    foreach (FileInfo file in dirInfo.GetFiles())
                    {
                        if (scannedCount >= maxFiles) break;

                        try
                        {
                            FileAnalysisInfo fileInfo = AnalyzeFileAdvanced(file.FullName);

                            files.Add(fileInfo);
                            scannedCount++;

                            if (scannedCount % 100 == 0)
                            {
                                Console.WriteLine("Scanned " + scannedCount + " files...");
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine("Error processing file " + file.Name + ": " + ex.Message);
                        }
                    }

                    if (currentDir.Length - directoryPath.Length < 1000)
                    {
                        foreach (DirectoryInfo dir in dirInfo.GetDirectories())
                        {
                            try
                            {
                                if (!dir.Name.StartsWith("$") && 
                                    !dir.Name.Equals("System Volume Information", StringComparison.OrdinalIgnoreCase) &&
                                    !dir.Attributes.HasFlag(FileAttributes.ReparsePoint))
                                {
                                    directories.Push(dir.FullName);
                                }
                            }
                            catch
                            {
                                // Skip inaccessible directories
                            }
                        }
                    }
                }
                catch (UnauthorizedAccessException)
                {
                    Console.WriteLine("Access denied to: " + currentDir);
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Error scanning directory " + currentDir + ": " + ex.Message);
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error in ScanDirectory: " + ex.Message);
        }

        return files;
    }

    private static void PrintAnalysis(List<FileAnalysisInfo> files)
    {
        Console.WriteLine("\n=== ADVANCED FILE ANALYSIS RESULTS ===");
        Console.WriteLine("Total files analyzed: " + files.Count + "\n");

        // Calculate advanced statistics
        long totalLogicalSize = files.Sum(f => f.Size);
        long totalActualSize = files.Sum(f => f.ActualSizeOnDisk);
        long totalCompressedSize = files.Sum(f => f.CompressedSize > 0 ? f.CompressedSize : f.Size);
        var filesWithADS = files.Where(f => f.HasAlternateStreams).ToList();
        var compressedFiles = files.Where(f => f.IsCompressed).ToList();
        var sparseFiles = files.Where(f => f.IsSparse).ToList();
        var reparsePoints = files.Where(f => f.IsReparsePoint).ToList();
        var hardLinkedFiles = files.Where(f => f.HardLinkCount > 1).ToList();

        Console.WriteLine("=== ADVANCED SPACE ANALYSIS ===");
        Console.WriteLine("Logical Size: " + string.Format("{0:F2}", totalLogicalSize / 1024.0 / 1024.0 / 1024.0) + " GB");
        Console.WriteLine("Actual Size on Disk: " + string.Format("{0:F2}", totalActualSize / 1024.0 / 1024.0 / 1024.0) + " GB");
        Console.WriteLine("Compressed Size: " + string.Format("{0:F2}", totalCompressedSize / 1024.0 / 1024.0 / 1024.0) + " GB");
        Console.WriteLine("Space Saved by Compression: " + string.Format("{0:F2}", (totalLogicalSize - totalCompressedSize) / 1024.0 / 1024.0) + " MB");
        Console.WriteLine("Cluster Waste: " + string.Format("{0:F2}", (totalActualSize - totalLogicalSize) / 1024.0 / 1024.0) + " MB");
        Console.WriteLine("Files with Alternate Data Streams: " + filesWithADS.Count);
        Console.WriteLine("Compressed Files: " + compressedFiles.Count);
        Console.WriteLine("Sparse Files: " + sparseFiles.Count);
        Console.WriteLine("Reparse Points: " + reparsePoints.Count);
        Console.WriteLine("Files with Hard Links: " + hardLinkedFiles.Count + "\n");

        // Show files with alternate data streams
        if (filesWithADS.Count > 0)
        {
            Console.WriteLine("🔍 FILES WITH ALTERNATE DATA STREAMS:");
            foreach (var file in filesWithADS.Take(10))
            {
                Console.WriteLine("  📄 " + file.Name);
                Console.WriteLine("     Size: " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB | Streams: " + file.AlternateStreams.Count);
                Console.WriteLine("     Streams: " + string.Join(", ", file.AlternateStreams));
                Console.WriteLine("     Path: " + file.Path + "\n");
            }
        }

        // Show compressed files
        if (compressedFiles.Count > 0)
        {
            Console.WriteLine("🗜️ COMPRESSED FILES:");
            foreach (var file in compressedFiles.OrderByDescending(f => f.Size).Take(10))
            {
                Console.WriteLine("  📄 " + file.Name);
                Console.WriteLine("     Original: " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB | Compressed: " + string.Format("{0:F2}", file.CompressedSize / 1024.0 / 1024.0) + " MB");
                Console.WriteLine("     Compression Ratio: " + string.Format("{0:P1}", 1.0 - (double)file.CompressedSize / file.Size));
                Console.WriteLine("     Path: " + file.Path + "\n");
            }
        }

        // Show reparse points
        if (reparsePoints.Count > 0)
        {
            Console.WriteLine("🔗 REPARSE POINTS:");
            foreach (var file in reparsePoints.Take(10))
            {
                Console.WriteLine("  📄 " + file.Name);
                Console.WriteLine("     Type: " + (file.ReparseTarget.Contains("junction") ? "Junction" : "Symbolic Link"));
                Console.WriteLine("     Target: " + file.ReparseTarget);
                Console.WriteLine("     Path: " + file.Path + "\n");
            }
        }

        // Show hard linked files
        if (hardLinkedFiles.Count > 0)
        {
            Console.WriteLine("⛓️ HARD LINKED FILES:");
            foreach (var file in hardLinkedFiles.OrderByDescending(f => f.HardLinkCount).Take(10))
            {
                Console.WriteLine("  📄 " + file.Name);
                Console.WriteLine("     Size: " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB | Links: " + file.HardLinkCount);
                Console.WriteLine("     Total Space Used: " + string.Format("{0:F2}", file.Size * file.HardLinkCount / 1024.0 / 1024.0) + " MB");
                Console.WriteLine("     Path: " + file.Path + "\n");
            }
        }

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
                if (file.IsCompressed)
                {
                    Console.WriteLine("     🗜️ Compressed: " + string.Format("{0:F2}", file.CompressedSize / 1024.0 / 1024.0) + " MB");
                }
                Console.WriteLine("     Path: " + file.Path);
                Console.WriteLine("     Consequences: " + string.Join(", ", file.Consequences));
                Console.WriteLine("     Recovery: " + string.Join(", ", file.RecoveryOptions) + "\n");
            }
        }

        if (groupedFiles.ContainsKey("High"))
        {
            Console.WriteLine("🟠 HIGH RISK FILES:");
            foreach (var file in groupedFiles["High"])
            {
                Console.WriteLine("  ⚠️ " + file.Name);
                Console.WriteLine("     Size: " + string.Format("{0:F2}", file.Size / 1024.0 / 1024.0) + " MB | Age: " + file.DaysOld + " days");
                Console.WriteLine("     Reason: " + file.Reason);
                Console.WriteLine("     🔍 Source: " + file.SourceApp);
                if (file.HardLinkCount > 1)
                {
                    Console.WriteLine("     ⛓️ Hard Links: " + file.HardLinkCount);
                }
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
                if (file.HasAlternateStreams)
                {
                    Console.WriteLine("     🔍 Has " + file.AlternateStreams.Count + " alternate streams");
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
                if (file.IsCompressed)
                {
                    Console.WriteLine("     🗜️ Compressed: " + string.Format("{0:F2}", file.CompressedSize / 1024.0 / 1024.0) + " MB");
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
            Console.WriteLine("🗜️ Compressed Files: " + compressedFiles.Count + " files - saving " + string.Format("{0:F2}", (totalLogicalSize - totalCompressedSize) / 1024.0 / 1024.0) + " MB");
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
            Console.WriteLine("Usage: SimpleFileScanner.exe <directory_path>");
            Console.WriteLine("Example: SimpleFileScanner.exe \"C:\\Users\\Aomega Imaging\"");
            return 1;
        }

        string directoryPath = args[0];

        if (!Directory.Exists(directoryPath))
        {
            Console.WriteLine("Error: Directory does not exist: " + directoryPath);
            return 1;
        }

        Console.WriteLine("Starting simple file analysis...");
        Console.WriteLine("Target directory: " + directoryPath + "\n");

        InitializeDirectories();

        var stopwatch = Stopwatch.StartNew();

        try
        {
            var files = ScanDirectory(directoryPath, 10, 50000);
            stopwatch.Stop();

            Console.WriteLine("\nAnalysis completed in " + string.Format("{0:F2}", stopwatch.Elapsed.TotalSeconds) + " seconds\n");
            PrintAnalysis(files);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error during analysis: " + ex.Message);
            return 1;
        }

        return 0;
    }
}
