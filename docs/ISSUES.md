# Issue Tracker Index

**Authoritative source**: `docs/issues.json` (JSON, schema v1)
**Legacy reference**: `docs/CONSOLIDATED_ISSUE_TRACKER.csv` (do not edit)

## Open issue counts (2026-06-08)

| Category | Open | Done |
|---|---|---|
| Total | 29 | 87 |
| Rust design issues (MAIN-021+) | 12 | 0 |

## Quick commands (copy-paste for agents)

```bash
# All open issues (~29 lines)
python docs/export_issues_to_csv.py --filter open

# Rust issues only
python docs/export_issues_to_csv.py --filter open --category architecture
python docs/export_issues_to_csv.py --filter open --category performance
python docs/export_issues_to_csv.py --filter open --category "code-quality"
python docs/export_issues_to_csv.py --filter open --category "error-handling"
python docs/export_issues_to_csv.py --filter open --category compatibility
python docs/export_issues_to_csv.py --filter open --category "build-&-deployment"
python docs/export_issues_to_csv.py --filter open --category functionality

# Direct JSON lookup (fastest, no CSV parsing)
python -c "import json; d=json.load(open('docs/issues.json')); [print(i['issue_id'], i['status'], i['title'][:80]) for i in d['issues'] if i['status']=='open']"

# Update after fixing (atomic write example)
python -c "
import json
from datetime import datetime, timezone
p='docs/issues.json'
d=json.load(open(p))
for i in d['issues']:
    if any(t=='id:MAIN-021' for t in i.get('tags',[])):
        i['status']='done'
        i['last_seen']=datetime.now(timezone.utc).isoformat(timespec='seconds')[:10]
        i.setdefault('extra',{})['resolution']='Fixed by decomposing SpaceAnalyzerApp into ScanState/AIState/WorkflowState'
d['updated_at']=datetime.now(timezone.utc).isoformat(timespec='seconds')
json.dump(d,open(p,'w',encoding='utf-8'),indent=2,sort_keys=True)
print('Updated')
"
```

## Issue ID format

- Stable IDs: `mainissuetracker:34af6f76922f` (SHA-based, stable across runs)
- Human-readable IDs: stored in `tags` as `id:MAIN-021`
- Never resolve to a different issue across tracker rewrites

## Workflow

1. User says "fix issues" or "fix MAIN-021"
2. Agent reads `docs/ISSUES.md` (this file, ~80 lines)
3. Agent runs export filter for relevant category
4. Agent matches by `id:MAIN-XXX` tag in `tags` array
5. Agent fixes code, updates status in `docs/issues.json`
6. Agent re-exports CSV: `python docs/export_issues_to_csv.py`

## Do NOT use

- `docs/CONSOLIDATED_ISSUE_TRACKER.csv` as source of truth (legacy)
- Guessing file locations or searching randomly
- Creating new issue tracking files
