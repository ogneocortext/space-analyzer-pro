"""Stateful run/loop control for the live progress dashboard.

Encapsulates the analyzer ("Run Analysis") and self-improvement loop
("Run Loop") subprocess state behind a small :class:`LiveProgressCore` class so
the HTTP layer and tests can drive it without module-global mutable state.
Thin module-level delegators keep the existing ``_run_analysis(root_base, ...)``
calling convention working for the HTTP handler.
"""
import csv
import io
import os
import shlex
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from ux_server_lib import _read_json, _safe_path, _write_json

HERE = Path(__file__).resolve().parent
LOOP_SCRIPT = HERE.parent / "improvement_loop.py"
LOOP_STATE_FILE = HERE.parent.parent / "docs" / ".loop_state.json"


def _tail_log(path, n: int = 20) -> str:
    """Read the last ``n`` lines of a log file, tolerating a missing/locked file."""
    try:
        lines = Path(path).read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(lines[-n:])
    except OSError:
        return ""


def _find_script_pids(script_basenames: list[str]) -> list[int]:
    """Return PIDs of running Python processes whose command line references any of
    ``script_basenames`` (e.g. ``"analyze_ux_screenshots.py"``).

    Used as a fallback so the dashboard can stop an analysis that was launched
    outside of it (from a terminal) or after a server reload dropped the
    in-memory run state. Returns ``[]`` on non-Windows or if the lookup fails.
    """
    if os.name != "nt":
        return []
    try:
        ps = (
            "Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='python3.exe'\" "
            "| Select-Object ProcessId,CommandLine | ConvertTo-Csv -NoTypeInformation"
        )
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True, text=True, timeout=20,
        )
    except (OSError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        return []
    pids: list[int] = []
    names = set(script_basenames)
    try:
        reader = csv.reader(io.StringIO(out.stdout))
        next(reader, None)  # header row
        for row in reader:
            if len(row) < 2:
                continue
            cmd = row[1] or ""
            try:
                tokens = shlex.split(cmd)
            except ValueError:
                tokens = cmd.split()
            # Only match the script actually being executed (the token right
            # after the interpreter), not an argument that merely references it
            # (e.g. a loop launched with `--analyzer .../analyze_ux_screenshots.py`).
            py_idx = next(
                (i for i, t in enumerate(tokens)
                 if t.lower().endswith("python.exe") or t.lower().endswith("python3.exe")),
                None,
            )
            script_token = tokens[py_idx + 1] if py_idx is not None and py_idx + 1 < len(tokens) else None
            if script_token and Path(script_token).name in names:
                try:
                    pids.append(int(row[0].strip()))
                except ValueError:
                    pass
    except (csv.Error, StopIteration, ValueError):
        pass
    return pids


class LiveProgressCore:
    """Holds the subprocess state for one dashboard root (a ``macro_logs`` dir)."""

    def __init__(self, root_base: Path):
        self.root_base = Path(root_base).resolve()
        self._run_state = None
        self._run_lock = threading.Lock()
        self._loop_state = None
        self._loop_lock = threading.Lock()
        self.loop_state_file = LOOP_STATE_FILE

    # -- analyzer run -----------------------------------------------------
    def run_analysis(self, model: str | None = None, set_name: str | None = None) -> dict:
        """Launch analyze_ux_screenshots.py as a subprocess. Refuses a second run."""
        with self._run_lock:
            if self._run_state is not None and self._run_state["proc"].poll() is None:
                return {"ok": False, "status": "already_running", "pid": self._run_state["proc"].pid}

        script = HERE / "analyze_ux_screenshots.py"
        if not script.exists():
            return {"ok": False, "error": f"analyzer script not found: {script}"}
        repo_root = HERE.parent.parent

        cmd = [sys.executable, str(script), "--shots-root", str(self.root_base)]
        if set_name:
            target = _safe_path(self.root_base, set_name)
            if target is None or not target.is_dir():
                return {"ok": False, "error": f"unknown screenshot set: {set_name}"}
            cmd += ["--shots-dir", str(target)]

        env = dict(os.environ)
        if model:
            env["VISION_MODEL"] = model

        # Drop any stale progress so the dashboard flips to idle -> running cleanly.
        stale = self.root_base / "analysis_progress.json"
        try:
            if stale.exists():
                stale.unlink()
        except OSError:
            pass

        log_path = self.root_base / "analyze_run.log"
        try:
            log_f = open(log_path, "w", encoding="utf-8")
        except OSError as exc:
            return {"ok": False, "error": f"cannot open run log: {exc}"}
        try:
            proc = subprocess.Popen(
                cmd, stdout=log_f, stderr=subprocess.STDOUT,
                cwd=str(repo_root), env=env, text=True,
            )
        except Exception as exc:  # pragma: no cover - environment failure
            log_f.close()
            return {"ok": False, "error": str(exc)}
        with self._run_lock:
            # Re-check after the potentially slow setup above. Two simultaneous
            # requests must never leave orphaned analysis processes behind.
            if self._run_state is not None and self._run_state["proc"].poll() is None:
                proc.terminate()
                log_f.close()
                return {"ok": False, "status": "already_running", "pid": self._run_state["proc"].pid}
            self._run_state = {
                "proc": proc, "log_f": log_f, "log": log_path, "cmd": cmd,
                "model": model, "set": set_name, "started": datetime.now(timezone.utc).isoformat(),
            }
        # Persist the PID so the Stop button remains recoverable if the dashboard
        # server is reloaded while the analyzer itself is still running.
        try:
            progress = _read_json(self.root_base / "analysis_progress.json") or {}
            progress["run_pid"] = proc.pid
            _write_json(self.root_base / "analysis_progress.json", progress, indent=2)
        except OSError:
            pass
        return {"ok": True, "pid": proc.pid, "log": str(log_path)}

    def run_status(self) -> dict:
        """Return the current/finished run state plus a tail of the run log.

        When the in-memory state is gone (server reloaded, or the analysis was
        launched outside the dashboard) but the analyzer process is still alive,
        recover awareness of it via a process scan so the Stop button stays
        functional. Falls back to idle otherwise.
        """
        with self._run_lock:
            state = self._run_state
            if state is None:
                if os.name == "nt":
                    pids = _find_script_pids(["analyze_ux_screenshots.py"])
                    if pids:
                        return {
                            "running": True, "finished": False, "pid": pids[0],
                            "started": None,
                            "tail": _tail_log(self.root_base / "analyze_run.log"),
                            "recovered": True,
                        }
                return {"running": False, "finished": False}
            proc = state["proc"]
            log = state.get("log")
            started = state["started"]
        tail = ""
        if log and Path(log).exists():
            try:
                lines = Path(log).read_text(encoding="utf-8", errors="replace").splitlines()
                tail = "\n".join(lines[-20:])
            except OSError:
                tail = ""
        poll = proc.poll()
        if poll is None:
            return {"running": True, "finished": False, "pid": proc.pid,
                    "started": started, "tail": tail}
        # Finished: release the log handle once.
        with self._run_lock:
            if self._run_state is not None and self._run_state.get("log_f") and not self._run_state.get("_closed"):
                try:
                    self._run_state["log_f"].close()
                except Exception:
                    pass
                self._run_state["_closed"] = True
        return {"running": False, "finished": True, "pid": proc.pid,
                "exit_code": poll, "started": started, "tail": tail}

    def stop_analysis(self) -> dict:
        """Stop the active analyzer (dashboard-launched, recorded PID, or fallback scan)."""
        proc_pid = None
        with self._run_lock:
            proc = self._run_state["proc"] if self._run_state is not None else None
            if proc is not None and proc.poll() is None:
                proc_pid = proc.pid
            else:
                progress = _read_json(self.root_base / "analysis_progress.json") or {}
                pid = progress.get("run_pid")
                if pid and progress.get("status") == "running":
                    proc_pid = int(pid)
                else:
                    for cand in _find_script_pids(["analyze_ux_screenshots.py"]):
                        proc_pid = cand
                        break
            if proc_pid is None:
                return {"ok": False, "status": "not_running"}
            try:
                if os.name == "nt":
                    subprocess.run(
                        ["taskkill", "/PID", str(proc_pid), "/T", "/F"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        check=False,
                    )
                else:
                    if proc is not None:
                        proc.terminate()
                if self._run_state is not None and proc is not None:
                    proc.wait(timeout=5)
            except (OSError, subprocess.TimeoutExpired) as exc:
                return {"ok": False, "error": f"could not stop process: {exc}"}
            if self._run_state is not None and self._run_state.get("log_f") and not self._run_state.get("_closed"):
                try:
                    self._run_state["log_f"].close()
                except OSError:
                    pass
                self._run_state["_closed"] = True
            # Drop in-memory state so the dashboard flips to idle instead of
            # showing the finished run forever.
            self._run_state = None

        progress_path = self.root_base / "analysis_progress.json"
        progress = _read_json(progress_path) or {}
        progress.update({
            "status": "stopped",
            "phase": "done",
            "message": "Analysis stopped by user",
            "stopped_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            _write_json(progress_path, progress, indent=2)
        except OSError:
            pass
        return {"ok": True, "status": "stopped", "pid": proc_pid}

    # -- self-improvement loop -------------------------------------------
    def run_loop(self, model: str | None = None, max_iterations: int | None = None,
                 category: str | None = None, dry_run: bool = False) -> dict:
        """Launch scripts/improvement_loop.py as a subprocess. Refuses a second loop."""
        with self._loop_lock:
            if self._loop_state is not None and self._loop_state["proc"].poll() is None:
                return {"ok": False, "status": "already_running", "pid": self._loop_state["proc"].pid}
        if not LOOP_SCRIPT.exists():
            return {"ok": False, "error": f"improvement loop script not found: {LOOP_SCRIPT}"}
        repo_root = HERE.parent.parent
        cmd = [sys.executable, str(LOOP_SCRIPT)]
        if model:
            cmd += ["--model", model]
        if max_iterations:
            cmd += ["--max-iterations", str(max_iterations)]
        if category:
            cmd += ["--category", category]
        if dry_run:
            cmd += ["--dry-run"]
        log_path = self.root_base / "loop_run.log"
        try:
            log_f = open(log_path, "w", encoding="utf-8")
        except OSError as exc:
            return {"ok": False, "error": f"cannot open loop log: {exc}"}
        try:
            proc = subprocess.Popen(
                cmd, stdout=log_f, stderr=subprocess.STDOUT,
                cwd=str(repo_root), text=True,
            )
        except Exception as exc:  # pragma: no cover - environment failure
            log_f.close()
            return {"ok": False, "error": str(exc)}
        with self._loop_lock:
            if self._loop_state is not None and self._loop_state["proc"].poll() is None:
                proc.terminate()
                log_f.close()
                return {"ok": False, "status": "already_running", "pid": self._loop_state["proc"].pid}
            self._loop_state = {
                "proc": proc, "log_f": log_f, "log": log_path, "cmd": cmd,
                "model": model, "max_iterations": max_iterations,
                "category": category, "dry_run": dry_run,
                "started": datetime.now(timezone.utc).isoformat(),
            }
        return {"ok": True, "pid": proc.pid, "log": str(log_path)}

    def loop_status(self) -> dict:
        """Return the current/finished loop state plus a tail of the loop log.

        Mirrors :meth:`run_status`: if the in-memory loop state is gone but the
        improvement loop is still running (e.g. after a server reload), recover
        awareness so the Stop-Loop control remains effective.
        """
        with self._loop_lock:
            state = self._loop_state
            if state is None:
                if os.name == "nt":
                    pids = _find_script_pids(["improvement_loop.py"])
                    if pids:
                        return {
                            "running": True, "finished": False, "pid": pids[0],
                            "started": None,
                            "tail": _tail_log(self.root_base / "loop_run.log"),
                            "recovered": True,
                        }
                return {"running": False, "finished": False}
            proc = state["proc"]
            log = state.get("log")
            started = state["started"]
        tail = ""
        if log and Path(log).exists():
            try:
                lines = Path(log).read_text(encoding="utf-8", errors="replace").splitlines()
                tail = "\n".join(lines[-20:])
            except OSError:
                tail = ""
        poll = proc.poll()
        if poll is None:
            return {"running": True, "finished": False, "pid": proc.pid, "started": started, "tail": tail}
        with self._loop_lock:
            if self._loop_state is not None and self._loop_state.get("log_f") and not self._loop_state.get("_closed"):
                try:
                    self._loop_state["log_f"].close()
                except Exception:
                    pass
                self._loop_state["_closed"] = True
        return {"running": False, "finished": True, "pid": proc.pid, "exit_code": poll,
                "started": started, "tail": tail}

    def loop_config(self) -> dict | None:
        """Return the active loop's launch config, or None when no loop is running."""
        with self._loop_lock:
            if self._loop_state is None:
                return None
            return {
                "model": self._loop_state.get("model"),
                "category": self._loop_state.get("category"),
                "dry_run": self._loop_state.get("dry_run", False),
                "max_iterations": self._loop_state.get("max_iterations"),
            }

    def stop_loop(self) -> dict:
        """Stop the active improvement loop (in-memory or externally-launched scan)."""
        proc_pid = None
        with self._loop_lock:
            proc = self._loop_state["proc"] if self._loop_state is not None else None
            if proc is not None and proc.poll() is None:
                proc_pid = proc.pid
            else:
                for cand in _find_script_pids(["improvement_loop.py"]):
                    proc_pid = cand
                    break
            if proc_pid is None:
                return {"ok": False, "status": "not_running"}
            try:
                if os.name == "nt":
                    subprocess.run(
                        ["taskkill", "/PID", str(proc_pid), "/T", "/F"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        check=False,
                    )
                else:
                    if proc is not None:
                        proc.terminate()
                if self._loop_state is not None and proc is not None:
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        pass
            except (OSError, subprocess.TimeoutExpired) as exc:
                return {"ok": False, "error": f"could not stop process: {exc}"}
            if self._loop_state is not None and self._loop_state.get("log_f") and not self._loop_state.get("_closed"):
                try:
                    self._loop_state["log_f"].close()
                except OSError:
                    pass
                self._loop_state["_closed"] = True
            self._loop_state = None
        return {"ok": True, "status": "stopped", "pid": proc_pid}

    def read_loop_state_file(self) -> dict:
        """Read the loop's persisted state (docs/.loop_state.json) for the dashboard."""
        try:
            return _read_json(self.loop_state_file) or {}
        except Exception:
            return {}

    def shutdown_children(self) -> None:
        """Best-effort terminate any launched children (used on server exit)."""
        for state in (self._run_state, self._loop_state):
            if not state:
                continue
            proc = state.get("proc")
            if proc is not None and proc.poll() is None:
                try:
                    if os.name == "nt":
                        subprocess.run(
                            ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
                        )
                    else:
                        proc.terminate()
                except OSError:
                    pass


# --- module-level delegators (one core instance per root_base) -----------
_CORES: dict[str, LiveProgressCore] = {}
_CORES_LOCK = threading.Lock()


def _get_core(root_base: Path) -> LiveProgressCore:
    key = str(Path(root_base).resolve())
    with _CORES_LOCK:
        core = _CORES.get(key)
        if core is None:
            core = LiveProgressCore(Path(root_base).resolve())
            _CORES[key] = core
        return core


def _run_analysis(root_base: Path, model: str | None = None, set_name: str | None = None) -> dict:
    return _get_core(root_base).run_analysis(model=model, set_name=set_name)


def _run_status(root_base: Path) -> dict:
    return _get_core(root_base).run_status()


def _stop_analysis(root_base: Path) -> dict:
    return _get_core(root_base).stop_analysis()


def _run_improvement_loop(root_base: Path, model: str | None = None, max_iterations: int | None = None,
                          category: str | None = None, dry_run: bool = False) -> dict:
    return _get_core(root_base).run_loop(model=model, max_iterations=max_iterations,
                                         category=category, dry_run=dry_run)


def _loop_status(root_base: Path) -> dict:
    return _get_core(root_base).loop_status()


def _stop_improvement_loop(root_base: Path) -> dict:
    return _get_core(root_base).stop_loop()


def _read_loop_state_file(root_base: Path) -> dict:
    return _get_core(root_base).read_loop_state_file()


def loop_config(root_base: Path) -> dict | None:
    return _get_core(root_base).loop_config()


def shutdown_children() -> None:
    with _CORES_LOCK:
        cores = list(_CORES.values())
    for core in cores:
        core.shutdown_children()
