#!/usr/bin/env python3
"""Replace backslash line-continuations in tooltip strings with spaces.

Rust emits "multiple lines skipped by escaped newline" when 2+ consecutive
backslash line continuations are used. This script joins those continuations
into a single space-separated line.
"""
from pathlib import Path
import re
import sys


def fix_file(path: Path) -> bool:
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("windows-1252", errors="replace")
    # Pattern: a `\` immediately followed by EOL (LF/CRLF), then optional
    # leading whitespace, then content. Replace the `\` and the newline
    # with a single space to join lines cleanly.
    new_text = re.sub(r"\\\r?\n\s*", " ", text)
    if new_text != text:
        path.write_bytes(new_text.encode("utf-8"))
        return True
    return False


def main() -> int:
    target = Path("src/gui/mod.rs")
    if not target.exists():
        print(f"Error: {target} not found", file=sys.stderr)
        return 1
    if fix_file(target):
        print(f"Fixed: {target}")
    else:
        print("No changes needed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
