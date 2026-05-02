// Test the Rust scanner executable
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const scannerPath = path.join(__dirname, "..", "bin", "space-analyzer.exe");
const testDir = process.argv[2] || ".";

console.log("🧪 Testing Scanner");
console.log("Scanner path:", scannerPath);
console.log("Test directory:", testDir);
console.log("Scanner exists:", fs.existsSync(scannerPath));

if (!fs.existsSync(scannerPath)) {
  console.error("❌ Scanner executable not found!");
  process.exit(1);
}

const tempOutput = path.join(__dirname, `test_scan_${Date.now()}.json`);

console.log("\n▶️  Starting scan...");
const startTime = Date.now();

const child = spawn(scannerPath, [testDir, "--output", tempOutput, "--quiet"], {
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (data) => {
  stdout += data.toString();
  console.log("📤 stdout:", data.toString().trim());
});

child.stderr.on("data", (data) => {
  stderr += data.toString();
  console.log("📥 stderr:", data.toString().trim());
});

child.on("error", (error) => {
  console.error("❌ Spawn error:", error.message);
});

child.on("close", (code) => {
  const elapsed = Date.now() - startTime;
  console.log(`\n✅ Scan completed in ${elapsed}ms`);
  console.log("Exit code:", code);

  if (fs.existsSync(tempOutput)) {
    try {
      const result = JSON.parse(fs.readFileSync(tempOutput, "utf8"));
      console.log("Files found:", result.total_files);
      console.log("Total size:", result.total_size);
      fs.unlinkSync(tempOutput);
    } catch (e) {
      console.error("❌ Failed to parse output:", e.message);
    }
  } else {
    console.log("No output file created");
  }

  if (stderr) {
    console.log("\n⚠️  Stderr output:");
    console.log(stderr);
  }
});
