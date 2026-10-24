# Git Configuration Guide

This document covers the Git configuration applied to this environment and how to use each setting effectively.

## Global Git Config

These settings are applied via `git config --global` and affect all repositories on this machine:

```ini
[credential]
    helper = manager
[core]
    editor = code --wait
    autocrlf = false
    safecrlf = warn
    longpaths = true
    ignorecase = false
    quotepath = false
    excludesfile = C:/Users/Aomega Imaging/.gitignore_global
[init]
    defaultBranch = main
[pull]
    rebase = true
[merge]
    ff = only
    conflictStyle = diff3
    tool = vscode
[fetch]
    prune = true
    negotiationAlgorithm = skipping
[push]
    default = current
[rebase]
    autostash = true
    autosquash = true
[advice]
    detachedHead = false
```

## Credential Management

### `credential.helper = manager`

Uses **Git Credential Manager (GCM)** — the Windows-native credential helper.

- **Stores credentials in Windows Credential Locker** (encrypted via DPAPI), not plaintext
- **No more popups** after the first authenticated push/pull per session
- **More secure than `store`** — no `~/.git-credentials` plaintext file
- **Automatic token refresh** for GitHub, Azure DevOps, and other providers that support it

### What was removed

The previous `credential.helper=store` wrote credentials to `~/.git-credentials` in plaintext. That file has been deleted and GCM is now the sole credential helper.

### First use after switching

The first `git push` will prompt once via GCM's native Windows dialog. After that, credentials are cached securely.

## Key Behavior Changes

| Setting | Behavior | Why it matters |
|---------|----------|----------------|
| `push.default = current` | Only pushes the current branch | Safer than `matching` — won't accidentally push unrelated branches |
| `rebase.autosquash = true` | Auto-squashes `fixup!`/`squash!` commits during `rebase -i` | Great for iterative cleanup — mark commits with `git commit --fixup=<commit>` then `git rebase -i --autosquash <base>` |
| `fetch.negotiationAlgorithm = skipping` | Skips already-known commits during fetch negotiation | Faster fetches on repos with long history |
| `advice.detachedHead = false` | Silences the "detached HEAD" warning | Less noise when checking out old commits to inspect historical state |
| `rebase.autostash = true` | Automatically stashes uncommitted changes before rebase | Prevents "cannot rebase: you have unstaged changes" errors |
| `pull.rebase = true` | `git pull` rebases instead of merging | Cleaner linear history — no merge bubbles from `pull` |
| `merge.ff = only` | `git merge` only does fast-forwards | Prevents accidental merge commits; forces rebase-based workflow |
| `core.excludesfile` | Global `.gitignore` at `~/.gitignore_global` | OS-specific files (`.DS_Store`, `Thumbs.db`, `desktop.ini`) ignored in every repo |

## Global `.gitignore` (~/.gitignore_global)

```
.DS_Store
Thumbs.db
*.log
*.tmp
.vscode/
*.swp
*~
$RECYCLE.BIN/
desktop.ini
```

Applies to all Git repositories on this machine. Repo-specific ignores still belong in each repo's `.gitignore`.

## Useful Git 2.56 Commands

### Partial clone (recommended for new clones)

```powershell
# Only download file contents on demand, not upfront
git clone --filter=blob:none https://github.com/ogneocortext/space-analyzer-pro.git
```

This is useful if the repository accumulates large binary assets over time — blobs are fetched only when needed (checkout, grep, etc.).

### Fixup commits + autosquash

```powershell
# Mark a commit as a fixup for an earlier commit
git commit --fixup=<commit-hash>

# Fold all fixup commits into their targets during interactive rebase
git rebase -i --autosquash <base-commit>
```

### Rebase onto a ref without checking it out

```powershell
git rebase --ref=<branch-or-tag>
```

### Truncated log output

```powershell
git log --format="%H %<(15,trunc)%s"
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Push still prompts after first use | Run `git credential approve` once to prime the cache, or check GCM is installed (`git cred-manager --version`) |
| `git pull` creates merge commits | This is expected with `pull.rebase=true` — if you want merge behavior, use `git pull --no-rebase` |
| Detached HEAD warning still appears | `advice.detachedHead=false` is set; if it still shows, run `git config --global --get advice.detachedHead` to verify |
| `git rebase` complains about unstaged changes | `rebase.autostash=true` handles this automatically — stash is restored after rebase completes |

## Files Modified

- `~/.gitconfig` — Global Git configuration (not in repo)
- `~/.gitignore_global` — Global ignore patterns (not in repo)
- No repository files were modified by this configuration change
