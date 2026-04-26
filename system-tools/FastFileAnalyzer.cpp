#include <windows.h>
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <algorithm>
#include <tlhelp32.h>
#include <psapi.h>
#include <shlobj.h>
#include <wintrust.h>
#include <softpub.h>
#include <iomanip>
#include <sstream>

#pragma comment(lib, "wintrust.lib")
#pragma comment(lib, "psapi.lib")

struct FileInfo {
    std::wstring path;
    std::wstring name;
    LARGE_INTEGER size;
    FILETIME creationTime;
    FILETIME lastWriteTime;
    FILETIME lastAccessTime;
    DWORD attributes;
    std::wstring extension;
    int daysOld;
    bool isSystem;
    bool isHidden;
    bool isTemporary;
    std::wstring sourceApp;
    std::wstring publisher;
    std::wstring digitalSignature;
    std::wstring regenerationMechanism;
    std::wstring creationMethod;
    std::wstring riskLevel;
    std::wstring reason;
    std::vector<std::wstring> affectedComponents;
    std::vector<std::wstring> consequences;
    std::vector<std::wstring> recoveryOptions;
};

class FastFileAnalyzer {
private:
    std::map<std::wstring, std::wstring> installedPrograms;
    std::vector<std::wstring> tempDirectories;
    std::vector<std::wstring> cacheDirectories;
    
    void LoadInstalledPrograms() {
        HKEY hKey;
        if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
            DWORD index = 0;
            wchar_t subkeyName[256];
            DWORD subkeySize = sizeof(subkeyName) / sizeof(wchar_t);
            
            while (RegEnumKeyExW(hKey, index++, subkeyName, &subkeySize, nullptr, nullptr, nullptr, nullptr) == ERROR_SUCCESS) {
                HKEY hSubKey;
                if (RegOpenKeyExW(hKey, subkeyName, 0, KEY_READ, &hSubKey) == ERROR_SUCCESS) {
                    wchar_t displayName[256] = {0};
                    wchar_t installLocation[512] = {0};
                    wchar_t publisher[256] = {0};
                    DWORD size = sizeof(displayName);
                    
                    RegQueryValueExW(hSubKey, L"DisplayName", nullptr, nullptr, (LPBYTE)displayName, &size);
                    size = sizeof(installLocation);
                    RegQueryValueExW(hSubKey, L"InstallLocation", nullptr, nullptr, (LPBYTE)installLocation, &size);
                    size = sizeof(publisher);
                    RegQueryValueExW(hSubKey, L"Publisher", nullptr, nullptr, (LPBYTE)publisher, &size);
                    
                    if (wcslen(displayName) > 0 && wcslen(installLocation) > 0) {
                        std::wstring key = std::wstring(installLocation);
                        std::wstring value = std::wstring(displayName) + L"|" + std::wstring(publisher);
                        installedPrograms[key] = value;
                    }
                    RegCloseKey(hSubKey);
                }
                subkeySize = sizeof(subkeyName) / sizeof(wchar_t);
            }
            RegCloseKey(hKey);
        }
    }
    
    void LoadSystemDirectories() {
        wchar_t tempPath[MAX_PATH];
        GetTempPathW(MAX_PATH, tempPath);
        tempDirectories.push_back(std::wstring(tempPath));
        
        wchar_t localAppData[MAX_PATH];
        SHGetFolderPathW(nullptr, CSIDL_LOCAL_APPDATA, nullptr, SHGFP_TYPE_CURRENT, localAppData);
        std::wstring localApp = std::wstring(localAppData) + L"\\Temp";
        tempDirectories.push_back(localApp);
        
        cacheDirectories.push_back(std::wstring(localAppData) + L"\\Microsoft\\Windows\\INetCache");
        cacheDirectories.push_back(std::wstring(localAppData) + L"\\Google\\Chrome\\User Data\\Default\\Cache");
        cacheDirectories.push_back(std::wstring(localAppData) + L"\\Mozilla\\Firefox\\Profiles");
    }
    
    std::wstring GetDigitalSignature(const std::wstring& filePath) {
        WINTRUST_FILE_INFO fileInfo = {0};
        WINTRUST_DATA winTrustData = {0};
        GUID policyGUID = WINTRUST_ACTION_GENERIC_VERIFY_V2;
        
        fileInfo.cbStruct = sizeof(WINTRUST_FILE_INFO);
        fileInfo.pcwszFilePath = filePath.c_str();
        fileInfo.hFile = nullptr;
        fileInfo.pgKnownSubject = nullptr;
        
        winTrustData.cbStruct = sizeof(WINTRUST_DATA);
        winTrustData.pPolicyCallbackData = nullptr;
        winTrustData.pSIPClientData = nullptr;
        winTrustData.dwUIChoice = WTD_UI_NONE;
        winTrustData.fdwRevocationChecks = WTD_REVOKE_NONE;
        winTrustData.dwUnionChoice = WTD_CHOICE_FILE;
        winTrustData.dwStateAction = WTD_STATEACTION_VERIFY;
        winTrustData.hWVTStateData = nullptr;
        winTrustData.pwszURLReference = nullptr;
        winTrustData.dwProvFlags = WTD_SAFER_FLAG;
        winTrustData.dwUIContext = 0;
        winTrustData.pFile = &fileInfo;
        
        LONG result = WinVerifyTrust(nullptr, &policyGUID, &winTrustData);
        
        winTrustData.dwStateAction = WTD_STATEACTION_CLOSE;
        WinVerifyTrust(nullptr, &policyGUID, &winTrustData);
        
        if (result == ERROR_SUCCESS) {
            return L"Valid";
        }
        return L"None";
    }
    
    std::wstring FindSourceApplication(const std::wstring& filePath) {
        for (const auto& program : installedPrograms) {
            if (filePath.find(program.first) != std::wstring::npos) {
                return program.second;
            }
        }
        return L"";
    }
    
    std::wstring CheckRegenerationMechanism(const std::wstring& filePath) {
        for (const auto& tempDir : tempDirectories) {
            if (filePath.find(tempDir) != std::wstring::npos) {
                return L"Temporary Directory - System Recreation";
            }
        }
        
        for (const auto& cacheDir : cacheDirectories) {
            if (filePath.find(cacheDir) != std::wstring::npos) {
                return L"Cache Directory - Application Regeneration";
            }
        }
        
        return L"";
    }
    
    std::wstring DetermineCreationMethod(const std::wstring& fileName) {
        std::wstring lowerName = fileName;
        std::transform(lowerName.begin(), lowerName.end(), lowerName.begin(), ::towlower);
        
        if (lowerName.find(L"tmp") == 0 || lowerName.find(L"temp") != std::wstring::npos) {
            return L"Temporary File Creation";
        }
        if (lowerName.find(L"~$") == 0) {
            return L"Office Application Backup";
        }
        if (lowerName.find(L".log") != std::wstring::npos) {
            return L"Application Logging";
        }
        if (lowerName.find(L".cache") != std::wstring::npos) {
            return L"Application Cache";
        }
        return L"Unknown";
    }
    
    void AnalyzeFileImpact(FileInfo& fileInfo) {
        std::wstring lowerPath = fileInfo.path;
        std::transform(lowerPath.begin(), lowerPath.end(), lowerPath.begin(), ::towlower);
        
        // Check for critical system files
        if (lowerPath.find(L"\\system32\\") != std::wstring::npos ||
            lowerPath.find(L"\\syswow64\\") != std::wstring::npos ||
            lowerPath.find(L"\\drivers\\") != std::wstring::npos) {
            fileInfo.riskLevel = L"Critical";
            fileInfo.reason = L"CRITICAL SYSTEM FILE - Deleting may prevent Windows from starting";
            fileInfo.consequences.push_back(L"SYSTEM FAILURE: May prevent Windows from starting");
            fileInfo.recoveryOptions.push_back(L"Windows Repair/Recovery Console");
            fileInfo.recoveryOptions.push_back(L"System Restore");
            return;
        }
        
        // Check for program files
        if (lowerPath.find(L"\\program files\\") != std::wstring::npos ||
            lowerPath.find(L"\\program files (x86)\\") != std::wstring::npos) {
            fileInfo.riskLevel = L"High";
            fileInfo.reason = L"Part of installed application";
            if (!fileInfo.sourceApp.empty()) {
                fileInfo.reason += L" - " + fileInfo.sourceApp;
            }
            fileInfo.consequences.push_back(L"Application may malfunction or fail to start");
            fileInfo.recoveryOptions.push_back(L"Reinstall affected application");
            return;
        }
        
        // Check for regeneration
        std::wstring regeneration = CheckRegenerationMechanism(fileInfo.path);
        if (!regeneration.empty()) {
            fileInfo.regenerationMechanism = regeneration;
            fileInfo.riskLevel = L"Medium";
            fileInfo.reason = L"File may regenerate after deletion - " + regeneration;
            fileInfo.consequences.push_back(L"File will be recreated by system or application");
            fileInfo.recoveryOptions.push_back(L"Disable regeneration mechanism");
            return;
        }
        
        // Check file age and size
        if (fileInfo.daysOld > 365) {
            fileInfo.riskLevel = L"Low";
            fileInfo.reason = L"Old unused file - safe to delete";
            fileInfo.recoveryOptions.push_back(L"File can be safely deleted");
        } else if (fileInfo.size.QuadPart < 1024 * 1024) { // Less than 1MB
            fileInfo.riskLevel = L"Low";
            fileInfo.reason = L"Small file - minimal impact";
            fileInfo.recoveryOptions.push_back(L"File can be safely deleted");
        } else {
            fileInfo.riskLevel = L"Medium";
            fileInfo.reason = L"Unknown file type - manual review recommended";
            fileInfo.recoveryOptions.push_back(L"Manual review before deletion");
        }
    }
    
    int CalculateDaysOld(const FILETIME& fileTime) {
        FILETIME currentTime;
        GetSystemTimeAsFileTime(&currentTime);
        
        ULARGE_INTEGER current, file;
        current.LowPart = currentTime.dwLowDateTime;
        current.HighPart = currentTime.dwHighDateTime;
        file.LowPart = fileTime.dwLowDateTime;
        file.HighPart = fileTime.dwHighDateTime;
        
        ULONGLONG diff = current.QuadPart - file.QuadPart;
        return static_cast<int>(diff / (10000000ULL * 60 * 60 * 24));
    }
    
public:
    FastFileAnalyzer() {
        LoadInstalledPrograms();
        LoadSystemDirectories();
    }
    
    std::vector<FileInfo> AnalyzeDirectory(const std::wstring& directoryPath) {
        std::vector<FileInfo> files;
        
        WIN32_FIND_DATAW findData;
        HANDLE hFind = FindFirstFileExW(
            (directoryPath + L"\\*").c_str(),
            FindExInfoBasic,
            &findData,
            FindExSearchNameMatch,
            nullptr,
            FIND_FIRST_EX_LARGE_FETCH
        );
        
        if (hFind == INVALID_HANDLE_VALUE) {
            return files;
        }
        
        do {
            if (wcscmp(findData.cFileName, L".") == 0 || wcscmp(findData.cFileName, L"..") == 0) {
                continue;
            }
            
            std::wstring fullPath = directoryPath + L"\\" + findData.cFileName;
            
            if (findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
                // Recursively analyze subdirectories
                auto subFiles = AnalyzeDirectory(fullPath);
                files.insert(files.end(), subFiles.begin(), subFiles.end());
            } else {
                FileInfo fileInfo;
                fileInfo.path = fullPath;
                fileInfo.name = findData.cFileName;
                fileInfo.size.HighPart = findData.nFileSizeHigh;
                fileInfo.size.LowPart = findData.nFileSizeLow;
                fileInfo.creationTime = findData.ftCreationTime;
                fileInfo.lastWriteTime = findData.ftLastWriteTime;
                fileInfo.lastAccessTime = findData.ftLastAccessTime;
                fileInfo.attributes = findData.dwFileAttributes;
                fileInfo.isSystem = (findData.dwFileAttributes & FILE_ATTRIBUTE_SYSTEM) != 0;
                fileInfo.isHidden = (findData.dwFileAttributes & FILE_ATTRIBUTE_HIDDEN) != 0;
                fileInfo.isTemporary = (findData.dwFileAttributes & FILE_ATTRIBUTE_TEMPORARY) != 0;
                
                // Extract extension
                std::wstring fileName = findData.cFileName;
                size_t dotPos = fileName.find_last_of(L'.');
                if (dotPos != std::wstring::npos) {
                    fileInfo.extension = fileName.substr(dotPos);
                }
                
                fileInfo.daysOld = CalculateDaysOld(findData.ftLastWriteTime);
                
                // Find source application
                std::wstring sourceApp = FindSourceApplication(fullPath);
                if (!sourceApp.empty()) {
                    size_t pipePos = sourceApp.find(L'|');
                    if (pipePos != std::wstring::npos) {
                        fileInfo.sourceApp = sourceApp.substr(0, pipePos);
                        fileInfo.publisher = sourceApp.substr(pipePos + 1);
                    } else {
                        fileInfo.sourceApp = sourceApp;
                    }
                }
                
                // Get digital signature
                fileInfo.digitalSignature = GetDigitalSignature(fullPath);
                
                // Check regeneration mechanism
                fileInfo.regenerationMechanism = CheckRegenerationMechanism(fullPath);
                
                // Determine creation method
                fileInfo.creationMethod = DetermineCreationMethod(fileInfo.name);
                
                // Analyze impact
                AnalyzeFileImpact(fileInfo);
                
                files.push_back(fileInfo);
            }
        } while (FindNextFileW(hFind, &findData));
        
        FindClose(hFind);
        return files;
    }
    
    void PrintAnalysis(const std::vector<FileInfo>& files) {
        wprintf(L"\n=== FAST FILE ANALYSIS RESULTS ===\n");
        wprintf(L"Total files analyzed: %zu\n\n", files.size());
        
        // Group by risk level
        std::map<std::wstring, std::vector<FileInfo>> riskGroups;
        for (const auto& file : files) {
            riskGroups[file.riskLevel].push_back(file);
        }
        
        // Print Critical files first
        if (riskGroups.count(L"Critical")) {
            wprintf(L"🔴 CRITICAL FILES (%zu files):\n", riskGroups[L"Critical"].size());
            for (const auto& file : riskGroups[L"Critical"]) {
                wprintf(L"  ⚠️ %s\n", file.name.c_str());
                wprintf(L"     Size: %.2f MB | Age: %d days\n", 
                    static_cast<double>(file.size.QuadPart) / (1024.0 * 1024.0), file.daysOld);
                wprintf(L"     Reason: %s\n", file.reason.c_str());
                wprintf(L"     Path: %s\n", file.path.c_str());
                wprintf(L"     Consequences: %s\n", file.consequences[0].c_str());
                wprintf(L"     Recovery: %s\n\n", file.recoveryOptions[0].c_str());
            }
        }
        
        // Print High risk files
        if (riskGroups.count(L"High")) {
            wprintf(L"🟠 HIGH RISK FILES (%zu files):\n", riskGroups[L"High"].size());
            for (const auto& file : riskGroups[L"High"]) {
                wprintf(L"  ⚠️ %s\n", file.name.c_str());
                wprintf(L"     Size: %.2f MB | Age: %d days\n", 
                    static_cast<double>(file.size.QuadPart) / (1024.0 * 1024.0), file.daysOld);
                wprintf(L"     Reason: %s\n", file.reason.c_str());
                wprintf(L"     🔍 Source: %s\n", file.sourceApp.c_str());
                if (!file.publisher.empty()) {
                    wprintf(L"     📝 Publisher: %s\n", file.publisher.c_str());
                }
                wprintf(L"     📝 Digital Signature: %s\n", file.digitalSignature.c_str());
                wprintf(L"     Path: %s\n\n", file.path.c_str());
            }
        }
        
        // Print Medium risk files
        if (riskGroups.count(L"Medium")) {
            wprintf(L"🟡 MEDIUM RISK FILES (%zu files):\n", riskGroups[L"Medium"].size());
            for (const auto& file : riskGroups[L"Medium"]) {
                wprintf(L"  ⚠️ %s\n", file.name.c_str());
                wprintf(L"     Size: %.2f MB | Age: %d days\n", 
                    static_cast<double>(file.size.QuadPart) / (1024.0 * 1024.0), file.daysOld);
                wprintf(L"     Reason: %s\n", file.reason.c_str());
                if (!file.regenerationMechanism.empty()) {
                    wprintf(L"     🔄 Regeneration: %s\n", file.regenerationMechanism.c_str());
                }
                wprintf(L"     🛠️ Creation: %s\n", file.creationMethod.c_str());
                wprintf(L"     Path: %s\n\n", file.path.c_str());
            }
        }
        
        // Print Low risk files (top 20 by size)
        if (riskGroups.count(L"Low")) {
            auto lowRiskFiles = riskGroups[L"Low"];
            std::sort(lowRiskFiles.begin(), lowRiskFiles.end(), 
                [](const FileInfo& a, const FileInfo& b) {
                    return a.size.QuadPart > b.size.QuadPart;
                });
            
            wprintf(L"✅ LOW RISK FILES (Top 20 by size, %zu total):\n", lowRiskFiles.size());
            int count = 0;
            for (const auto& file : lowRiskFiles) {
                if (count++ >= 20) break;
                wprintf(L"  ✅ %s\n", file.name.c_str());
                wprintf(L"     Size: %.2f MB | Age: %d days\n", 
                    static_cast<double>(file.size.QuadPart) / (1024.0 * 1024.0), file.daysOld);
                wprintf(L"     Reason: %s\n", file.reason.c_str());
                if (!file.sourceApp.empty()) {
                    wprintf(L"     🔍 Source: %s\n", file.sourceApp.c_str());
                }
                wprintf(L"     Path: %s\n\n", file.path.c_str());
            }
        }
        
        // Summary
        wprintf(L"\n=== SUMMARY ===\n");
        if (riskGroups.count(L"Critical")) wprintf(L"🔴 Critical: %zu files\n", riskGroups[L"Critical"].size());
        if (riskGroups.count(L"High")) wprintf(L"🟠 High: %zu files\n", riskGroups[L"High"].size());
        if (riskGroups.count(L"Medium")) wprintf(L"🟡 Medium: %zu files\n", riskGroups[L"Medium"].size());
        if (riskGroups.count(L"Low")) wprintf(L"✅ Low: %zu files\n", riskGroups[L"Low"].size());
        
        // Calculate total size
        ULONGLONG totalSize = 0;
        for (const auto& file : files) {
            totalSize += file.size.QuadPart;
        }
        wprintf(L"Total size: %.2f GB\n", static_cast<double>(totalSize) / (1024.0 * 1024.0 * 1024.0));
    }
};

int wmain(int argc, wchar_t* argv[]) {
    if (argc < 2) {
        wprintf(L"Usage: %s <directory_path>\n", argv[0]);
        wprintf(L"Example: %s \"C:\\Users\\Aomega Imaging\"\n", argv[0]);
        return 1;
    }
    
    std::wstring directoryPath = argv[1];
    
    // Check if directory exists
    DWORD attrib = GetFileAttributesW(directoryPath.c_str());
    if (attrib == INVALID_FILE_ATTRIBUTES || !(attrib & FILE_ATTRIBUTE_DIRECTORY)) {
        wprintf(L"Error: Directory does not exist: %s\n", directoryPath.c_str());
        return 1;
    }
    
    wprintf(L"Starting fast file analysis...\n");
    wprintf(L"Target directory: %s\n\n", directoryPath.c_str());
    
    auto startTime = GetTickCount64();
    
    FastFileAnalyzer analyzer;
    auto files = analyzer.AnalyzeDirectory(directoryPath);
    
    auto endTime = GetTickCount64();
    wprintf(L"Analysis completed in %.2f seconds\n\n", (endTime - startTime) / 1000.0);
    
    analyzer.PrintAnalysis(files);
    
    return 0;
}
