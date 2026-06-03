/**
 * Check Cline VS Code Extension Settings
 * 
 * Run: node scripts/check-cline-settings.cjs
 * 
 * This reads VS Code settings files to find what might be causing
 * the "cmd.exe not recognized" error in Cline's tool sandbox.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

console.log("=".repeat(70));
console.log("🔍 CLINE / VS CODE SETTINGS CHECKER");
console.log("=".repeat(70));
console.log();

// 1. Read VS Code User settings.json
const userSettingsPath = path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "settings.json");
console.log("📁 Checking VS Code User Settings...");
console.log(`   Path: ${userSettingsPath}`);
console.log();

if (fs.existsSync(userSettingsPath)) {
  try {
    const content = fs.readFileSync(userSettingsPath, "utf8");
    const settings = JSON.parse(content);
    
    console.log("   ✅ settings.json found and parsed!");
    console.log();
    
    // Check for relevant settings
    const relevantKeys = [
      "terminal.integrated.shell.windows",
      "terminal.integrated.shellArgs.windows", 
      "terminal.integrated.defaultProfile.windows",
      "terminal.external.windowsExec",
      "terminal.integrated.automationShell.windows",
      "terminal.integrated.automationProfile.windows",
      "terminal.integrated.profiles.windows",
      "shell.launch",
      "application.shellEnvironmentResolutionTimeout",
      "cline",
      "cline.path",
      "cline.shell",
      "cline.terminalPath",
      "cline.terminal",
      "console",
      "console.shell",
      "console.terminal",
      "console.path"
    ];
    
    let foundRelevant = false;
    for (const key of relevantKeys) {
      if (key in settings) {
        foundRelevant = true;
        console.log(`   ⚠️  FOUND: "${key}":`);
        console.log(`       ${JSON.stringify(settings[key], null, 4)}`);
        console.log();
      }
    }
    
    if (!foundRelevant) {
      console.log("   ✅ No terminal/shell overrides found in User settings.");
      console.log("      (This is good - means defaults should be used)");
      console.log();
    }
    
  } catch (err) {
    console.log(`   ❌ Error reading settings: ${err.message}`);
    console.log();
  }
} else {
  console.log("   ❌ settings.json not found at expected path!");
  console.log();
}

// 2. Check Workspace settings
const workspaceSettingsPath = path.join(__dirname, "..", ".vscode", "settings.json");
console.log("📁 Checking Workspace Settings...");
console.log(`   Path: ${workspaceSettingsPath}`);
console.log();

if (fs.existsSync(workspaceSettingsPath)) {
  try {
    const content = fs.readFileSync(workspaceSettingsPath, "utf8");
    const settings = JSON.parse(content);
    console.log("   ✅ Workspace settings found!");
    console.log("   Content:");
    console.log(content);
    console.log();
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    console.log();
  }
}

// 3. Check ComSpec environment variable
console.log("📁 Checking Environment Variables:");
console.log();
console.log(`   COMSPEC = ${process.env.COMSPEC || "NOT SET!"}`);
console.log(`   PATH includes System32: ${(process.env.PATH || "").toLowerCase().includes("system32")}`);
console.log(`   SHELL = ${process.env.SHELL || "(not set - Windows)"}`);
console.log();

// 4. Check if there's a Cline config directory
const clineConfigDirs = [
  path.join(os.homedir(), ".cline"),
  path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "globalStorage", "saoudrizwan.claude-dev"),
  path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "globalStorage", "saoudrizwan.claude-ai"),
  path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "globalStorage"),
];

console.log("📁 Checking Cline Extension Config...");
console.log();

for (const dir of clineConfigDirs) {
  if (fs.existsSync(dir)) {
    console.log(`   ✅ Found: ${dir}`);
    // List files in the directory
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        console.log(`      📄 ${file} (${stats.size} bytes)`);
        // If it's a JSON file, peek at its content for shell-related settings
        if (file.endsWith(".json") && stats.size < 100000) {
          try {
            const fileContent = fs.readFileSync(filePath, "utf8");
            const jsonData = JSON.parse(fileContent);
            // Check for shell/path/terminal related keys
            const searchKeys = (obj, prefix = "") => {
              for (const [key, value] of Object.entries(obj)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const keyLower = key.toLowerCase();
                if (keyLower.includes("shell") || keyLower.includes("terminal") || keyLower.includes("cmd") || keyLower.includes("comspec") || keyLower.includes("path")) {
                  console.log(`      ⚠️  FOUND: ${fullKey} = ${JSON.stringify(value)}`);
                }
                if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                  searchKeys(value, fullKey);
                }
              }
            };
            searchKeys(jsonData);
          } catch (e) {
            // Not JSON or parse error, skip
          }
        }
      }
    } catch (err) {
      console.log(`      Error listing: ${err.message}`);
    }
    console.log();
  }
}

// 5. Summary
console.log("=".repeat(70));
console.log("📋 SUMMARY");
console.log("=".repeat(70));
console.log();

if (!process.env.COMSPEC) {
  console.log("❌ COMSPEC environment variable is NOT SET!");
  console.log("   This means Windows doesn't know where cmd.exe is.");
  console.log("   Even though PATH may be correct, the ComSpec variable");
  console.log("   is what child processes use to spawn cmd.exe.");
  console.log();
  console.log("   To fix (as Administrator in PowerShell):");
  console.log('   [Environment]::SetEnvironmentVariable("ComSpec", "C:\\Windows\\System32\\cmd.exe", "Machine")');
} else if (process.env.COMSPEC !== "C:\\Windows\\System32\\cmd.exe") {
  console.log(`⚠️  COMSPEC is set but to an unexpected value:`);
  console.log(`   Current: ${process.env.COMSPEC}`);
  console.log(`   Expected: C:\\Windows\\System32\\cmd.exe`);
  console.log();
  console.log("   To fix (as Administrator in PowerShell):");
  console.log('   [Environment]::SetEnvironmentVariable("ComSpec", "C:\\Windows\\System32\\cmd.exe", "Machine")');
} else {
  console.log("✅ COMSPEC is correctly set to C:\\Windows\\System32\\cmd.exe");
  console.log("   The issue may be that Cline's extension process");
  console.log("   was launched before the variable was set.");
  console.log();
  console.log("   Try: Fully exit VS Code, then reopen it.");
  console.log("   If it still fails, check if you have a Cline config");
  console.log("   that overrides the shell path (see section 4 above).");
}

console.log();
console.log("========================================");
console.log("✅ Check complete");
console.log("========================================");