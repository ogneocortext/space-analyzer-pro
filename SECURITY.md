# Security Policy

## Supported Versions

The latest release of Space Analyzer Pro is supported with security fixes.
See [CHANGELOG.md](docs/CHANGELOG.md) for the current version.

| Version | Supported |
|---------|-----------|
| Latest release (WinUI 3 frontend `v4.0.0` / Rust core `v3.7.0`) | ✅ |
| Older releases | ❌ |

## Reporting a Vulnerability

Space Analyzer Pro is a **local-first** desktop application: it runs entirely on
your machine, performs no network calls except to an **optional, user-configured
local Ollama instance**, and collects no telemetry.

If you discover a security issue (e.g. unsafe subprocess handling, path
traversal in scan targets, or unintended network exposure), please report it
**privately** rather than opening a public issue:

- Open a private security advisory on GitHub, **or**
- Email the maintainer directly (do not paste exploits in public issues).

Please include:

- A clear description of the vulnerability and impact
- Steps to reproduce (or a minimal PoC)
- Affected version(s) and platform (Windows build / .NET / Rust versions)

You will receive an acknowledgement, and we will coordinate a fix and disclosure
timeline with you. We ask that you give us a reasonable window to release a patch
before any public disclosure.

## Security Model

- **No telemetry, no cloud dependencies.** The desktop app does not phone home.
- **Optional local AI.** The Ollama integration talks only to the endpoint you
  configure (default `http://localhost:11434`). It never sends data off-device
  unless you point it at a remote Ollama.
- **Subprocess isolation.** The GUI invokes the Rust scanner CLI as a child
  process with `UseShellExecute = false`, argument lists (no shell injection),
  and `CreateNoWindow = true`; scans are cancelled by killing the process tree.
- **Local persistence.** Scan history and settings are stored in an embedded
  SQLite database under the app's local data directory.

See [docs/archive/reports/SECURITY.md](docs/archive/reports/SECURITY.md) for the
original design-time security notes.
