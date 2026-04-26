# Quick Start Guide - Space Analyzer 2026

## 🚀 Starting the Application

### Method 1: Double-Click (Easiest)
1. Double-click `start_server.bat`
2. Wait for the message: "🚀 Space Analyzer Backend & Launcher running at http://localhost:8011"
3. Your browser will open automatically

### Method 2: Command Line
```bash
python launcher_server.py
```

## 🌐 Accessing the Application

Once the server is running, open your browser to:

### Main URLs
- **Landing Page**: http://localhost:8011
- **Web App**: http://localhost:8011/app ⭐ **(Recommended - Clean URL)**
- **API Health Check**: http://localhost:8011/api/health

## ✅ Quick Health Check

If nothing loads, verify the server is running:

```powershell
# Check if server is listening
netstat -ano | findstr :8011

# Test the API
Invoke-WebRequest -Uri "http://localhost:8011/api/health"
```

Expected response:
```json
{
  "status": "ok",
  "cppBackend": true,
  "message": "Launcher backend running"
}
```

## 🔧 Troubleshooting

### Problem: "This site can't be reached"

**Solution:**
1. Make sure the server is running (you should see the 🚀 message)
2. Check no other program is using port 8011
3. Try restarting the server

### Problem: Server won't start

**Solution:**
1. Kill any old Python processes:
   ```powershell
   Get-Process python | Stop-Process -Force
   ```
2. Start fresh:
   ```bash
   python launcher_server.py
   ```

### Problem: Web app loads but analysis doesn't work

**Solution:**
1. Check the browser console for errors (F12)
2. Verify the backend is connected (look for green "Backend Connected" badge)
3. Make sure you're entering a valid directory path

## 📝 Using the Web App

1. **Enter a Directory Path**
   - Type or paste a full path like: `C:\Users\YourName\Documents`
   - Or click "📂 Browse" to enter one via prompt
   - Press **Enter** to start analysis immediately

2. **View Results**
   - See file count and total size
   - Browse the file list
   - Use action buttons: Reveal, Rename, Delete

3. **Keyboard Shortcuts**
   - **Enter**: Start analysis
   - **Escape**: (in prompts) Cancel

## 🎯 Common Paths to Analyze

```
C:\Users\YourName\Documents
C:\Users\YourName\Downloads
C:\Program Files
D:\Projects
E:\Media
```

## ⚙️ Server Management

### Stop the Server
- Press `Ctrl+C` in the terminal window
- Or close the terminal window

### Restart the Server
- Just run `python launcher_server.py` again
- Or double-click `start_server.bat`

## 📊 What's Running

**Only ONE server is needed:**
- ✅ `launcher_server.py` on port 8011 (handles everything)

**NOT needed for normal use:**
- ❌ `npm run dev` (only for development)
- ❌ `backend-server.js` (functionality merged into launcher)

## 🆘 Still Having Issues?

1. **Check the terminal** for error messages
2. **Check browser console** (F12 → Console tab)
3. **Verify port 8011 is free**: `netstat -ano | findstr :8011`
4. **Restart your browser** (clear cache if needed)

## 📚 Additional Resources

- `SERVER_ARCHITECTURE.md` - Detailed server architecture
- `walkthrough.md` - Latest changes and improvements
- `IMPROVEMENT_SUGGESTIONS.md` - Future enhancements
