#!/usr/bin/env node

/**
 * Consolidated Build Fix Script
 * Replaces multiple redundant build/fix scripts with one comprehensive solution
 */

import fs from "fs";
import path from "path";
import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

class BuildFixer {
  constructor() {
    this.projectRoot = process.cwd();
    this.issues = [];
  }

  log(message, level = "INFO") {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      INFO: "\x1b[36m",
      WARN: "\x1b[33m",
      ERROR: "\x1b[31m",
      SUCCESS: "\x1b[32m",
      RESET: "\x1b[0m",
    };
    
    console.log(`${colors[level]}[${timestamp}] ${message}${colors.RESET}`);
  }

  async checkNodeVersion() {
    this.log("Checking Node.js version...", "INFO");
    
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 26) {
      this.log(`⚠️ Node.js version ${nodeVersion} is below recommended v26`, "WARN");
      this.issues.push("Node.js version outdated");
      return false;
    }
    
    this.log(`✅ Node.js version ${nodeVersion} is compatible`, "SUCCESS");
    return true;
  }

  async checkDependencies() {
    this.log("Checking dependencies...", "INFO");
    
    const packageJsonPath = path.join(this.projectRoot, "package.json");
    
    if (!fs.existsSync(packageJsonPath)) {
      this.log("❌ package.json not found", "ERROR");
      this.issues.push("package.json missing");
      return false;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const nodeModulesPath = path.join(this.projectRoot, "node_modules");
      
      let missingDeps = [];
      
      // Check critical dependencies
      const criticalDeps = ["vue", "vite", "@vitejs/plugin-vue", "express"];
      
      for (const dep of criticalDeps) {
        const depPath = path.join(nodeModulesPath, dep);
        if (!fs.existsSync(depPath)) {
          missingDeps.push(dep);
        }
      }

      if (missingDeps.length > 0) {
        this.log(`❌ Missing critical dependencies: ${missingDeps.join(", ")}`, "ERROR");
        this.issues.push(`Missing dependencies: ${missingDeps.join(", ")}`);
        return false;
      }
      
      this.log("✅ All critical dependencies present", "SUCCESS");
      return true;
    } catch (error) {
      this.log(`❌ Error checking dependencies: ${error.message}`, "ERROR");
      this.issues.push("Dependency check failed");
      return false;
    }
  }

  async fixEnvironmentVariables() {
    this.log("Fixing environment variables...", "INFO");
    
    try {
      // Check and fix PATH issues on Windows
      if (process.platform === "win32") {
        const { stdout } = await execAsync('echo %PATH%', { timeout: 5000 });
        
        if (!stdout.includes("node")) {
          this.log("⚠️ Node.js not found in PATH", "WARN");
          this.issues.push("Node.js PATH issue");
          
          // Try to add Node.js to PATH for this session
          const possibleNodePaths = [
            "C:\\Program Files\\nodejs",
            "C:\\nvm4w\\nodejs",
            "C:\\nodejs"
          ];
          
          for (const nodePath of possibleNodePaths) {
            if (fs.existsSync(nodePath)) {
              process.env.PATH = `${nodePath};${process.env.PATH}`;
              this.log(`✅ Added ${nodePath} to PATH for this session`, "SUCCESS");
              break;
            }
          }
        }
      }
      
      // Set Node.js options for better performance
      process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || "";
      if (!process.env.NODE_OPTIONS.includes("--max-old-space-size")) {
        process.env.NODE_OPTIONS += " --max-old-space-size=8192";
      }
      
      this.log("✅ Environment variables configured", "SUCCESS");
      return true;
    } catch (error) {
      this.log(`⚠️ Environment setup warning: ${error.message}`, "WARN");
      return true; // Don't fail for environment issues
    }
  }

  async clearBuildCache() {
    this.log("Clearing build cache...", "INFO");
    
    const cacheDirs = [
      "node_modules/.vite",
      "node_modules/.cache",
      "dist",
      ".vite"
    ];
    
    for (const dir of cacheDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      
      try {
        if (fs.existsSync(dirPath)) {
          await fs.promises.rm(dirPath, { recursive: true, force: true });
          this.log(`✅ Cleared: ${dir}`, "SUCCESS");
        }
      } catch (error) {
        this.log(`⚠️ Could not clear ${dir}: ${error.message}`, "WARN");
      }
    }
    
    // Clear npm cache
    try {
      await execAsync("npm cache clean --force", { timeout: 10000 });
      this.log("✅ Cleared npm cache", "SUCCESS");
    } catch (error) {
      this.log(`⚠️ npm cache clean failed: ${error.message}`, "WARN");
    }
  }

  async testBuild() {
    this.log("Testing build process...", "INFO");
    
    return new Promise((resolve) => {
      const build = spawn("npm", ["run", "build"], {
        stdio: "pipe",
        shell: true,
        cwd: this.projectRoot,
      });

      let output = "";
      let errorOutput = "";

      build.stdout.on("data", (data) => {
        const text = data.toString();
        output += text;
      });

      build.stderr.on("data", (data) => {
        const text = data.toString();
        errorOutput += text;
      });

      build.on("close", (code) => {
        if (code === 0) {
          this.log("✅ Build test successful", "SUCCESS");
          resolve(true);
        } else {
          this.log(`❌ Build test failed with code ${code}`, "ERROR");
          this.issues.push("Build process failed");
          resolve(false);
        }
      });

      build.on("error", (error) => {
        this.log(`❌ Build test error: ${error.message}`, "ERROR");
        this.issues.push("Build process error");
        resolve(false);
      });
    });
  }

  async provideRecommendations() {
    if (this.issues.length === 0) {
      this.log("🎉 No issues found! Your build environment is healthy.", "SUCCESS");
      return;
    }

    console.log("\n💡 Recommendations to fix remaining issues:");
    
    const recommendations = {
      "Node.js version outdated": "1. Update Node.js: nvm install 26 && nvm use 26",
      "package.json missing": "1. Restore package.json from git or backup",
      "Missing dependencies": "1. Run: npm install\n2. If issues persist: rm -rf node_modules package-lock.json && npm install",
      "Node.js PATH issue": "1. Ensure Node.js is installed and in PATH\n2. Restart terminal after installation",
      "Dependency check failed": "1. Check package.json for syntax errors\n2. Run: npm install",
      "Build process failed": "1. Check TypeScript errors: npm run type-check\n2. Check for missing files\n3. Verify all dependencies are compatible"
    };

    this.issues.forEach(issue => {
      const recommendation = recommendations[issue] || "1. Check the error logs above\n2. Consult documentation";
      console.log(`\n❌ ${issue}:`);
      console.log(recommendation);
    });
  }

  async run() {
    console.log("🔧 Consolidated Build Fix Tool\n");

    const checks = [
      { name: "Node.js version", fn: this.checkNodeVersion },
      { name: "Dependencies", fn: this.checkDependencies },
      { name: "Environment variables", fn: this.fixEnvironmentVariables },
      { name: "Cache clearing", fn: this.clearBuildCache },
    ];

    let allPassed = true;

    for (const check of checks) {
      const passed = await check.fn.call(this);
      if (!passed) {
        allPassed = false;
      }
    }

    if (allPassed) {
      const buildSuccess = await this.testBuild();
      if (buildSuccess) {
        console.log("\n🎉 Build fix completed successfully!");
        console.log("   Your environment is now ready for development.");
      } else {
        console.log("\n⚠️ Build test failed despite environment fixes.");
      }
    } else {
      console.log("\n⚠️ Some issues found. Running build test may fail.");
      const buildSuccess = await this.testBuild();
      if (!buildSuccess) {
        console.log("\n❌ Build test failed as expected.");
      }
    }

    await this.provideRecommendations();
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught error:", error.message);
  process.exit(1);
});

// Run build fix
new BuildFixer().run().catch(console.error);