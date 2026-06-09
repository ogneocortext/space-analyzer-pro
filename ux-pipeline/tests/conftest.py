"""conftest for browser tests — wires the Playwright `page` fixture to our dashboard."""

from __future__ import annotations

import json
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest
from playwright.sync_api import Page

DASHBOARD_URL = "http://127.0.0.1:18765"


def _is_port_open(port: int = 18765) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _kill_server() -> None:
    if not _is_port_open():
        return
    if sys.platform == "win32":
        subprocess.run(
            ["powershell", "-Command",
             "Get-NetTCPConnection -LocalPort 18765 -ErrorAction SilentlyContinue | "
             "Stop-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue"],
            timeout=5,
        )
    else:
        subprocess.run(["pkill", "-f", "ux_pipeline.web_dashboard"], timeout=5)


@pytest.fixture(scope="session")
def dashboard_url() -> str:
    port = 18765
    url = f"http://127.0.0.1:{port}"
    _kill_server()
    env = os.environ.copy()
    env["PYTHONPATH"] = str(Path("ux-pipeline/src").resolve())
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m", "ux_pipeline.web_dashboard",
            "--tracker", "docs/issues.json",
            "--port", str(port),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )
    deadline = time.time() + 45
    while time.time() < deadline:
        if proc.poll() is not None:
            out = (proc.stdout.read() or b"").decode("utf-8", "replace")
            err = (proc.stderr.read() or b"").decode("utf-8", "replace")
            pytest.fail(f"Dashboard exited early.\nout={out}\nerr={err}")
        if _is_port_open(port):
            break
        time.sleep(0.25)
    else:
        out = (proc.stdout.read() or b"").decode("utf-8", "replace")
        err = (proc.stderr.read() or b"").decode("utf-8", "replace")
        pytest.fail(f"Dashboard did not start within timeout at {url}.\nout={out}\nerr={err}")
    try:
        yield url
    finally:
        if proc.poll() is None:
            try:
                proc.send_signal(signal.SIGTERM)
            except Exception:
                proc.kill()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        _kill_server()


@pytest.fixture(autouse=True)
def _nav(page: Page, dashboard_url: str) -> None:
    page.goto(dashboard_url, timeout=10000)
    page.wait_for_load_state("networkidle", timeout=10000)
