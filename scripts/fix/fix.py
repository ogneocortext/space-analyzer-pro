#!/usr/bin/env python3
"""Fix mojibake in Space Analyzer Pro source files via byte-level replacements."""
import os
import re
import sys

# Emoji codepoints
EMOJIS = {
    'folder': '📁', 'clock': '🕒', 'floppy': '💾', 'desktop': '🖥',
    'chart_up': '📈', 'gear': '⚙', 'page': '📄', 'crystal': '🔮',
    'search': '🔍', 'wrench': '🔧', 'bolt': '⚡', 'robot': '🤖',
    'bookmark': '📑', 'shield': '🛡', 'broom': '🧹', 'racing': '🏎',
    'check': '✓', 'warning': '⚠', 'info': 'ℹ', 'cross': '✗',
    'stopwatch': '⏱', 'bullet': '●', 'clipboard': '📋',
}
def e(name):
    return EMOJIS[name].encode('utf-8')

def fix_file(path, replacements):
    """Apply byte-level replacements to a file."""
    with open(path, 'rb') as f:
        data = f.read()
    original = data
    count = 0
    for old, new in replacements:
        if isinstance(old, str):
            old = old.encode('utf-8')
        if isinstance(new, str):
            new = new.encode('utf-8')
        if old in data:
            n = data.count(old)
            data = data.replace(old, new)
            count += n
            print(f"  Replaced {n} occurrence(s) of: {old[:30]}...")
    if data != original:
        with open(path, 'wb') as f:
            f.write(data)
        print(f"  Saved {path} ({count} replacements)")
    return count

print("Fixing src/gui/mod.rs...")
mod_rs_replacements = [
    (b'icon_fn!(scan, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xc2\xa1"',
     b'icon_fn!(scan, "\xf0\x9f\x93\x81"'),
    (b'icon_fn!(history, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\x99"',
     b'icon_fn!(history, "\xf0\x9f\x95\x92"'),
    (b'icon_fn!(disk, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xc2\xbe"',
     b'icon_fn!(disk, "\xf0\x9f\x92\xbe"'),
    (b'icon_fn!(system, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\x93\xc2\xa5"',
     b'icon_fn!(system, "\xf0\x9f\x96\xa5"'),
    (b'icon_fn!(trend, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\x98"',
     b'icon_fn!(trend, "\xf0\x9f\x93\x88"'),
    (b'icon_fn!(workflow, "\xc3\xa2\xe2\x80\x9c\xc2\xa0"',
     b'icon_fn!(workflow, "\xe2\x9a\x99"'),
    (b'icon_fn!(filetype, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\x9c"',
     b'icon_fn!(filetype, "\xf0\x9f\x93\x84"'),
    (b'icon_fn!(predict, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xc2\xae"',
     b'icon_fn!(predict, "\xf0\x9f\x94\xae"'),
    (b'icon_fn!(pattern, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\x8d"',
     b'icon_fn!(pattern, "\xf0\x9f\x94\x8d"'),
    (b'icon_fn!(tool, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\xa0"',
     b'icon_fn!(tool, "\xf0\x9f\x94\xa7"'),
    (b'icon_fn!(quick, "\xc3\xa2\xc2\x9c\xc2\xa1"',
     b'icon_fn!(quick, "\xe2\x9a\xa1"'),
    (b'icon_fn!(model, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\x93"',
     b'icon_fn!(model, "\xf0\x9f\xa4\x96"'),
    (b'icon_fn!(index, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\x9a"',
     b'icon_fn!(index, "\xf0\x9f\x93\x91"'),
    (b'icon_fn!(security, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\xa1"',
     b'icon_fn!(security, "\xf0\x9f\x9b\xa1"'),
    (b'icon_fn!(cleanup, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\xb9"',
     b'icon_fn!(cleanup, "\xf0\x9f\xa7\xb9"'),
    (b'icon_fn!(performance, "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\x8e"',
     b'icon_fn!(performance, "\xf0\x9f\x8f\x8e"'),
    (b'icon_fn!(check, "\xc3\xa2\xc5\x93\xe2\x80\x9c"',
     b'icon_fn!(check, "\xe2\x9c\x93"'),
    (b'icon_fn!(warning, "\xc3\xa2\xc2\x9c\xc2\xa0"',
     b'icon_fn!(warning, "\xe2\x9a\xa0"'),
    (b'NotificationLevel::Info => "\xc3\xa2\xe2\x80\x9e\xc2\xb9"',
     b'NotificationLevel::Info => "\xe2\x84\xb9"'),
    (b'NotificationLevel::Success => "\xc3\xa2\xc5\x93\xe2\x80\x9c"',
     b'NotificationLevel::Success => "\xe2\x9c\x93"'),
    (b'NotificationLevel::Warning => "\xc3\xa2\xc2\x9c\xc2\xa0"',
     b'NotificationLevel::Warning => "\xe2\x9a\xa0"'),
    (b'NotificationLevel::Error => "\xc3\xa2\xc5\x93\xe2\x80\x94"',
     b'NotificationLevel::Error => "\xe2\x9c\x97"'),
]
fix_file('src/gui/mod.rs', mod_rs_replacements)

print("Fixing src/gui/scan.rs...")
scan_rs_replacements = [
    # Find and replace mojibake emoji in scan.rs
    (b'\xc3\xa2\xc2\x9d\xc2\xb0\xc3\x8d', b'\xe2\x8f\xb1'),  # stopwatch
    (b'\xc3\xa2\xc5\x93\xc2\xb0', b'\xe2\x8f\xb1'),  # stopwatch variant
    (b'\xc3\xb0\xc5\xb8\xe2\x80\x9c\xc2\xa1', b'\xf0\x9f\x93\x81'),  # folder
    (b'\xc3\xb0\xc5\xb8\xe2\x80\x9c\xc2\xbe', b'\xf0\x9f\x92\xbe'),  # floppy
    (b'\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\x9c', b'\xf0\x9f\x93\x84'),  # page
]
fix_file('src/gui/scan.rs', scan_rs_replacements)

print("Fixing src/gui/dashboard.rs...")
dash_rs_replacements = [
    (b'egui::Button::new("\xc3\xb0\xc5\xb8\xe2\x80\x9c\xc2\xa1 Scan Now")',
     b'egui::Button::new("\xf0\x9f\x93\x81 Scan Now")'),
    (b'ui.button("\xc3\xb0\xc5\xb8\xe2\x80\x9b History")',
     b'ui.button("\xf0\x9f\x93\x8b History")'),
    (b'ui.button("\xc3\xa2\xc2\x9c\xc2\x9c Workflows")',
     b'ui.button("\xe2\x9a\x99 Workflows")'),
    (b'ui.button("\xc3\xb0\xc5\xb8\xe2\x80\x9c\xc6\x92 AI Assistant")',
     b'ui.button("\xf0\x9f\xa4\x96 AI Assistant")'),
    (b'if self.ai_recommendation_source == "ai" { "\xc3\xb0\xc5\xb8\xe2\x80\x9c\xc6\x92 AI" } else { "\xc3\xa2\xc2\x9c\xc2\x9c Heuristic" }',
     b'if self.ai_recommendation_source == "ai" { "\xf0\x9f\xa4\x96 AI" } else { "\xe2\x9a\x99 Heuristic" }'),
    (b'ui.label(egui::RichText::new("\xc3\xa2\xe2\x80\x94 Scanning")',
     b'ui.label(egui::RichText::new("\xe2\x97\x8f Scanning")'),
    (b'ui.label(egui::RichText::new("\xc3\xa2\xe2\x80\x94 Indexing embeddings")',
     b'ui.label(egui::RichText::new("\xe2\x97\x8f Indexing embeddings")'),
    (b'ui.label(egui::RichText::new("\xc3\xa2\xe2\x80\x94 Finding duplicates...")',
     b'ui.label(egui::RichText::new("\xe2\x97\x8f Finding duplicates...")'),
    # General box-drawing chars in section comments
    (b'// \xc3\xa2\xe2\x80\x94\xc3\xa2\xe2\x80\x94', b'// ----'),
]
fix_file('src/gui/dashboard.rs', dash_rs_replacements)

print("Fixing src/gui/history.rs...")
hist_rs_replacements = [
    (b'"\xc3\xa2\xe2\x80\xa0 Back to List"', b'"\xe2\x86\x90 Back to List"'),
]
fix_file('src/gui/history.rs', hist_rs_replacements)

print("Done.")
