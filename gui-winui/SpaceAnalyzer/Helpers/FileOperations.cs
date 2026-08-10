// Licensed under the MIT License.

using System;
using System.IO;
using System.Runtime.InteropServices;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Safe file operations that route deletions through the Windows Recycle Bin so
/// cleanup actions remain recoverable. Used by the Cleanup page for temp/cache
/// removal so nothing is permanently lost on a misclick.
/// </summary>
public static class FileOperations
{
    private const uint FO_DELETE = 0x0003;
    private const ushort FOF_ALLOWUNDO = 0x0040;     // send to recycle bin
    private const ushort FOF_NOCONFIRMATION = 0x0010;
    private const ushort FOF_NOERRORUI = 0x0400;
    private const ushort FOF_SILENT = 0x0004;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct SHFILEOPSTRUCT
    {
        public IntPtr hwnd;
        public uint wFunc;
        [MarshalAs(UnmanagedType.LPWStr)] public string pFrom;
        [MarshalAs(UnmanagedType.LPWStr)] public string pTo;
        public ushort fFlags;
        public bool fAnyOperationsAborted;
        public IntPtr hNameMappings;
        [MarshalAs(UnmanagedType.LPWStr)] public string lpszProgressTitle;
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int SHFileOperation(ref SHFILEOPSTRUCT lpFileOp);

    /// <summary>
    /// Moves a file or directory to the Recycle Bin. Returns true on success.
    /// </summary>
    public static bool SendToRecycleBin(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || (!File.Exists(path) && !Directory.Exists(path)))
            return false;

        var op = new SHFILEOPSTRUCT
        {
            wFunc = FO_DELETE,
            pFrom = path + "\0\0", // double-null terminated list
            fFlags = (ushort)(FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT),
        };

        int result = SHFileOperation(ref op);
        return result == 0 && !op.fAnyOperationsAborted;
    }

    /// <summary>
    /// Permanently deletes without the Recycle Bin. Only call when explicitly requested.
    /// </summary>
    public static void DeletePermanently(string path)
    {
        if (Directory.Exists(path))
            Directory.Delete(path, true);
        else if (File.Exists(path))
            File.Delete(path);
    }

    /// <summary>
    /// Returns true when the Windows Recycle Bin contains at least one item.
    /// Used to decide whether to offer the user an "empty the bin" action after
    /// a delete routed through <see cref="SendToRecycleBin"/>.
    /// </summary>
    public static bool RecycleBinHasItems()
    {
        try
        {
            var query = new SHQUERYRBINFO { cbSize = Marshal.SizeOf<SHQUERYRBINFO>() };
            if (SHQueryRecycleBin(null, ref query) == 0)
                return query.i64NumItems > 0;
        }
        catch { /* non-fatal */ }
        return false;
    }

    /// <summary>
    /// Empties the Windows Recycle Bin. <paramref name="noConfirmation"/> avoids
    /// the native confirmation dialog; the caller is responsible for asking the
    /// user first. Returns true when the shell call succeeds.
    /// </summary>
    public static bool EmptyRecycleBin(bool noConfirmation = true)
    {
        try
        {
            uint flags = 0;
            if (noConfirmation) flags |= 0x0001; // SHERB_NOCONFIRMATION
            flags |= 0x0002; // SHERB_NOPROGRESSUI
            flags |= 0x0004; // SHERB_NOSOUND
            return SHEmptyRecycleBin(IntPtr.Zero, null, flags) == 0;
        }
        catch { /* non-fatal */ }
        return false;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct SHQUERYRBINFO
    {
        public int cbSize;
        public ulong i64Size;
        public ulong i64NumItems;
        public ulong i64NumBytes;
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int SHQueryRecycleBin(string? pszRootPath, ref SHQUERYRBINFO pSHQueryRBInfo);

    [DllImport("shell32.dll", SetLastError = true)]
    private static extern int SHEmptyRecycleBin(IntPtr hwnd, string? pszRootPath, uint dwFlags);

    /// <summary>
    /// Recursively computes the total size (bytes) of a file or directory.
    /// </summary>
    public static ulong GetSize(string path)
    {
        try
        {
            if (File.Exists(path))
                return (ulong)new FileInfo(path).Length;

            if (Directory.Exists(path))
            {
                ulong total = 0;
                foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
                {
                    try { total += (ulong)new FileInfo(file).Length; }
                    catch { /* skip unreadable */ }
                }
                return total;
            }
        }
        catch { /* ignore */ }
        return 0;
    }
}
