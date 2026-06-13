#!/usr/bin/env python3
"""Fix mojibake (double-encoded UTF-8) in Space Analyzer GUI source files.

The issue: emoji bytes (e.g., F0 9F 93 81 for 📁) were interpreted as
Windows-1252 / Latin-1, producing sequences like "ðŸ"' (LATIN SMALL LETTER
ETH + LATIN CAPITAL LETTER Y WITH DIAERESIS + RIGHT DOUBLE QUOTATION MARK).

This script maps the known broken sequences back to their proper UTF-8
emoji/symbol characters. Uses binary I/O to preserve line endings.
"""
from pathlib import Path
import sys

# Mapping of broken (mojibake) sequences to correct UTF-8 characters.
# Ordered longest-first to avoid partial replacements.
REPLACEMENTS = [
    # ----- 4-byte UTF-8 emoji sequences rendered as 4-5 chars -----
    ("ðŸ›¡", "\U0001F6E1"),  # 🛡
    ("ðŸ§¹", "\U0001F9F9"),  # 🧹
    ("ðŸ¤–", "\U0001F916"),  # 🤖
    ("ðŸ“Š", "\U0001F4CA"),  # 📊
    ("ðŸ“„", "\U0001F4C4"),  # 📄
    ("ðŸ“ˆ", "\U0001F4C8"),  # 📈
    ("ðŸ“‹", "\U0001F4CB"),  # 📋
    ("ðŸ“",  "\U0001F4C1"),  # 📁
    ("ðŸ’¾", "\U0001F4BE"),  # 💾
    ("ðŸ–¥", "\U0001F5A5"),  # 🖥
    ("ðŸ”®", "\U0001F52E"),  # 🔮
    ("ðŸ”§", "\U0001F527"),  # 🔧
    ("ðŸ•’", "\U0001F552"),  # 🕒
    ("ðŸŽ",  "\U0001F3CE"),  # 🏎
    # ----- 3-byte UTF-8 sequences rendered as 3 chars -----
    ("âš™", "\u2699"),       # ⚙
    ("âš¡", "\u26A1"),       # ⚡
    ("âš ", "\u26A0"),       # ⚠
    ("âŒ›", "\u231B"),       # ⌛
    ("â€¦", "\u2026"),       # …
    ("â”€", "\u2500"),       # ─
    ("â”‚", "\u2502"),       # │
    ("â– ", "\u25CF"),       # ● (circle, with trailing space)
    ("â–",  "\u25CF"),       # ●
    ("â† ", "\u2190"),       # ←
    ("â†'", "\u2190"),       # ←
    ("â†“", "\u2193"),       # ↓
    ("â†‘", "\u2191"),       # ↑
    ("â†’", "\u2192"),       # →
    ("â€'", "\u2014"),       # — (em dash)
    ("â€œ", "\u201C"),       # "
    ("â€\u009d", "\u201D"),  # "
    # Remaining special cases
    ("ðŸ”", "\U0001F50D"),    # 🔍 (left-pointing magnifying glass) - lost last byte
]


def fix_file(path: Path) -> bool:
    """Return True if file was modified. Uses binary I/O to preserve line endings."""
    raw = path.read_bytes()
    # Strip CR characters to satisfy Rust's "no bare CR" rule
    raw = raw.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    # Decode as UTF-8; if that fails, fall back to Windows-1252
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("windows-1252", errors="replace")
    new_text = text
    for broken, correct in REPLACEMENTS:
        if broken in new_text:
            new_text = new_text.replace(broken, correct)
    if new_text != text:
        # Write back as UTF-8 with LF line endings (binary)
        path.write_bytes(new_text.encode("utf-8"))
        return True
    return False


def main() -> int:
    root = Path("src/gui")
    if not root.exists():
        print(f"Error: {root} not found", file=sys.stderr)
        return 1
    changed = 0
    for rs_file in root.rglob("*.rs"):
        if fix_file(rs_file):
            print(f"Fixed: {rs_file}")
            changed += 1
    print(f"\n{changed} file(s) updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
