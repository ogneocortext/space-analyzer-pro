# Space Analyzer 2026 - Server Architecture

## Unified Server Design

As of the latest update, Space Analyzer uses a **single unified server** architecture for simplicity and ease of management.

### What This Means

- **One Server to Rule Them All**: The `launcher_server.py` now handles everything:
  - Serving the landing page
  - Serving all three app versions (GUI, Web, CLI)
  - Providing all backend API endpoints for analysis and file management
  - No need to run multiple servers!

### How to Start the Application

#### Option 1: Simple Startup Script (Recommended)
Double-click `start_server.bat` (Windows) or run:
```bash
./start_server.bat
```

#### Option 2: Manual Start
```bash
python launcher_server.py
```

Then open your browser to: **http://localhost:8011**

### What Happened to the Other Servers?

The following servers are **no longer required** for normal operation:
- ❌ `src/web/server/backend-server.js` (port 8081) - functionality merged into launcher
- ❌ `npm run dev` (port 8080) - only needed for development

### Development Mode

If you're actively developing the React web app, you can still use:
```bash
cd src/web
npm run dev
```

The launcher will automatically detect the dev server on port 8080 and redirect to it.

### Dynamic URL Configuration

The web app now uses **dynamic URLs** that automatically adapt to:
- Different ports (8011 for production, 8080 for dev)
- Different drive letters or project locations
- Different deployment scenarios

No manual configuration needed!

### Architecture Benefits

✅ **Simplicity**: One server, one port, one command
✅ **Portability**: Works regardless of where the project is located
✅ **No CORS Issues**: Everything served from the same origin
✅ **Easy Deployment**: Just run `python launcher_server.py`

### Port Reference

| Port | Purpose | Status |
|------|---------|--------|
| 8011 | Unified Launcher Server | ✅ Required |
| 8080 | Vite Dev Server | ⚠️ Optional (dev only) |
| 8081 | Legacy Backend Server | ❌ Deprecated |

### Troubleshooting

**Q: The web app says "Backend Offline"**
A: Make sure `launcher_server.py` is running on port 8011

**Q: Analysis doesn't work**
A: Check that the launcher server is running and you can access http://localhost:8011/api/health

**Q: I moved the project to a different drive and it broke**
A: It shouldn't! The new dynamic URL system handles this automatically. If you still have issues, rebuild the web app:
```bash
cd src/web
npm run build
```

### For Developers

The React app's API bridge (`src/web/src/services/AnalysisBridge.ts`) now uses:
```typescript
this.baseUrl = `${window.location.origin}/api`;
```

This ensures it always points to the correct server, regardless of:
- Development vs production
- Port changes
- Drive letter changes
- Deployment location
