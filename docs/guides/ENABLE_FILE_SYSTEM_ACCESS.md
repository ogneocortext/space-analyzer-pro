# Enable File System Access API for Better Folder Selection

## 🔧 Enable Better Folder Selection in Your Browser

The File System Access API allows web apps to interact with your local file system safely. Here's how to enable it:

## 🌐 Chrome/Edge (Recommended)

### Method 1: Enable via Flags (Best Experience)
1. Open your browser and navigate to: `chrome://flags/` (Chrome) or `edge://flags/` (Edge)
2. Search for: **"File System Access API"**
3. Enable the flag: **"File System Access API"**
4. Also enable: **"File System Access API persistent permissions"**
5. Click **"Relaunch"** to restart your browser

### Method 2: Enable via Command Line
```bash
# Chrome
chrome.exe --enable-features=FileSystemAccess,FileSystemAccessPersistentPermissions

# Edge
msedge.exe --enable-features=FileSystemAccess,FileSystemAccessPersistentPermissions
```

## 🦊 Firefox

Firefox has limited File System Access API support. Use Chrome/Edge for best experience.

## 📱 What This Enables

✅ **Native folder picker** - Like desktop apps  
✅ **Drag & drop folders** - Direct folder selection  
✅ **Persistent permissions** - Don't re-prompt every time  
✅ **Better integration** - Seamless file system access  
✅ **Real file access** - Read AND write files directly from your system  
✅ **Full file management** - Delete, rename, organize files in browser  
✅ **Complete Rust CLI integration** - Analyze and manage any directory seamlessly

## 🎯 After Enabling

1. Refresh the Space Analyzer web app
2. Click **"Browse"** button
3. You'll see a **native folder selection dialog**
4. Select any folder - it will automatically populate the path
5. Click **"Start Neural Analysis"** to analyze with Rust CLI

## 🔒 Security & Safety

- **User permission required** - Browser asks for your permission first
- **Read/write access** - App can read and manage files with your consent
- **Origin-specific** - Only localhost can access your files
- **Revocable** - You can revoke permissions anytime in browser settings
- **User confirmation** - Delete/rename actions require confirmation

## 🚀 Troubleshooting

### API Still Not Working?
1. Ensure browser is updated to latest version
2. Try incognito/private mode
3. Check if Controlled Folder Access is blocking (Windows Security)
4. Restart browser after enabling flags

### Windows Controlled Folder Access
1. Open **Windows Security**
2. Go to **"Virus & threat protection"**
3. Click **"Manage settings"** under Controlled Folder Access
4. Add your browser to **"Allow an app through Controlled folder access"**

## 📋 Quick Setup Checklist

- [ ] Browser updated to latest version
- [ ] File System Access API flags enabled
- [ ] Browser restarted
- [ ] Refresh the web app
- [ ] Test folder selection

## 🎉 Benefits

With File System Access API enabled:
- **No more typing paths** - Click to select folders
- **Visual folder navigation** - Browse like in File Explorer  
- **Faster workflow** - Select any folder instantly
- **Better UX** - Modern, desktop-like experience
- **Full Rust CLI integration** - Analyze any directory seamlessly

Enable this once and enjoy a much better folder selection experience!
