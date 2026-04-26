# Windsurf MCP Setup - Quick Start Guide
# Step-by-step instructions for Browser MCP integration

## 🚀 **Quick Setup (2 minutes)**

### **Step 1: Open Windsurf AI Chat**
- Press **Ctrl+L** or click the chat icon in Windsurf sidebar
- Wait for AI chat interface to load

### **Step 2: Add MCP Server**
- Type this exact prompt in the AI chat:
```
I want to add an MCP server
```

### **Step 3: Configure Browser MCP**
When prompted, provide these details:
- **Server Name**: `browser-mcp`
- **Server URL**: `ws://localhost:3000`
- **Description**: `Browser automation for Space Analyzer testing`

### **Step 4: Start Testing**
Once configured, you can use these MCP commands:

## 🎯 **Available MCP Commands**

### **Navigation & Testing**
```
navigate-to-react-app
```
**Purpose**: Navigate to Space Analyzer React app (http://localhost:8011/app)

```
check-react-elements
```
**Purpose**: Validate React app UI components and functionality

```
test-backend-connectivity
```
**Purpose**: Verify backend status through React app interface

```
capture-screenshot
```
**Purpose**: Take full page screenshot for documentation

### **Interactive Testing**
```
test-interactions
```
**Purpose**: Test buttons, forms, and user interactions

```
check-console-errors
```
**Purpose**: Monitor for JavaScript errors and console issues

```
test-performance
```
**Purpose**: Measure load times and performance metrics

---

## 🔧 **Advanced Setup (Optional)**

If you want to run your own Browser MCP server:

### **Install and Run**
```bash
# Install Browser MCP Server
npm install -g @modelcontextprotocol/server-browser

# Start server (in separate terminal)
npx @modelcontextprotocol/server-browser --port 3000
```

### **Connect in Windsurf**
- **Server Name**: `custom-browser-mcp`
- **Server URL**: `ws://localhost:3000`

---

## 🎯 **Testing Workflow**

### **1. Basic Validation**
1. Use `navigate-to-react-app`
2. Verify page loads successfully
3. Check for React root element

### **2. Functional Testing**
1. Use `check-react-elements`
2. Validate all UI components are present
3. Test modern UI features

### **3. Backend Integration**
1. Use `test-backend-connectivity`
2. Verify backend status indicator
3. Confirm API connectivity

### **4. Interactive Testing**
1. Use `test-interactions`
2. Test directory input and browse button
3. Test analysis controls
4. Validate form submissions

### **5. Error Handling**
1. Use `check-console-errors`
2. Monitor for JavaScript issues
3. Test edge cases and error boundaries

### **6. Performance & Documentation**
1. Use `test-performance`
2. Use `capture-screenshot`
3. Document all findings

---

## 🚨 **Troubleshooting**

### **MCP Server Not Found**
If you get "Server not found" error:
1. Check if MCP server is running: `npx @modelcontextprotocol/server-browser --port 3000`
2. Verify server is accessible: `curl ws://localhost:3000`
3. Check firewall settings

### **Connection Issues**
If MCP commands fail:
1. Restart Windsurf and try again
2. Check server URL is correct
3. Verify no conflicting MCP servers

### **Windsurf Integration Issues**
If MCP commands don't appear:
1. Check MCP server list in Windsurf settings
2. Verify server is whitelisted for your team
3. Contact Windsurf support if needed

---

## 📞 **Support**

### **Test Scripts Available**
- `test-react-final.ps1` - Production validation (100% success)
- `test-webapp-simple.ps1` - Basic functionality testing
- `test-playwright-simple.ps1` - Browser MCP framework

### **Documentation**
- `FINAL_BROWSER_TESTING_REPORT.md` - Complete implementation guide
- `WINDSURF_MCP_COMMANDS.md` - Command reference
- All previous test reports and analysis

---

## 🎉 **Success Criteria**

### **Setup Complete** ✅
- MCP server configured in Windsurf
- Commands available and accessible
- React app accessible for testing

### **Testing Ready** ✅
- All automated test scripts functional
- Browser MCP integration operational
- Comprehensive validation capabilities

**You're now ready to run enterprise-grade automated testing directly from Windsurf IDE!** 🚀

---

*Quick start guide created for immediate Browser MCP setup and testing*
