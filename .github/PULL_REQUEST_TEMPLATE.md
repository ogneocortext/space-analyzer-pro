## Description

Please describe your changes and the motivation behind them.

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Documentation / chore

## Scope checklist

- [ ] Rust changes build with `cargo build --workspace` and pass `cargo test --workspace` (and `cargo clippy`).
- [ ] WinUI 3 changes were built with **Visual Studio MSBuild** (not `dotnet build` — see AGENTS.md), and `dotnet test` passes.
- [ ] `gui-egui/` was **not** modified (comparison prototype, excluded from work).
- [ ] No workflow triggers / schedulers added (on hold per ARCHITECTURE_DECSISIONS.md §8).
- [ ] I did not commit build artifacts, logs, or gitignored runtime data.

## Related issues

Closes #
