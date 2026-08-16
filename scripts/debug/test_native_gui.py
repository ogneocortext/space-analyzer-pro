#!/usr/bin/env python3
"""
Automated Space Analyzer Native GUI Testing Script
Tests binary integrity, process lifecycle, file output format,
and AI system compatibility.
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("test_native_gui")

# Optional dependency: psutil for memory sampling
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# Schema and configuration
EXPECTED_SCHEMA_VERSION: str = "2.0"
REQUIRED_JSON_SCHEMA_KEYS: list[str] = [
    "schema_version", "generated_at", "scanner_version",
    "scan_config", "summary", "file_analysis", "performance", "issues",
]
REQUIRED_SUMMARY_KEYS: list[str] = ["total_files", "total_size", "scan_duration_ms"]
REQUIRED_FILE_KEYS: list[str] = ["files", "categories", "extension_stats"]
REQUIRED_FILE_ENTRY_KEYS: tuple[str, ...] = ("name", "path", "size", "extension")

# Tuning parameters
STARTUP_WAIT_S: float = 2.5
STOP_TIMEOUT_S: int = 5
SCAN_TIMEOUT_S: int = 30
DEFAULT_STABILITY_DURATION_S: int = 8
DEFAULT_MEMORY_SAMPLES: int = 5
DEFAULT_MEMORY_INTERVAL_S: int = 2
DEFAULT_TEST_STABILITY_S: int = 5
DEFAULT_MEMORY_TEST_SAMPLES: int = 3
MAX_ERRORS_IN_SUMMARY: int = 5

SUCCESS_STATUSES: set[str] = {"PASSED", "COMPLETED"}


class SpaceAnalyzerTester:
    """Run the native GUI test suite and record results."""

    def __init__(self, search_paths: list[Path] | None = None) -> None:
        """Locate the compiled binary and initialize state.

        Args:
            search_paths: Optional list of paths to search for the binary.
        """
        self.search_paths = search_paths or [
            Path("target/release/space-analyzer.exe"),
            Path("target/debug/space-analyzer.exe"),
            Path("bin/space-analyzer.exe"),
            Path("../target/release/space-analyzer.exe"),
        ]
        self.exe_path: Path | None = next(
            (p.resolve() for p in self.search_paths if p.exists()),
            None,
        )
        self.process: subprocess.Popen[bytes] | None = None
        self.test_results: list[dict[str, Any]] = []
        self.start_time: float | None = None
        self.mem_samples: list[int] = []
        self.scan_results_dir: Path = Path("scan_results")

    def log_test(self, test_name: str, status: str, details: str = "") -> None:
        """Record a test result and print a one-line summary.

        Args:
            test_name: Human-readable test name.
            status: One of PASSED, FAILED, COMPLETED, SKIPPED.
            details: Optional details string.
        """
        result = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "test": test_name,
            "status": status,
            "details": details,
        }
        self.test_results.append(result)
        sym = "PASS" if status in SUCCESS_STATUSES else "FAIL"
        logger.info("  [%s] %s: %s", sym, test_name, status)
        if details:
            logger.info("         %s", details)

    # ── Phase 1: Binary Verification ──────────────────────────

    def test_binary_exists(self) -> bool:
        """Verify the compiled binary exists at one of the search paths."""
        if self.exe_path and self.exe_path.exists():
            size = self.exe_path.stat().st_size
            self.log_test("Binary Exists", "PASSED", f"Found at {self.exe_path} ({size // 1024} KB)")
            return True
        self.log_test("Binary Exists", "FAILED", "Binary not found in any expected path")
        return False

    def test_binary_permissions(self) -> bool:
        """Verify the binary has the execute permission bit set."""
        if self.exe_path and os.access(self.exe_path, os.X_OK):
            self.log_test("Binary Executable", "PASSED", "Execute permission OK")
            return True
        self.log_test("Binary Executable", "FAILED", "Binary is not executable")
        return False

    # ── Phase 2: Process Lifecycle ─────────────────────────────

    def start_application(self) -> bool:
        """Launch the binary and verify it stays alive for a few seconds.

        Returns:
            True if the process started successfully.
        """
        if self.exe_path is None:
            self.log_test("Launch", "FAILED", "No binary selected")
            return False
        try:
            self.log_test("Launch", "PASSED", f"Starting: {self.exe_path.name}")
            t0 = time.time()
            self.process = subprocess.Popen(
                [str(self.exe_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0,
            )
            time.sleep(STARTUP_WAIT_S)
            startup_ms = (time.time() - t0) * 1000

            if self.process.poll() is None:
                self.start_time = time.time()
                self.log_test("Application Start", "PASSED", f"Startup: {startup_ms:.0f}ms, PID: {self.process.pid}")
                return True
            _, stderr = self.process.communicate()
            err = stderr.decode()[:200] if stderr else "None"
            self.log_test("Application Start", "FAILED", f"Exited immediately. Stderr: {err}")
            return False
        except OSError as e:
            self.log_test("Application Start", "FAILED", f"Exception: {e}")
            return False

    def stop_application(self) -> None:
        """Terminate the running application, falling back to kill on timeout."""
        if not self.process:
            return
        try:
            self.process.terminate()
            self.process.wait(timeout=STOP_TIMEOUT_S)
            uptime = (time.time() - self.start_time) if self.start_time else 0.0
            self.log_test("Application Stop", "PASSED", f"Graceful shutdown (uptime: {uptime:.1f}s)")
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.log_test("Application Stop", "PASSED", "Force-killed after timeout")
        except OSError as e:
            self.log_test("Application Stop", "FAILED", f"Exception: {e}")

    def test_process_stability(self, duration: int = DEFAULT_STABILITY_DURATION_S) -> None:
        """Watch the process for the given duration and log any early exit."""
        stable = True
        for i in range(duration):
            time.sleep(1)
            if self.process and self.process.poll() is not None:
                self.log_test("Process Stability", "FAILED", f"Crashed at t={i + 1}s")
                stable = False
                break
        if stable:
            uptime = (time.time() - self.start_time) if self.start_time else duration
            self.log_test("Process Stability", "PASSED", f"Stable for {uptime:.0f}s")

    # ── Phase 3: Filesystem Effects ────────────────────────────

    def run_headless_scan(self, target_path: str | None = None) -> dict[str, Any] | None:
        """Run a headless scan to generate test output.

        Args:
            target_path: Directory to scan (defaults to current dir).

        Returns:
            Parsed JSON dict, or None on failure.
        """
        if target_path is None:
            target_path = "."
        if self.exe_path is None:
            self.log_test("Headless Scan", "FAILED", "No binary selected")
            return None
        self.log_test("Headless Scan", "PASSED", f"Scanning: {target_path}")
        try:
            t0 = time.time()
            result = subprocess.run(
                [str(self.exe_path), "--scan", target_path],
                capture_output=True,
                text=True,
                timeout=SCAN_TIMEOUT_S,
                check=False,
            )
            elapsed_ms = (time.time() - t0) * 1000
            output = result.stdout.strip()
            data = json.loads(output) if output else {}
            summary = data.get("summary", {})
            self.log_test(
                "Headless Scan Result", "PASSED",
                f"Return code: {result.returncode}, "
                f"Files: {summary.get('total_files', '?')}, "
                f"Size: {summary.get('total_size', '?')} bytes, "
                f"Duration: {elapsed_ms:.0f}ms",
            )
            return data
        except subprocess.TimeoutExpired:
            self.log_test("Headless Scan Result", "FAILED", f"Timed out after {SCAN_TIMEOUT_S}s")
        except json.JSONDecodeError as e:
            self.log_test("Headless Scan Result", "FAILED", f"Invalid JSON: {e}")
        except OSError as e:
            self.log_test("Headless Scan Result", "FAILED", str(e))
        return None

    def test_scan_results_directory(self) -> bool:
        """Check that the scan results directory exists."""
        if self.scan_results_dir.exists():
            self.log_test("Scan Results Dir", "PASSED", f"Directory exists at {self.scan_results_dir}")
            return True
        self.log_test("Scan Results Dir", "FAILED", "scan_results/ directory not found")
        return False

    def _validate_scan_file(self, json_file: Path) -> tuple[bool, list[str]]:
        """Validate a single scan result file against the expected schema.

        Args:
            json_file: Path to the JSON file.

        Returns:
            Tuple of (is_valid, list of error messages).
        """
        errors: list[str] = []
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            return False, [f"{json_file.name}: invalid JSON - {e}"]

        sv = data.get("schema_version")
        if sv != EXPECTED_SCHEMA_VERSION:
            errors.append(f"{json_file.name}: schema_version={sv}, expected {EXPECTED_SCHEMA_VERSION}")
            return False, errors

        for key in REQUIRED_JSON_SCHEMA_KEYS:
            if key not in data:
                errors.append(f"{json_file.name}: missing top-level key '{key}'")

        for key in REQUIRED_SUMMARY_KEYS:
            if key not in data.get("summary", {}):
                errors.append(f"{json_file.name}: summary missing '{key}'")

        fa = data.get("file_analysis", {})
        for key in REQUIRED_FILE_KEYS:
            if key not in fa:
                errors.append(f"{json_file.name}: file_analysis missing '{key}'")

        for fi in fa.get("files", []):
            for fk in REQUIRED_FILE_ENTRY_KEYS:
                if fk not in fi:
                    errors.append(f"{json_file.name}: file missing '{fk}'")

        return not errors, errors

    def test_scan_results_format(self) -> None:
        """Validate all scan result JSON files against the schema."""
        if not self.scan_results_dir.exists():
            self.log_test("Scan JSON Format", "FAILED", "scan_results/ missing")
            return

        files = sorted(self.scan_results_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not files:
            self.log_test("Scan JSON Format", "FAILED", "No scan result files found")
            return

        validated = 0
        errors: list[str] = []
        for json_file in files:
            ok, file_errors = self._validate_scan_file(json_file)
            errors.extend(file_errors)
            if ok:
                validated += 1

        total = len(files)
        if validated == total and not errors:
            self.log_test("Scan JSON Format", "PASSED", f"{validated}/{total} files validate against schema v{EXPECTED_SCHEMA_VERSION}")
        else:
            summary = "; ".join(errors[:MAX_ERRORS_IN_SUMMARY])
            self.log_test("Scan JSON Format", "FAILED", f"{validated}/{total} valid. Errors: {summary}")

    def test_ai_compatibility(self) -> None:
        """Check that scan results contain fields needed by the AI subsystem."""
        if not self.scan_results_dir.exists():
            return
        files = list(self.scan_results_dir.glob("*.json"))
        if not files:
            return

        checks = {"has_categories": 0, "has_extension_stats": 0, "has_performance": 0, "has_issues": 0, "total": 0}
        for json_file in files:
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            checks["total"] += 1
            if "categories" in data.get("file_analysis", {}):
                checks["has_categories"] += 1
            if "extension_stats" in data.get("file_analysis", {}):
                checks["has_extension_stats"] += 1
            if data.get("performance"):
                checks["has_performance"] += 1
            if data.get("issues"):
                checks["has_issues"] += 1

        t = checks["total"]
        if t == 0:
            return
        ok = (checks["has_categories"] + checks["has_extension_stats"]
              + checks["has_performance"] + checks["has_issues"])
        self.log_test(
            "AI Compatibility", "PASSED" if ok == t * 4 else "FAILED",
            f"categories:{checks['has_categories']}/{t} "
            f"ext_stats:{checks['has_extension_stats']}/{t} "
            f"performance:{checks['has_performance']}/{t} "
            f"issues:{checks['has_issues']}/{t}",
        )

    # ── Phase 4: Performance ───────────────────────────────────

    def sample_memory(self, count: int = DEFAULT_MEMORY_SAMPLES, interval: int = DEFAULT_MEMORY_INTERVAL_S) -> None:
        """Sample the application's RSS memory usage at fixed intervals."""
        if not HAS_PSUTIL:
            self.log_test("Memory Usage", "SKIPPED", "psutil not available")
            return
        for _ in range(count):
            if self.process and self.process.poll() is None:
                try:
                    proc = psutil.Process(self.process.pid)
                    self.mem_samples.append(proc.memory_info().rss)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            time.sleep(interval)

        if self.mem_samples:
            avg_mb = sum(self.mem_samples) / len(self.mem_samples) / 1024 / 1024
            peak_mb = max(self.mem_samples) / 1024 / 1024
            if len(self.mem_samples) > 1 and self.mem_samples[0]:
                growth = (self.mem_samples[-1] - self.mem_samples[0]) / self.mem_samples[0] * 100
            else:
                growth = 0.0
            self.log_test("Memory Usage", "PASSED", f"Avg: {avg_mb:.0f} MB, Peak: {peak_mb:.0f} MB, Growth: {growth:+.0f}%")
        else:
            self.log_test("Memory Usage", "SKIPPED", "no memory samples collected")

    # ── Phase 5: Report ────────────────────────────────────────

    def generate_report(self) -> None:
        """Print and persist a consolidated test report."""
        print()
        print("=" * 60)
        print("  SPACE ANALYZER NATIVE GUI - TEST REPORT")
        print("=" * 60)

        passed = sum(1 for r in self.test_results if r["status"] in SUCCESS_STATUSES)
        failed = sum(1 for r in self.test_results if r["status"] == "FAILED")
        skipped = sum(1 for r in self.test_results if r["status"] == "SKIPPED")
        total = len(self.test_results)
        rate = (passed / total * 100) if total else 0.0

        print(f"  Total: {total}  |  Passed: {passed}  |  Failed: {failed}  |  Skipped: {skipped}")
        print(f"  Success Rate: {rate:.1f}%")
        print("-" * 60)

        for r in self.test_results:
            sym = "+" if r["status"] in SUCCESS_STATUSES else ("~" if r["status"] == "SKIPPED" else "!")
            print(f"  {sym}  {r['test']}: {r['status']}")
            if r["details"]:
                for line in r["details"].split("; "):
                    print(f"       {line}")

        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        self._save_text_report(ts)
        self._save_json_report(ts, total, passed, failed, skipped, rate)

    def _save_text_report(self, ts: str) -> None:
        """Write a plain-text report to ``test_report_<ts>.txt``."""
        txt_path = f"test_report_{ts}.txt"
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write("SPACE ANALYZER NATIVE GUI - TEST REPORT\n")
            f.write("=" * 60 + "\n\n")
            for r in self.test_results:
                f.write(f"{r['timestamp']} - {r['test']}: {r['status']}\n")
                if r["details"]:
                    f.write(f"  Details: {r['details']}\n")
        print(f"\n  Text report: {txt_path}")

    def _save_json_report(
        self,
        ts: str,
        total: int,
        passed: int,
        failed: int,
        skipped: int,
        rate: float,
    ) -> None:
        """Write a JSON report to ``test_results_<ts>.json``."""
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
            "end_time": datetime.now(timezone.utc).isoformat(),
            "tests": {r["test"]: {"status": r["status"], "details": r["details"]} for r in self.test_results},
            "analysis": analysis,
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)
        print(f"  JSON report:  {json_path}")

    # ── Runner ─────────────────────────────────────────────────

    def run_all_tests(self) -> None:
        """Execute every test phase in order."""
        print("=" * 60)
        print("  Space Analyzer Pro — Native GUI Test Suite")
        print("=" * 60)
        print()

        print("[Phase 1] Binary Verification")
        if not self.test_binary_exists():
            self.generate_report()
            return
        self.test_binary_permissions()
        print()

        print("[Phase 2] Headless Scan (CLI Mode)")
        self.run_headless_scan(".")
        print()

        print("[Phase 3] GUI Process Lifecycle")
        if not self.start_application():
            self.generate_report()
            return
        self.test_process_stability(duration=DEFAULT_TEST_STABILITY_S)
        print()

        print("[Phase 4] Runtime Checks")
        self.sample_memory(count=DEFAULT_MEMORY_TEST_SAMPLES, interval=2)
        print()

        print("[Phase 5] Shutdown")
        self.stop_application()
        print()

        print("[Phase 6] Output Validation")
        self.test_scan_results_directory()
        self.test_scan_results_format()
        self.test_ai_compatibility()
        print()

        self.generate_report()


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments.

    Args:
        argv: Optional argument list.

    Returns:
        Parsed argument namespace.
    """
    parser = argparse.ArgumentParser(description="Native GUI test suite for Space Analyzer")
    parser.add_argument("--scan-results-dir", default="scan_results", help="Directory containing scan result JSON files")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Entry point for the CLI.

    Args:
        argv: Optional argument list.

    Returns:
        Process exit code.
    """
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
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
    tester.scan_results_dir = Path(args.scan_results_dir)
    tester.run_all_tests()

    print()
    print("  Done. Check the report files for detailed results.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
