# Security Policy

This document outlines the security practices and policies for Space Analyzer Pro.

## 🛡️ Security Overview

Space Analyzer Pro is designed as a **local-first, single-user application** with security principles focused on protecting user data and system integrity.

## 🔒 Key Security Principles

### 1. Local-First Architecture
- **No network communication** except for optional AI services
- **No data collection** or telemetry sent to external servers
- **All processing** happens on the user's local machine
- **No authentication** required (localhost only)

### 2. Data Protection
- **No data exfiltration** - Files and analysis never leave the user's system
- **Local storage only** - All data stored in local SQLite database
- **No cloud dependencies** - Optional AI services run locally (Ollama) or with explicit API keys

### 3. System Access
- **Read-only file access** by default
- **Explicit user consent** for file operations (delete, move)
- **Sandboxed operation** - Limited to specified directories
- **No system modifications** without user action

## 🚨 Security Considerations

### File System Access
- **Scanner reads files** - Only reads file metadata and content for analysis
- **User-initiated deletions** - File deletions require explicit user action
- **Path validation** - Prevents path traversal attacks
- **Permission checks** - Respects file system permissions

### AI Services
- **Local AI (Ollama)** - Runs entirely on user's machine
- **Cloud AI (Gemini)** - Requires explicit API key configuration
- **Python AI Service** - Runs on localhost port 5000
- **No data retention** - AI services don't store analysis data

### Network Communication
- **Optional only** - Network access disabled by default
- **Localhost only** - AI services bind to localhost
- **User control** - Users must explicitly enable network features
- **No telemetry** - No data sent to external servers

## 🔐 Security Features

### Input Validation
- **Path sanitization** - Prevents directory traversal
- **File type validation** - Checks file extensions and magic numbers
- **Size limits** - Prevents memory exhaustion from large files
- **SQL injection protection** - Parameterized queries for database

### Error Handling
- **No sensitive data exposure** - Error messages don't reveal paths
- **Graceful degradation** - Services fail safely without data loss
- **Audit logging** - Security events logged locally
- **Resource cleanup** - Proper cleanup of temporary files

### Isolation
- **Process isolation** - Separate processes for scanner and AI services
- **Port isolation** - Services bind to different localhost ports
- **Memory isolation** - Each service manages its own memory
- **File isolation** - Temporary files created in secure locations

## 🚫 What Space Analyzer Pro Does NOT Do

- ❌ **No data collection** - No telemetry or analytics collection
- ❌ **No remote code execution** - All code runs locally
- ❌ **No automatic updates** - Updates require manual action
- ❌ **No network access by default** - Must be explicitly enabled
- ❌ **No user tracking** - No user identification or tracking
- ❌ **No data sharing** - Analysis data never leaves the system

## 🔧 Security Configuration

### Default Secure Settings
```env
# Network access disabled by default
VITE_API_URL=http://localhost:8080
VITE_OLLAMA_URL=http://localhost:11434

# AI services optional
AI_SERVICE_URL=http://127.0.0.1:5000

# No external API keys required
# GEMINI_API_KEY=  # Optional, user-provided
```

### Port Configuration
- **Frontend**: 5173 (Vite dev server)
- **Backend**: 8080 (Express API)
- **AI Service**: 5000 (Python FastAPI)
- **Ollama**: 11434 (Local AI)
- **All localhost only** - No external network binding

## 🛠️ Security Best Practices for Users

### 1. System Security
- **Keep system updated** - Regular OS and software updates
- **Use antivirus** - Keep antivirus software active
- **Review permissions** - Ensure app has only necessary permissions
- **Network security** - Use firewall and secure network

### 2. Data Security
- **Backup important data** - Before using deletion features
- **Review scan results** - Before performing file operations
- **Use test directories** - When trying new features
- **Monitor disk usage** - Watch for unexpected disk usage

### 3. AI Service Security
- **Local AI preferred** - Use Ollama for maximum privacy
- **Review API keys** - If using cloud AI services
- **Monitor AI service** - Check Python AI service status
- **Update AI models** - Keep ML models updated

## 🐛 Vulnerability Reporting

### How to Report
1. **Private disclosure** - Report vulnerabilities privately
2. **Email security** - Use the maintainer's security email
3. **GitHub Security Advisory** - Use GitHub's private vulnerability reporting
4. **Include details** - Provide steps to reproduce and impact assessment

### Response Process
1. **Acknowledgment** - Within 48 hours
2. **Assessment** - Evaluate vulnerability severity
3. **Fix development** - Develop and test patches
4. **Security release** - Issue security update
5. **Public disclosure** - After fix is deployed

### Security Contact
- **GitHub Security Advisory**: [Report Vulnerability](https://github.com/ogneocortext/space-analyzer-pro/security/advisories/new)
- **Maintainer**: ogneocortext

## 🔍 Security Audits

### Regular Security Reviews
- **Code reviews** - Security-focused code reviews
- **Dependency audits** - Check for vulnerable dependencies
- **Penetration testing** - Local security testing
- **Configuration audits** - Review security configurations

### Automated Security
- **Dependency scanning** - npm audit for vulnerable packages
- **Code scanning** - GitHub security scanning
- **Static analysis** - ESLint security rules
- **Secret scanning** - Prevent accidental secret commits

## 📋 Security Checklist

### Before Release
- [ ] **Review file access** - Ensure no unauthorized file access
- [ ] **Check network usage** - Verify no unexpected network calls
- [ ] **Validate inputs** - All user inputs are sanitized
- [ ] **Test error handling** - Verify no sensitive data exposure
- [ ] **Audit dependencies** - Check for vulnerable packages
- [ ] **Review permissions** - Ensure minimum required permissions

### After Installation
- [ ] **Verify localhost binding** - Services bind to localhost only
- [ ] **Check file permissions** - App has appropriate permissions
- [ ] **Test AI services** - Verify AI services work securely
- [ ] **Review configuration** - Ensure secure default settings
- [ ] **Monitor resources** - Check for resource leaks

## 🚀 Future Security Enhancements

### Planned Improvements
- **Code signing** - Digital signatures for releases
- **Sandboxing** - Enhanced process isolation
- **Encryption** - Optional database encryption
- **Audit logging** - Enhanced security event logging
- **Security scanning** - Automated security testing

### Community Contributions
- **Security reviews** - Community security audits
- **Vulnerability research** - Security research collaboration
- **Best practices** - Security best practice sharing
- **Documentation** - Security documentation improvements

---

## 📞 Security Contact

For security-related questions or vulnerability reports:

- **Maintainer**: ogneocortext
- **GitHub Security**: [Report Vulnerability](https://github.com/ogneocortext/space-analyzer-pro/security/advisories/new)
- **Private Email**: Available through GitHub

---

*This security policy is part of Space Analyzer Pro's commitment to user privacy and data protection. For questions about security practices, please refer to the contributing guidelines or contact the maintainer.*
