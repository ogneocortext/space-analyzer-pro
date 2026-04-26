# File Explorer Integration Guide

This guide explains how to integrate Space Analyzer Pro with Windows File Explorer for seamless directory analysis.

## 🚀 Quick Setup

### Option 1: Desktop Shortcuts (Easiest)
1. Run `create_desktop_shortcut.bat` as administrator
2. Desktop shortcuts will be created for common directories
3. Double-click any shortcut to analyze that directory

### Option 2: Protocol Handler Registration (Advanced)
1. Run `register_protocol.bat` as administrator
2. Configure Windows Explorer file associations
3. Right-click folders → "Open with Space Analyzer"

### Option 3: Manual URL Creation
- Create desktop shortcuts with URLs like:
  ```
  http://localhost:8080/open?path=C:\Users\YourName\Documents
  ```
- Or use the protocol handler:
  ```
  spaceanalyzer://open?path=C:\Users\YourName\Documents
  ```

## 📋 Features

### ✅ What's Supported
- **Manual path entry**: Type any full directory path
- **Desktop shortcuts**: Pre-configured shortcuts for common locations
- **Protocol handler**: `spaceanalyzer://` URLs for deep integration
- **Drag & drop**: Limited support (browser security restrictions)
- **URL parameters**: `?path=` parameter support

### ⚠️ Browser Limitations
Due to browser security policies:
- Cannot access full filesystem paths from drag & drop
- Directory browsing limited to project subdirectories
- File Explorer integration requires protocol handler setup

## 🔧 Technical Details

### Protocol Handler
- **Protocol**: `spaceanalyzer://`
- **Format**: `spaceanalyzer://open?path=<directory_path>`
- **Handler**: `protocol_launcher.bat`

### CSP Modifications
The Content Security Policy has been updated to allow:
- Custom protocol handlers
- Cross-origin communication for file explorer integration

### API Endpoints
- **`/open?path=<path>`**: Accepts path parameter and populates the UI
- **Window messaging**: Protocol handler communicates via `postMessage`

## 🐛 Troubleshooting

### Protocol Handler Not Working
1. **Check administrator privileges**: Protocol registration requires admin rights
2. **Verify server is running**: The protocol launcher starts the server if needed
3. **Check registry**: Look for `HKCR\spaceanalyzer` in regedit

### Paths Not Populating
1. **URL encoding**: Make sure paths are properly URL-encoded
2. **Server running**: Check if the web server is accessible on port 8080
3. **Browser security**: Some browsers block custom protocols

### Drag & Drop Issues
1. **Browser limitations**: Drag & drop cannot provide full paths due to security
2. **Use manual entry**: Type the full path for best results

## 📁 Directory Path Examples

```bash
# Windows paths
C:\Users\YourName\Documents
C:\Program Files
D:\Projects\MyApp

# UNC paths
\\server\share\folder

# Relative paths (from project root)
.
src
tests
```

## 🎯 Best Practices

1. **Use manual path entry** for most reliable results
2. **Set up desktop shortcuts** for frequently analyzed directories
3. **Keep the web server running** for protocol handler functionality
4. **Use absolute paths** to avoid ambiguity

## 🔄 Alternative Integration Methods

If protocol handlers don't work in your environment, consider:
- **Batch file wrappers** that launch the web app with specific paths
- **PowerShell scripts** for directory analysis workflows
- **Context menu extensions** (advanced Windows development)

---

**Need help?** Check the server logs for detailed error messages and ensure you're running all scripts with administrator privileges.