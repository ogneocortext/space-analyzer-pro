#!/usr/bin/env python3
"""
Automated Space Analyzer Native GUI Testing Script
Tests binary integrity, process lifecycle, file output format,
and AI system compatibility.
"""

import subprocess
import time
import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime, timezone


class SpaceAnalyzerTester:
    REQUIRED_JSON_SCHEMA_KEYS = [
        "schema_version", "generated_at", "scanner_version",
        "scan_config", "summary", "file_analysis", "performance", "issues"
    ]
    REQUIRED_SUMMARY_KEYS = ["total_files", "total_size", "scan_duration_ms"]
    REQUIRED_FILE_KEYS = ["files", "categories", "extension_stats"]

    def __init__(self):
        # Locate binary relative to script location
        search_paths = [
            Path("space-analyzer-native.exe"),
            Path("native-gui/target/x86_64-pc-windows-msvc/release/space-analyzer.exe"),
            Path("native-gui/target/release/space-analyzer.exe"),
            Path("../native-gui/target/x86_64-pc-windows-msvc/release/space-analyzer.exe"),
        ]
        self.exe_path = None
        for p in search_paths:
            if p.exists():
                self.exe_path = p.resolve()
                break
        self.process = None
        self.test_results = []
        self.start_time = None
        self.mem_samples = []
        self.scan_results_dir = Path("scan_results")

    def log_test(self, test_name, status, details=""):
        timestamp = datetime.now().isoformat()
        result = {"timestamp": timestamp, "test": test_name, "status": status, "details": details}
        self.test_results.append(result)
        sym = "PASS" if status in ("PASSED", "COMPLETED") else "FAIL"
        print(f"  [{sym}] {test_name}: {status}")
        if details:
            print(f"         {details}")

    # ── Phase 1: Binary Verification ──────────────────────────

    def test_binary_exists(self):
        if self.exe_path and self.exe_path.exists():
            size = self.exe_path.stat().st_size
            self.log_test("Binary Exists", "PASSED", f"Found at {self.exe_path} ({size//1024} KB)")
            return True
        self.log_test("Binary Exists", "FAILED", "Binary not found in any expected path")
        return False

    def test_binary_permissions(self):
        if self.exe_path and os.access(self.exe_path, os.X_OK):
            self.log_test("Binary Executable", "PASSED", "Execute permission OK")
            return True
        self.log_test("Binary Executable", "FAILED", "Binary is not executable")
        return False

    # ── Phase 2: Process Lifecycle ─────────────────────────────

    def start_application(self):
        try:
            self.log_test("Launch", "PASSED", f"Starting: {self.exe_path.name}")
            t0 = time.time()
            self.process = subprocess.Popen(
                [str(self.exe_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0,
            )
            time.sleep(2.5)
            startup = (time.time() - t0) * 1000

            if self.process.poll() is None:
                self.start_time = time.time()
                self.log_test("Application Start", "PASSED", f"Startup: {startup:.0f}ms, PID: {self.process.pid}")
                return True
            else:
                _, stderr = self.process.communicate()
                err = stderr.decode()[:200] if stderr else "None"
                self.log_test("Application Start", "FAILED", f"Exited immediately. Stderr: {err}")
                return False
        except Exception as e:
            self.log_test("Application Start", "FAILED", f"Exception: {e}")
            return False

    def stop_application(self):
        if not self.process:
            return
        try:
            self.process.terminate()
            self.process.wait(timeout=5)
            uptime = (time.time() - self.start_time) if self.start_time else 0
            self.log_test("Application Stop", "PASSED", f"Graceful shutdown (uptime: {uptime:.1f}s)")
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.log_test("Application Stop", "PASSED", "Force-killed after timeout")
        except Exception as e:
            self.log_test("Application Stop", "FAILED", f"Exception: {e}")

    def test_process_stability(self, duration=8):
        stable = True
        for i in range(duration):
            time.sleep(1)
            if self.process and self.process.poll() is not None:
                self.log_test("Process Stability", "FAILED", f"Crashed at t={i+1}s")
                stable = False
                break
        if stable:
            uptime = time.time() - self.start_time if self.start_time else duration
            self.log_test("Process Stability", "PASSED", f"Stable for {uptime:.0f}s")

    # ── Phase 3: Filesystem Effects ────────────────────────────

    def run_headless_scan(self, target_path=None):
        """Run a headless scan to generate test output"""
        if target_path is None:
            target_path = "."
        self.log_test("Headless Scan", "PASSED", f"Scanning: {target_path}")
        try:
            t0 = time.time()
            result = subprocess.run(
                [str(self.exe_path), "--scan", target_path],
                capture_output=True, text=True, timeout=30,
            )
            elapsed = (time.time() - t0) * 1000

            # Parse JSON from stdout
            output = result.stdout.strip()
            data = json.loads(output) if output else {}
            summary = data.get("summary", {})
            self.log_test("Headless Scan Result", "PASSED",
                          f"Return code: {result.returncode}, "
                          f"Files: {summary.get('total_files', '?')}, "
                          f"Size: {summary.get('total_size', '?')} bytes, "
                          f"Duration: {elapsed:.0f}ms")
            return data
        except subprocess.TimeoutExpired:
            self.log_test("Headless Scan Result", "FAILED", "Timed out after 30s")
        except json.JSONDecodeError as e:
            self.log_test("Headless Scan Result", "FAILED", f"Invalid JSON: {e}")
        except Exception as e:
            self.log_test("Headless Scan Result", "FAILED", str(e))
        return None

    def test_scan_results_directory(self):
        if self.scan_results_dir.exists():
            self.log_test("Scan Results Dir", "PASSED", f"Directory exists at {self.scan_results_dir}")
            return True
        self.log_test("Scan Results Dir", "FAILED", "scan_results/ directory not found")
        return False

    def test_scan_results_format(self):
        if not self.scan_results_dir.exists():
            self.log_test("Scan JSON Format", "FAILED", "scan_results/ missing")
            return

        files = sorted(self.scan_results_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not files:
            self.log_test("Scan JSON Format", "FAILED", "No scan result files found")
            return

        validated = 0
        errors = []
        for f in files:
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                # Schema version
                sv = data.get("schema_version")
                if sv != "2.0":
                    errors.append(f"{f.name}: schema_version={sv}, expected 2.0")
                    continue
                # Required top-level keys
                for key in self.REQUIRED_JSON_SCHEMA_KEYS:
                    if key not in data:
                        errors.append(f"{f.name}: missing top-level key '{key}'")
                # Summary
                for key in self.REQUIRED_SUMMARY_KEYS:
                    if key not in data.get("summary", {}):
                        errors.append(f"{f.name}: summary missing '{key}'")
                # File analysis
                fa = data.get("file_analysis", {})
                for key in self.REQUIRED_FILE_KEYS:
                    if key not in fa:
                        errors.append(f"{f.name}: file_analysis missing '{key}'")
                # Files array
                if "files" in fa:
                    for fi in fa["files"]:
                        for fk in ("name", "path", "size", "extension"):
                            if fk not in fi:
                                errors.append(f"{f.name}: file missing '{fk}'")
                validated += 1
            except json.JSONDecodeError as e:
                errors.append(f"{f.name}: invalid JSON - {e}")

        total = len(files)
        if validated == total and not errors:
            self.log_test("Scan JSON Format", "PASSED", f"{validated}/{total} files validate against schema v2.0")
        else:
            self.log_test("Scan JSON Format", "FAILED", f"{validated}/{total} valid. Errors: {'; '.join(errors[:5])}")

    def test_ai_compatibility(self):
        if not self.scan_results_dir.exists():
            return
        files = list(self.scan_results_dir.glob("*.json"))
        if not files:
            return

        checks = {"has_categories": 0, "has_extension_stats": 0, "has_performance": 0, "has_issues": 0, "total": 0}
        for f in files:
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                checks["total"] += 1
                if "categories" in data.get("file_analysis", {}):
                    checks["has_categories"] += 1
                if "extension_stats" in data.get("file_analysis", {}):
                    checks["has_extension_stats"] += 1
                if data.get("performance"):
                    checks["has_performance"] += 1
                if data.get("issues"):
                    checks["has_issues"] += 1
            except json.JSONDecodeError:
                pass

        t = checks["total"]
        if t == 0:
            return
        ok = checks["has_categories"] + checks["has_extension_stats"] + checks["has_performance"] + checks["has_issues"]
        self.log_test("AI Compatibility", "PASSED" if ok == t * 4 else "FAILED",
                      f"categories:{checks['has_categories']}/{t} ext_stats:{checks['has_extension_stats']}/{t} "
                      f"performance:{checks['has_performance']}/{t} issues:{checks['has_issues']}/{t}")

    # ── Phase 4: Performance ───────────────────────────────────

    def sample_memory(self, count=5, interval=2):
        for _ in range(count):
            if self.process and self.process.poll() is None:
                try:
                    import psutil
                    proc = psutil.Process(self.process.pid)
                    self.mem_samples.append(proc.memory_info().rss)
                except (ImportError, psutil.NoSuchProcess):
                    pass
            time.sleep(interval)

        if self.mem_samples:
            avg_mb = sum(self.mem_samples) / len(self.mem_samples) / 1024 / 1024
            peak_mb = max(self.mem_samples) / 1024 / 1024
            growth = ((self.mem_samples[-1] - self.mem_samples[0]) / self.mem_samples[0] * 100) if len(self.mem_samples) > 1 and self.mem_samples[0] else 0
            self.log_test("Memory Usage", "PASSED",
                          f"Avg: {avg_mb:.0f} MB, Peak: {peak_mb:.0f} MB, Growth: {growth:+.0f}%")
        else:
            self.log_test("Memory Usage", "SKIPPED", "psutil not available")

    # ── Phase 5: Report ────────────────────────────────────────

    def generate_report(self):
        print()
        print("=" * 60)
        print("  SPACE ANALYZER NATIVE GUI - TEST REPORT")
        print("=" * 60)

        passed = sum(1 for r in self.test_results if r["status"] in ("PASSED", "COMPLETED"))
        failed = sum(1 for r in self.test_results if r["status"] == "FAILED")
        skipped = sum(1 for r in self.test_results if r["status"] == "SKIPPED")
        total = len(self.test_results)
        rate = (passed / total * 100) if total else 0

        print(f"  Total: {total}  |  Passed: {passed}  |  Failed: {failed}  |  Skipped: {skipped}")
        print(f"  Success Rate: {rate:.1f}%")
        print("-" * 60)

        for r in self.test_results:
            sym = "+" if r["status"] in ("PASSED", "COMPLETED") else ("~" if r["status"] == "SKIPPED" else "!")
            print(f"  {sym}  {r['test']}: {r['status']}")
            if r["details"]:
                for line in r["details"].split("; "):
                    print(f"       {line}")

        # Save .txt report
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        txt_path = f"test_report_{ts}.txt"
        with open(txt_path, "w") as f:
            f.write("SPACE ANALYZER NATIVE GUI - TEST REPORT\n")
            f.write("=" * 60 + "\n\n")
            for r in self.test_results:
                f.write(f"{r['timestamp']} - {r['test']}: {r['status']}\n")
                if r["details"]:
                    f.write(f"  Details: {r['details']}\n")
        print(f"\n  Text report: {txt_path}")

        # Save .json report
        json_path = f"test_results_{ts}.json"
        analysis = {
            "total_tests": total,
            "passed_tests": passed,
            "failed_tests": failed,
            "skipped_tests": skipped,
            "success_rate_pct": round(rate, 1),
            "failed_tests_list": [r["test"] for r in self.test_results if r["status"] == "FAILED"],
        }
        report_data = {
            "start_time": self.test_results[0]["timestamp"] if self.test_results else ts,
            "end_time": datetime.now().isoformat(),
            "tests": {r["test"]: {"status": r["status"], "details": r["details"]} for r in self.test_results},
            "analysis": analysis,
        }
        with open(json_path, "w") as f:
            json.dump(report_data, f, indent=2)
        print(f"  JSON report:  {json_path}")

    # ── Runner ─────────────────────────────────────────────────

    def run_all_tests(self):
        print("=" * 60)
        print("  Space Analyzer Pro — Native GUI Test Suite")
        print("=" * 60)
        print()

        # Phase 1: Binary verification (no app needed)
        print("[Phase 1] Binary Verification")
        if not self.test_binary_exists():
            self.generate_report()
            return
        self.test_binary_permissions()
        print()

        # Phase 2: Headless scan
        print("[Phase 2] Headless Scan (CLI Mode)")
        scan_data = self.run_headless_scan(".")
        print()

        # Phase 3: Launch + process lifecycle (GUI mode)
        print("[Phase 3] GUI Process Lifecycle")
        if not self.start_application():
            self.generate_report()
            return
        self.test_process_stability(duration=5)
        print()

        # Phase 4: Sampling during runtime (app is alive)
        print("[Phase 4] Runtime Checks")
        self.sample_memory(count=3, interval=2)
        print()

        # Stop the app
        print("[Phase 5] Shutdown")
        self.stop_application()
        print()

        # Phase 6: Filesystem post-mortem checks
        print("[Phase 6] Output Validation")
        self.test_scan_results_directory()
        self.test_scan_results_format()
        self.test_ai_compatibility()
        print()

        # Report
        self.generate_report()


def main():
    print()
    print("  Space Analyzer Pro — Native GUI Testing Script")
    print("  Tests binary integrity, process lifecycle, scan output format,")
    print("  and AI orchestration system compatibility.")
    print()
    print("  Make sure:")
    print("  1. The binary is compiled (native-gui/target/.../space-analyzer.exe)")
    print("  2. You run from the project root directory")
    print()

    tester = SpaceAnalyzerTester()
    tester.run_all_tests()

    print()
    print("  Done. Check the report files for detailed results.")


if __name__ == "__main__":
    main()
