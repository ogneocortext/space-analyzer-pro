"""Command-line entry point for the ux-pipeline package.

Subcommands:

* ``--all`` — run the full analysis pipeline (PIL features + Ollama + tracker)
* ``--list`` — print the current issue tracker rows
* ``--report`` — write a markdown report of the tracker to disk
* ``--summary`` — print a short text summary (counts by status / severity)
* ``--mark-done <issue_id>`` — flip an issue to ``done``
* ``--diff`` — compare the latest two quality-history records
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ._issue_tracker import IssueRow, IssueStatus, IssueTracker
from ._llm_enrich import enrich_screenshot
from ._ollama_client import OllamaClient
from ._pipeline_config import PipelineConfig, load_config
from ._quality_history import QualityHistory, QualityRecord
from ._screenshot_links import ScreenshotLinkStore
logger = logging.getLogger("ux_pipeline.pipeline")

DEFAULT_VISION_MODEL: str = "phi4-mini:latest"
GENERATION_OPTIONS: dict[str, Any] = {"temperature": 0.2, "num_predict": 384}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def compute_quality_score(features: dict[str, Any]) -> int:
    """Compute a 0-100 quality score from extracted PIL features."""
    bright = float(features.get("bright", 0.0))
    edge = float(features.get("edge_pct", 0.0))
    center = float(features.get("center_colors", 0.0))
    dark = float(features.get("dark_pct", 0.0))
    bright_score = max(0.0, 100.0 - abs(bright - 50.0) * 2.0)
    edge_score = 100.0 if 5.0 <= edge <= 15.0 else max(0.0, 100.0 - abs(edge - 10.0) * 3.0)
    color_score = min(100.0, center * 2.0)
    dark_penalty = dark * 0.3
    return int(round(max(0.0, min(100.0, (bright_score + edge_score + color_score) / 3.0 - dark_penalty))))


def process_screenshot_features(path: str) -> dict[str, Any] | None:
    """Extract a minimal feature dict from a screenshot using Pillow."""
    try:
        from PIL import Image, ImageFilter
    except ImportError:
        logger.error("Pillow is required for --all; install with `pip install Pillow`")
        return None
    try:
        img = Image.open(path)
    except (FileNotFoundError, OSError) as exc:
        logger.debug("Could not open %s: %s", path, exc)
        return None
    try:
        gray = img.convert("L")
        pixels = list(gray.getdata())
        total = len(pixels)
        if total == 0:
            return None
        avg_bright = sum(pixels) / total
        dark_pct = sum(1 for p in pixels if p < 64) / total * 100
        edges = gray.filter(ImageFilter.FIND_EDGES)
        edge_pct = sum(1 for p in list(edges.getdata()) if p > 128) / total * 100
        center = img.crop(
            (img.size[0] // 4, img.size[1] // 4, 3 * img.size[0] // 4, 3 * img.size[1] // 4)
        ).quantize(16)
        return {
            "dim": f"{img.size[0]}x{img.size[1]}",
            "bright": round(avg_bright, 1),
            "dark_pct": round(dark_pct, 1),
            "edge_pct": round(edge_pct, 1),
            "center_colors": len(set(center.getdata())),
        }
    except (OSError, ValueError) as exc:
        logger.debug("Feature extraction failed for %s: %s", path, exc)
        return None


def _latest_screenshots_dir(shots_root: Path) -> Path | None:
    """Return the most recent ``screenshots_*`` directory under ``shots_root``."""
    if not shots_root.is_dir():
        return None
    candidates = sorted(
        (d for d in shots_root.iterdir() if d.is_dir() and d.name.startswith("screenshots_")),
        reverse=True,
    )
    return candidates[0] if candidates else None


def _extract(path: Path) -> dict[str, Any] | None:
    """Extract a minimal feature dict from a screenshot using Pillow."""
    try:
        from PIL import Image, ImageFilter
    except ImportError:
        logger.error("Pillow is required for --all; install with `pip install Pillow`")
        return None
    try:
        img = Image.open(path)
    except (FileNotFoundError, OSError) as exc:
        logger.debug("Could not open %s: %s", path, exc)
        return None
    try:
        gray = img.convert("L")
        pixels = list(gray.getdata())
        total = len(pixels)
        if total == 0:
            return None
        avg_bright = sum(pixels) / total
        dark_pct = sum(1 for p in pixels if p < 64) / total * 100
        edges = gray.filter(ImageFilter.FIND_EDGES)
        edge_pct = sum(1 for p in list(edges.getdata()) if p > 128) / total * 100
        center = img.crop(
            (img.size[0] // 4, img.size[1] // 4, 3 * img.size[0] // 4, 3 * img.size[1] // 4)
        ).quantize(16)
        return {
            "dim": f"{img.size[0]}x{img.size[1]}",
            "bright": round(avg_bright, 1),
            "dark_pct": round(dark_pct, 1),
            "edge_pct": round(edge_pct, 1),
            "center_colors": len(set(center.getdata())),
        }
    except (OSError, ValueError) as exc:
        logger.debug("Feature extraction failed for %s: %s", path, exc)
        return None


# ---------------------------------------------------------------------- #
# Subcommands
# ---------------------------------------------------------------------- #
def cmd_all(args: argparse.Namespace, cfg: PipelineConfig) -> int:
    """Run the full pipeline: feature extraction + Ollama + tracker update."""
    shots_root = Path(args.shots_root or cfg.screenshots_root)
    latest = _latest_screenshots_dir(shots_root)
    if latest is None:
        logger.error("No screenshots_* directory under %s", shots_root)
        return 1
    ts = latest.name.replace("screenshots_", "")

    tracker = IssueTracker(cfg.tracker_path)
    tracker.load()
    links = ScreenshotLinkStore(cfg.tracker_path.with_name("ux_screenshot_links.json"))
    links.load()
    history = QualityHistory(cfg.quality_history_path)

    pngs = sorted(latest.glob("*.png"))
    per_screenshot: dict[str, int] = {}
    for path in pngs:
        feats = _extract(path)
        if feats is None:
            continue
        per_screenshot[path.stem] = compute_quality_score(feats)
    if not per_screenshot:
        logger.error("No features extracted; aborting")
        return 1
    avg_score = int(round(sum(per_screenshot.values()) / len(per_screenshot)))

    client = OllamaClient(
        host=cfg.ollama_host, timeout=cfg.ollama_timeout_s, retries=cfg.ollama_retries
    )
    findings: list[Any] = []
    for path in pngs:
        try:
            for finding in enrich_screenshot(
                path,
                client=client,
                model=args.model or cfg.ollama_model,
            ):
                if finding.screenshot is None:
                    finding.screenshot = path.name
                findings.append(finding)
        except Exception as exc:
            logger.debug("enrich_screenshot(%s) failed: %s", path, exc)
    rows = _vision_findings_to_rows(findings)
    for row in rows:
        tracker.upsert(row)
        if row.screenshot:
            links.link(row.issue_id, row.screenshot)
    tracker.save()
    links.save()

    history.append(
        QualityRecord(
            run_id=ts,
            score=avg_score,
            per_screenshot=per_screenshot,
            notes=f"Vision findings: {len(rows)}",
            extra={
                "model": args.model or cfg.ollama_model,
                "screenshots": len(per_screenshot),
            },
        )
    )
    print(
        f"Run {ts}: quality={avg_score}/100, new findings={len(rows)}, "
        f"total issues={len(tracker)}"
    )
    return 0


def _vision_findings_to_rows(findings: list[Any]) -> list[IssueRow]:
    from ._vision_to_issues import findings_to_rows
    return findings_to_rows(findings)


def cmd_list(args: argparse.Namespace, cfg: PipelineConfig) -> int:
    """Print the current tracker rows as JSON."""
    tracker = IssueTracker(cfg.tracker_path)
    tracker.load()
    rows = tracker.all()
    if args.status:
        rows = tracker.filter(status=args.status)
    if args.category:
        rows = tracker.filter(category=args.category)
    payload = [row.to_dict() for row in rows]
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def cmd_summary(args: argparse.Namespace, cfg: PipelineConfig) -> int:
    """Print a one-screen text summary of the tracker and history."""
    tracker = IssueTracker(cfg.tracker_path)
    tracker.load()
    rows = tracker.all()
    by_status: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    by_category: dict[str, int] = {}
    for row in rows:
        by_status[row.status.value] = by_status.get(row.status.value, 0) + 1
        by_severity[row.severity] = by_severity.get(row.severity, 0) + 1
        by_category[row.category] = by_category.get(row.category, 0) + 1

    history = QualityHistory(cfg.quality_history_path)
    qsum = history.summary()

    print(f"Issues: {len(rows)}")
    if by_status:
        print("  by status:  " + ", ".join(f"{k}={v}" for k, v in sorted(by_status.items())))
    if by_severity:
        print("  by severity:" + ", ".join(f" {k}={v}" for k, v in sorted(by_severity.items())))
    if by_category:
        print("  by category:" + ", ".join(f" {k}={v}" for k, v in sorted(by_category.items())))
    if qsum["count"]:
        trend = qsum["trend"]
        arrow = ""
        if isinstance(trend, int):
            arrow = " (up)" if trend > 0 else (" (down)" if trend < 0 else " (flat)")
        latest_score = qsum["latest"]["score"]
        print(
            f"Quality history: {qsum['count']} runs, latest={latest_score}{arrow}, "
            f"avg={qsum['average']}"
        )
    return 0


def cmd_report(args: argparse.Namespace, cfg: PipelineConfig) -> int:
    """Write a markdown report of the tracker to ``args.output``."""
    tracker = IssueTracker(cfg.tracker_path)
    tracker.load()
    history = QualityHistory(cfg.quality_history_path)
    links = ScreenshotLinkStore(cfg.tracker_path.with_name("ux_screenshot_links.json"))
    links.load()

    rows = sorted(tracker.all(), key=lambda r: (r.status.value, r.severity, r.issue_id))
    lines: list[str] = [
        "# UX Pipeline Issue Report",
        f"Generated: {_now_iso()}",
        f"Total issues: {len(rows)}",
        "",
        "## Quality History",
        "",
    ]
    qsum = history.summary()
    if qsum["count"]:
        lines.append(f"- Runs: {qsum['count']}")
        lines.append(f"- Latest score: {qsum['latest']['score']}/100 (trend {qsum['trend']})")
        lines.append(f"- Average: {qsum['average']}")
    else:
        lines.append("- No quality history yet")

    lines += ["", "## Issues", ""]
    if not rows:
        lines.append("_No issues recorded._")
    else:
        lines.append("| ID | Status | Severity | Category | Title | Screenshots |")
        lines.append("|----|--------|----------|----------|-------|-------------|")
        for row in rows:
            shots = ", ".join(links.screenshots_for(row.issue_id)) or "-"
            title = row.title.replace("|", "\\|")
            lines.append(
                f"| `{row.issue_id}` | {row.status.value} | {row.severity} | "
                f"{row.category} | {title} | {shots} |"
            )

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {out}")
    return 0


def cmd_mark_done(args: argparse.Namespace, cfg: PipelineConfig) -> int:
    """Flip the issue to ``done`` and persist."""
    tracker = IssueTracker(cfg.tracker_path)
    tracker.load()
    if not tracker.get(args.issue_id):
        print(f"Issue {args.issue_id} not found", file=sys.stderr)
        return 1
    tracker.mark_status(args.issue_id, IssueStatus.DONE)
    tracker.save()
    print(f"Marked {args.issue_id} as done")
    return 0


def cmd_diff(args: argparse.Namespace, cfg: PipelineConfig) -> int:
    """Compare the latest two quality records and print the delta."""
    history = QualityHistory(cfg.quality_history_path)
    items = history.all()
    if len(items) < 2:
        print("Need at least two quality records to diff", file=sys.stderr)
        return 1
    a, b = items[-2], items[-1]
    print(f"Run A: {a.run_id}  score={a.score}")
    print(f"Run B: {b.run_id}  score={b.score}")
    print(f"Delta: {b.score - a.score:+d}")
    all_keys = sorted(set(a.per_screenshot) | set(b.per_screenshot))
    if not all_keys:
        return 0
    print("\nPer-screenshot deltas:")
    for key in all_keys:
        sa = a.per_screenshot.get(key)
        sb = b.per_screenshot.get(key)
        if sa is None or sb is None:
            print(f"  {key}: {sa} -> {sb}")
        else:
            print(f"  {key}: {sa} -> {sb}  ({(sb - sa):+d})")
    return 0


# ---------------------------------------------------------------------- #
# Argument parsing
# ---------------------------------------------------------------------- #
def _build_parser() -> argparse.ArgumentParser:
    """Build the top-level argument parser with all subcommands wired in."""
    parser = argparse.ArgumentParser(
        prog="ux-pipeline",
        description="UX pipeline CLI: analyze, list, report, summary, diff, mark-done.",
    )
    parser.add_argument("--shots-root", default=None, help="Directory containing screenshots_* subdirs")
    parser.add_argument("--tracker", default=None, help="Path to the issue tracker JSON")
    parser.add_argument("--history", default=None, help="Path to the quality history JSONL")
    parser.add_argument("--model", default=None, help="Ollama model name (default phi4-mini:latest)")
    parser.add_argument("--output", default="ux_report.md", help="Output path for --report")
    parser.add_argument("--status", default=None, help="Filter --list by status")
    parser.add_argument("--category", default=None, help="Filter --list by category")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="Run the full pipeline")
    group.add_argument("--list", action="store_true", help="List tracker rows as JSON")
    group.add_argument("--report", action="store_true", help="Write a markdown report")
    group.add_argument("--summary", action="store_true", help="Print a short summary")
    group.add_argument("--mark-done", dest="mark_done", default=None, metavar="ISSUE_ID", help="Mark an issue done")
    group.add_argument("--diff", action="store_true", help="Diff the latest two quality records")
    return parser


def main(argv: list[str] | None = None) -> int:
    """Entry point for the CLI."""
    parser = _build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    cfg = load_config()
    if args.tracker:
        cfg.tracker_path = Path(args.tracker)
    if args.history:
        cfg.quality_history_path = Path(args.history)

    if args.all:
        return cmd_all(args, cfg)
    if args.list:
        return cmd_list(args, cfg)
    if args.report:
        return cmd_report(args, cfg)
    if args.summary:
        return cmd_summary(args, cfg)
    if args.mark_done:
        args.issue_id = args.mark_done
        return cmd_mark_done(args, cfg)
    if args.diff:
        return cmd_diff(args, cfg)
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
