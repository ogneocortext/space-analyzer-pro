#!/usr/bin/env python3
"""Restore the broken escape_html function in workflow_render.rs."""
import re
from pathlib import Path

target = Path(r"src\gui\workflow_render.rs")
raw = target.read_bytes()

# Find the function by name. The function body is whatever currently sits
# between the first `{` after `fn escape_html` and the matching `}`.
pattern = re.compile(
    rb"fn escape_html\(s: &str\) -> String \{[^}]*\}",
    re.DOTALL,
)
matches = list(pattern.finditer(raw))
print(f"Found {len(matches)} escape_html function(s)")

# Replacement: build the byte sequence with each entity name assembled
# from individual bytes to avoid any HTML-entity interpretation.
def build_replacement() -> bytes:
    amp = b"&" + b"amp;"
    lt  = b"&" + b"lt;"
    gt  = b"&" + b"gt;"
    qu  = b"&" + b"quot;"
    apos = b"&#x27;"
    parts = [
        b"fn escape_html(s: &str) -> String {\n",
        b"    s.replace('&', \"" + amp + b"\")\n",
        b"     .replace('<', \"" + lt + b"\")\n",
        b"     .replace('>', \"" + gt + b"\")\n",
        b"     .replace('\"', \"" + qu + b"\")\n",
        b"     .replace('\\'', \"" + apos + b"\")\n",
        b"}",
    ]
    return b"".join(parts)

replacement = build_replacement()
print("Replacement bytes:")
print(repr(replacement))

if matches:
    # Replace only the first occurrence (there should be exactly one).
    new_raw = raw[:matches[0].start()] + replacement + raw[matches[0].end():]
    target.write_bytes(new_raw)
    print("Replaced function successfully.")
else:
    print("ERROR: no escape_html function found")
