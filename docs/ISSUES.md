# Issue Tracker Index

**Authoritative source**: `docs/issues.json` (JSON, schema v1)
**Legacy reference**: `docs/CONSOLIDATED_ISSUE_TRACKER.csv` (do not edit)

<!--ISSUE_COUNTS_START-->
## Open issue counts (2026-08-11)

| Scope | Count |
|---|---|
| Open | 29 |
| Done | 176 |
| Wontfix | 3 |
| Blocked | 1 |
| **Total** | **209** |

**Open by category:** `layout` 11, `ui` 11, `color` 5, `ux` 2. All 29 open issues are UI/UX
polish — there are **no open issues** for backend, scanning, AI, settings, or workflow
features.
<!--ISSUE_COUNTS_END-->

## Quick commands (copy-paste for agents)

```bash
# All open issues (no external script needed — issues.json is the source of truth)
python -c "import json; d=json.load(open('docs/issues.json')); [print(i['issue_id'], i['category'], i['severity'], i['title'][:70]) for i in d['issues'] if i.get('status')=='open']"

# Filter open issues by category (e.g. ui, layout, color, ux, winui, bug, cli, ...)
python -c "import json; d=json.load(open('docs/issues.json')); [print(i['issue_id'], i['title'][:70]) for i in d['issues'] if i.get('status')=='open' and i.get('category')=='ui']"

# One issue by id
python -c "import json; d=json.load(open('docs/issues.json')); print(next(i for i in d['issues'] if i['issue_id']=='ui:0429840e8c06'))"

# Update after fixing (match by issue_id, not by tag)
python -c "
import json
from datetime import datetime, timezone
p='docs/issues.json'
d=json.load(open(p, encoding='utf-8'))
for i in d['issues']:
    if i['issue_id']=='ui:0429840e8c06':
        i['status']='done'
        i['last_seen']=datetime.now(timezone.utc).isoformat(timespec='seconds')
        i.setdefault('extra', {})['resolution']='<what you changed and why>'
d['updated_at']=datetime.now(timezone.utc).isoformat(timespec='seconds')
json.dump(d, open(p, 'w', encoding='utf-8'), indent=2, sort_keys=True)
print('Updated')
"
```

## Issue ID format

- IDs are stable and SHA-derived: `<source>:<sha12>` (e.g. `winui:c4d7b1e9a2f0`,
  `cli:bfe36370ffbb`, `mainissuetracker:34af6f76922f`). The `<source>` prefix reflects
  where the issue was captured (winui, cli, rust, ui, layout, color, ux, bug,
  functionalityissues, agentic-audit, …).
- Plain lowercase `tags` (e.g. `bug`, `ux`, `ai-agent`) are for filtering only — they are
  **not** stable IDs.
- Never reuse or renumber an ID across tracker rewrites. Match issues by `issue_id`, not by
  position or title.

## Cross-references (issues ↔ gap analysis ↔ decisions)

- `issues.json` entries may carry a `references` array of strings linking them to other
  docs, e.g. `"references": ["FEATURE_GAP:7.1", "DECISION:8", "CHANGELOG:unreleased"]`.
  - `FEATURE_GAP:<section>.<num>` → a row in `FEATURE_GAP_ANALYSIS.md`.
  - `DECISION:<n>` → a section in `ARCHITECTURE_DECISIONS.md` (§8 = workflow on-hold).
  - `CHANGELOG:<version>` → a section in `CHANGELOG.md`.
- `FEATURE_GAP_ANALYSIS.md` open items and `CHANGELOG.md` entries carry matching `Linked:` /
  `Refs:` lines so the link is traceable from both sides.
- Example: settings issues `winui:fe507e3c40c1`, `winui:d298efe84fdf`, `winui:eb8c373c5470`
  reference `FEATURE_GAP:7.1` (Settings) and `DECISION:8`.

## Workflow

1. User says "fix issues" or "fix `<issue_id>`" (e.g. `fix ui:0429840e8c06`).
2. Agent reads `docs/ISSUES.md` (this file) for schema + cross-reference conventions.
3. Agent locates the issue by `issue_id` using the JSON lookup in "Quick commands".
4. Agent fixes code, then updates `status` / `last_seen` / `extra.resolution` in `docs/issues.json`
   (use the update snippet in "Quick commands"; match by `issue_id`).

## Do NOT use

- `docs/CONSOLIDATED_ISSUE_TRACKER.csv` as source of truth (legacy)
- Guessing file locations or searching randomly
- Creating new issue tracking files
