#!/usr/bin/env python3
"""
Tail the live UX-analysis progress and write a compact human-readable timeline
to macro_logs/monitor.log (and stdout). Run in the background while Ollama works:

    python scripts/utility/live_monitor.py

Stops automatically when the run reaches status "done".
"""
import json
import time
from pathlib import Path
from urllib.request import urlopen

BASE = "http://127.0.0.1:8777"
INTERVAL = 15
LOG = Path("macro_logs/monitor.log")


def get() -> dict:
    try:
        with urlopen(BASE + "/api/progress", timeout=5) as r:
            return json.loads(r.read())
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "message": str(exc)}


def main() -> None:
    logf = LOG.open("a", encoding="utf-8")
    print(f"monitoring {BASE} -> {LOG}")
    while True:
        d = get()
        ts = time.strftime("%H:%M:%S")
        st = d.get("status")
        if st in (None, "idle", "error"):
            line = f"{ts} {st or 'idle'} {d.get('message', '')}".strip()
        else:
            shots = d.get("shots", {}) or {}
            empties = [
                k for k, v in shots.items()
                if v.get("status") == "done" and not (v.get("vision_preview") or "").strip()
            ]
            errs = len(d.get("errors") or [])
            line = (f"{ts} {st} phase={d.get('phase')} "
                    f"vis={d.get('vision_done', 0)}/{d.get('total', 0)} "
                    f"an={d.get('analysis_done', 0)} cur={d.get('current_label', '')} "
                    f"err={errs} empty={len(empties)}")
            if st == "done":
                line += " DONE"
        print(line)
        logf.write(line + "\n")
        logf.flush()
        if st == "done":
            break
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
