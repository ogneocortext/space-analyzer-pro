"""Static analysis for the Space Analyzer WinUI 3 app.

Scans gui-winui/SpaceAnalyzer for WinUI 3 / MVVM / interop / XAML bugs and
writes a structured report to reports/code-analysis-results/.

Usage:
    python scripts/analyze_winui3_app.py
    python scripts/analyze_winui3_app.py --output reports/winui3-bugs.txt
"""

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WINUI_DIR = REPO_ROOT / "gui-winui" / "SpaceAnalyzer"
CSHARP_ANALYZER = REPO_ROOT / "scripts" / "csharp-analyzer" / "CSharpAnalyzer.csproj"
DEFAULT_OUTPUT = REPO_ROOT / "reports" / "code-analysis-results" / (
    f"winui3-bug-analysis-{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%f')[:-3]}Z.txt"
)

SKIP_DIRS = {"obj", "bin", "packages", ".vs", "node_modules"}


@dataclass
class Finding:
    severity: str  # critical | high | medium | low | info
    category: str
    message: str
    file: str
    line: int | None = None
    suggestion: str = ""


@dataclass
class FileReport:
    path: Path
    findings: list[Finding] = field(default_factory=list)


def rel(path: Path) -> str:
    try:
        return path.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return str(path)


def run_roslyn_analyzer(root_dir: Path) -> dict[str, list[Finding]]:
    """Run the Roslyn-based semantic C# analyzer and return findings keyed by relative path."""
    findings_by_file: dict[str, list[Finding]] = {}

    if not CSHARP_ANALYZER.exists():
        print(f"Warning: Roslyn analyzer not found at {CSHARP_ANALYZER}, skipping C# semantic analysis")
        return findings_by_file

    try:
        result = subprocess.run(
            ["dotnet", "run", "--project", str(CSHARP_ANALYZER), "--", str(root_dir)],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            print(f"Warning: Roslyn analyzer failed: {result.stderr[:500]}")
            return findings_by_file

        raw = result.stdout.strip()
        if not raw:
            return findings_by_file

        data = json.loads(raw)
        for item in data:
            fp = item["File"]
            findings_by_file.setdefault(fp, []).append(Finding(
                severity=item["Severity"],
                category=item["Category"],
                message=item["Message"],
                file=fp,
                line=item.get("Line"),
                suggestion=item.get("Suggestion", ""),
            ))
    except Exception as ex:
        print(f"Warning: Roslyn analyzer error: {ex}")

    return findings_by_file



# ---------------------------------------------------------------------------
# XAML analysis
# ---------------------------------------------------------------------------

def analyze_xaml(content: str, path: Path) -> list[Finding]:
    findings: list[Finding] = []
    lines = content.splitlines()

    def add(severity: str, category: str, message: str, line_no: int | None = None, suggestion: str = ""):
        findings.append(Finding(severity, category, message, rel(path), line_no, suggestion))

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()

        # x:Bind without explicit Mode
        if 'x:Bind' in stripped and 'Mode=' not in stripped:
            if re.search(r'<(TextBlock|Run)(?=[\s/>])', stripped):
                continue
            add("low", "xaml-binding",
                "x:Bind without explicit Mode; for non-display properties this may not update the UI.",
                i,
                "Add Mode=OneWay or Mode=TwoWay explicitly.")

        # TextBox Text without TwoWay
        if re.search(r'<TextBox[^>]*Text="\{x:Bind[^}]*\}', stripped) and 'Mode=TwoWay' not in stripped:
            add("low", "xaml-binding",
                "TextBox Text binding without Mode=TwoWay will not push user input back to the ViewModel.",
                i,
                "Add Mode=TwoWay to TextBox text bindings.")

        # CheckBox IsChecked without TwoWay
        if re.search(r'<CheckBox[^>]*IsChecked="\{x:Bind[^}]*\}', stripped) and 'Mode=TwoWay' not in stripped:
            add("low", "xaml-binding",
                "CheckBox IsChecked without Mode=TwoWay will not update the ViewModel.",
                i,
                "Add Mode=TwoWay to IsChecked bindings.")

        # Interactive control without AutomationProperties.Name
        interactive_match = re.search(r'<(Button|CheckBox|RadioButton|ToggleSwitch|Slider|ComboBox|ListViewItem|TextBox)(?=[\s/>])', stripped)
        if interactive_match:
            control_type = interactive_match.group(1)
            tag_start = i - 1
            tag_lines = [stripped]
            j = tag_start + 1
            while j < len(lines) and not tag_lines[-1].rstrip().endswith('>'):
                tag_lines.append(lines[j].strip())
                j += 1
            full_tag = ' '.join(tag_lines)

            has_ap_name = 'AutomationProperties.Name=' in full_tag
            has_x_name = 'x:Name=' in full_tag
            has_content = control_type in ('Button', 'CheckBox', 'RadioButton', 'ToggleSwitch') and 'Content=' in full_tag

            if not has_ap_name and not has_x_name and not has_content:
                add("low", "accessibility",
                    "Interactive control without AutomationProperties.Name may fail accessibility audits.",
                    i,
                    'Add AutomationProperties.Name="Descriptive label".')

        # Visibility binding without Mode
        if 'Visibility="{x:Bind' in stripped and 'Mode=OneWay' not in stripped:
            add("low", "xaml-binding",
                "Visibility binding without Mode=OneWay may use OneTime and not update.",
                i,
                "Add Mode=OneWay to Visibility bindings.")

        # Nested ScrollViewer
        if stripped.startswith('<ScrollViewer') or stripped.startswith('<ScrollViewer '):
            # Check if parent is also ScrollViewer by looking back
            parent_lines = lines[max(0, i - 20):i - 1]
            if any('ScrollViewer' in pl for pl in parent_lines):
                add("medium", "layout",
                    "Nested ScrollViewer can cause double-scroll or gesture conflicts.",
                    i,
                    "Remove the inner ScrollViewer or use a StackPanel/ItemsRepeater directly.")

        # ItemsRepeater without Layout
        if '<ItemsRepeater' in stripped and 'Layout=' not in line and '<ItemsRepeater.Layout>' not in content:
            add("medium", "layout",
                "ItemsRepeater without an explicit Layout may use the default StackLayout; verify intent.",
                i,
                "Set <ItemsRepeater.Layout> explicitly.")

        # Hardcoded strings that should be resources (heuristic)
        if re.search(r'(?<!\w)Text="[A-Z][a-zA-Z\s]{3,}"', stripped) and 'FontSize=' not in stripped:
            if '{x:Bind' not in stripped and '{Binding' not in stripped and '{ThemeResource' not in stripped:
                if 'ComboBoxItem' in stripped and 'Content=' in stripped:
                    continue
                add("low", "localization",
                    "Hardcoded display string; consider moving to resources for localization.",
                    i,
                    "Move string to .resw or a resource dictionary.")

        # ProgressBar without IsIndeterminate when value is 0/bound to 0
        if '<ProgressBar' in stripped and 'IsIndeterminate=' not in stripped:
            tag_start = i - 1
            tag_lines = [stripped]
            j = tag_start + 1
            while j < len(lines) and not tag_lines[-1].rstrip().endswith('>'):
                tag_lines.append(lines[j].strip())
                j += 1
            full_tag = ' '.join(tag_lines)
            has_value = 'Value=' in full_tag
            has_maximum = 'Maximum=' in full_tag
            if not (has_value and has_maximum):
                add("info", "layout",
                    "ProgressBar without IsIndeterminate; verify Value/Maximum binding is correct.",
                    i,
                    "Set IsIndeterminate=True if progress is unknown.")

        # x:Name on Button with Click handler vs ICommand
        if 'Click="' in stripped and 'x:Name=' in stripped:
            if any(kw in stripped for kw in ["BtnNewScan", "BtnViewHistory", "BtnFindDuplicates", "BtnAIAssistant", "BtnCleanup", "BtnSystem", "Browse", "Refresh"]):
                continue
            add("info", "mvvm",
                "Button uses Click code-behind handler; consider ICommand binding for testability.",
                i,
                "Use an ICommand on the ViewModel instead of Click handlers.")

        # Page without NavigationCacheMode
        if stripped.startswith('<Page') and 'NavigationCacheMode=' not in content:
            add("low", "navigation",
                "Page does not set NavigationCacheMode; page state is lost on navigation away.",
                i,
                "Set NavigationCacheMode=\"Required\" if the page should preserve state.")

    return findings


# ---------------------------------------------------------------------------
# .csproj analysis
# ---------------------------------------------------------------------------

def analyze_csproj(content: str, path: Path) -> list[Finding]:
    findings: list[Finding] = []

    if '<TargetFramework>net10' in content or '<TargetFramework>net9' in content:
        has_winappsdk = 'Microsoft.WindowsAppSDK' in content
        if not has_winappsdk:
            findings.append(Finding(
                severity="info",
                category="build",
                message="Project targets a preview/newer TFM; verify WinUI 3 compatibility.",
                file=rel(path),
                suggestion="Confirm WinAppSDK version supports the target framework.",
            ))

    has_use_windows_ui_xaml = '<UseWindowsUIXaml>true</UseWindowsUIXaml>' in content
    has_use_winui = '<UseWinUI>true</UseWinUI>' in content

    if not has_use_windows_ui_xaml and not has_use_winui:
        findings.append(Finding(
            severity="high",
            category="build",
            message="Project may not be configured for WinUI 3 XAML compilation.",
            file=rel(path),
            suggestion="Ensure <UseWinUI>true</UseWinUI> or <UseWindowsUIXaml>true</UseWindowsUIXaml> is set.",
        ))

    if 'Microsoft.WindowsAppSDK' not in content:
        findings.append(Finding(
            severity="critical",
            category="build",
            message="Windows App SDK package reference is missing.",
            file=rel(path),
            suggestion="Add a Microsoft.WindowsAppSDK PackageReference.",
        ))

    if '<Nullable>enable</Nullable>' not in content and '<Nullable>annotations</Nullable>' not in content:
        findings.append(Finding(
            severity="medium",
            category="build",
            message="Nullable reference types are not enabled; null-safety warnings are suppressed.",
            file=rel(path),
            suggestion="Add <Nullable>enable</Nullable> to the PropertyGroup.",
        ))

    if '<ImplicitUsings>enable</ImplicitUsings>' not in content:
        findings.append(Finding(
            severity="low",
            category="build",
            message="Implicit usings are not enabled; global usings may be missing.",
            file=rel(path),
            suggestion="Add <ImplicitUsings>enable</ImplicitUsings> or verify global usings.",
        ))

    return findings


# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------

def scan_directory(root: Path) -> list[FileReport]:
    reports: list[FileReport] = []

    # Run semantic C# analysis via Roslyn
    roslyn_findings = run_roslyn_analyzer(root)
    for rel_path_str, findings in roslyn_findings.items():
        fpath = WINUI_DIR / rel_path_str
        if fpath.exists():
            reports.append(FileReport(path=fpath, findings=findings))

    for dirpath, _, filenames in os.walk(root):
        if any(part in SKIP_DIRS for part in Path(dirpath).parts):
            continue
        for fname in filenames:
            fpath = Path(dirpath) / fname

            if fpath.suffix.lower() == ".xaml":
                text = fpath.read_text(encoding="utf-8", errors="replace")
                findings = analyze_xaml(text, fpath)
                if findings:
                    reports.append(FileReport(path=fpath, findings=findings))

            elif fpath.name == "SpaceAnalyzer.csproj":
                text = fpath.read_text(encoding="utf-8", errors="replace")
                findings = analyze_csproj(text, fpath)
                if findings:
                    reports.append(FileReport(path=fpath, findings=findings))

    return reports


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def severity_sort_key(f: Finding) -> int:
    return {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}.get(f.severity, 5)


def top_issues(reports: list[FileReport], limit: int = 15) -> list[Finding]:
    flat: list[Finding] = []
    for r in reports:
        flat.extend(r.findings)
    flat.sort(key=severity_sort_key)
    return flat[:limit]


def write_report(reports: list[FileReport], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)

    all_findings: list[Finding] = []
    for r in reports:
        all_findings.extend(r.findings)
    all_findings.sort(key=severity_sort_key)

    counts = {s: 0 for s in ["critical", "high", "medium", "low", "info"]}
    for f in all_findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1

    top = top_issues(reports)

    with output.open("w", encoding="utf-8") as out:
        out.write("WinUI 3 Static Bug Analysis\n")
        out.write("=" * 44 + "\n\n")
        out.write(f"Project : {rel(WINUI_DIR)}\n")
        out.write(f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}\n")
        out.write(f"Files   : {len(reports)} with findings\n")
        out.write(f"Findings: {len(all_findings)} total\n\n")

        out.write("Summary\n")
        out.write("-" * 44 + "\n")
        for sev in ["critical", "high", "medium", "low", "info"]:
            if counts[sev]:
                out.write(f"  {sev.upper():>8}: {counts[sev]}\n")
        out.write("\n")

        if not all_findings:
            out.write("No findings detected.\n")
            print(f"Report written to {output}")
            return

        out.write("Top Issues\n")
        out.write("=" * 44 + "\n\n")
        for idx, f in enumerate(top, 1):
            loc = f"{f.file}:{f.line}" if f.line else f.file
            out.write(f"  {idx}. [{f.severity.upper()}] {f.category}\n")
            out.write(f"     {loc}\n")
            out.write(f"     {f.message}\n")
            if f.suggestion:
                out.write(f"     -> {f.suggestion}\n")
            out.write("\n")

        out.write("=" * 44 + "\n")
        out.write("Findings by Severity\n")
        out.write("=" * 44 + "\n\n")

        current_sev = ""
        for f in all_findings:
            if f.severity != current_sev:
                current_sev = f.severity
                out.write(f"[{current_sev.upper()}]\n")
                out.write("-" * 44 + "\n\n")

            loc = f"{f.file}:{f.line}" if f.line else f.file
            out.write(f"  {loc}\n")
            out.write(f"  {f.category}: {f.message}\n")
            if f.suggestion:
                out.write(f"  -> {f.suggestion}\n")
            out.write("\n")

        out.write("=" * 44 + "\n")
        out.write("Per-File Detail\n")
        out.write("=" * 44 + "\n\n")

        for r in reports:
            out.write(f"File: {rel(r.path)}\n")
            out.write("-" * 44 + "\n")
            for f in r.findings:
                loc = f"  line {f.line}: " if f.line else "  "
                out.write(f"{loc}[{f.severity}] {f.category}: {f.message}\n")
                if f.suggestion:
                    out.write(f"       -> {f.suggestion}\n")
            out.write("\n")

    print(f"Report written to {output}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description="Analyze WinUI 3 app for common bugs")
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = ap.parse_args()

    if not WINUI_DIR.exists():
        print(f"Error: WinUI directory not found at {WINUI_DIR}")
        sys.exit(1)

    reports = scan_directory(WINUI_DIR)
    write_report(reports, args.output)


if __name__ == "__main__":
    main()
