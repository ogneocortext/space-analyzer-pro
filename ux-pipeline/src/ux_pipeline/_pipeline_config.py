"""Environment-driven configuration for the UX pipeline.

Centralizing all knobs in one dataclass means a single ``load_config()`` call
gives the CLI / dashboard / library user a complete snapshot of the runtime
config. Anything that should be tunable without editing source lives here.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ENV_PREFIX: str = "UX_PIPELINE_"


def _env(name: str, default: str | None = None) -> str | None:
    """Read ``UX_PIPELINE_<NAME>`` from the environment, with optional default."""
    return os.getenv(ENV_PREFIX + name, default)


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = _env(name)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = _env(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on", "y", "t"}


def _env_path(name: str, default: Path) -> Path:
    raw = _env(name)
    return Path(raw) if raw else default


@dataclass
class PipelineConfig:
    """Runtime configuration for the UX pipeline.

    Attributes are populated from environment variables on
    :func:`load_config`. Constructing the dataclass directly is also
    supported (useful for tests).
    """

    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "phi4-mini:latest"
    ollama_timeout_s: int = 120
    ollama_retries: int = 2
    tracker_path: Path = field(default_factory=lambda: _default_tracker_path())
    screenshots_root: Path = field(default_factory=lambda: Path("macro_logs"))
    history_dir: Path = field(default_factory=lambda: Path("analysis_history"))
    quality_history_path: Path = field(default_factory=lambda: Path("analysis_history") / "quality.jsonl")
    dashboard_host: str = "127.0.0.1"
    dashboard_port: int = 8765
    dashboard_enabled: bool = False
    enable_gpu: bool = False
    extra: dict[str, Any] = field(default_factory=dict)

    # ------------------------------------------------------------------ #
    # Serialization
    # ------------------------------------------------------------------ #
    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable view of this config."""
        return {
            "ollama_host": self.ollama_host,
            "ollama_model": self.ollama_model,
            "ollama_timeout_s": self.ollama_timeout_s,
            "ollama_retries": self.ollama_retries,
            "tracker_path": str(self.tracker_path),
            "screenshots_root": str(self.screenshots_root),
            "history_dir": str(self.history_dir),
            "quality_history_path": str(self.quality_history_path),
            "dashboard_host": self.dashboard_host,
            "dashboard_port": self.dashboard_port,
            "dashboard_enabled": self.dashboard_enabled,
            "enable_gpu": self.enable_gpu,
            "extra": dict(self.extra),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PipelineConfig":
        """Build a config from a dict (CLI / file override helper)."""
        path_fields = {"tracker_path", "screenshots_root", "history_dir", "quality_history_path"}
        kwargs: dict[str, Any] = {}
        for f in cls.__dataclass_fields__:  # type: ignore[attr-defined]
            if f not in data:
                continue
            value = data[f]
            if f in path_fields:
                kwargs[f] = Path(value)
            else:
                kwargs[f] = value
        return cls(**kwargs)


def _default_tracker_path() -> Path:
    """Return ``docs/issues.json`` when present and valid, else ``ux_issues.json``."""
    docs_tracker = Path("docs") / "issues.json"
    if docs_tracker.exists():
        try:
            import json
            data = json.loads(docs_tracker.read_text(encoding="utf-8"))
            if isinstance(data, dict) and data.get("schema_version") == 1 and "issues" in data:
                return docs_tracker
        except Exception:
            pass
    return Path("ux_issues.json")


def load_config() -> PipelineConfig:
    """Read configuration from ``UX_PIPELINE_*`` environment variables.

    Unset variables fall back to the dataclass defaults. Unknown variables
    are ignored silently. This function never raises; a malformed value
    simply reverts to the default.
    """
    return PipelineConfig(
        ollama_host=_env("OLLAMA_HOST", "http://localhost:11434") or "http://localhost:11434",
        ollama_model=_env("MODEL", "phi4-mini:latest") or "phi4-mini:latest",
        ollama_timeout_s=_env_int("OLLAMA_TIMEOUT_S", 120),
        ollama_retries=_env_int("OLLAMA_RETRIES", 2),
        tracker_path=_env_path("TRACKER_PATH", _default_tracker_path()),
        screenshots_root=_env_path("SHOTS_ROOT", Path("macro_logs")),
        history_dir=_env_path("HISTORY_DIR", Path("analysis_history")),
        quality_history_path=_env_path(
            "QUALITY_HISTORY", Path("analysis_history") / "quality.jsonl"
        ),
        dashboard_host=_env("DASHBOARD_HOST", "127.0.0.1") or "127.0.0.1",
        dashboard_port=_env_int("DASHBOARD_PORT", 8765),
        dashboard_enabled=_env_bool("DASHBOARD_ENABLED", False),
        enable_gpu=_env_bool("ENABLE_GPU", False),
    )
