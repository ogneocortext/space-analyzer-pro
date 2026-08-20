"""Minimal stdlib-only HTTP client for the Ollama REST API.

The original ``scripts/utility/_ollama_client.py`` was a thin wrapper around
``requests``. To make the package installable with zero third-party
dependencies, this re-implementation uses only :mod:`urllib` and :mod:`json`.

The shape of the public surface (``list_models``, ``generate``, ``pull``,
``delete``) matches the previous client closely enough that the legacy scripts
keep working through the compatibility shim.
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Iterable

logger = logging.getLogger("ux_pipeline.ollama_client")

DEFAULT_HOST: str = "http://localhost:11434"
DEFAULT_TIMEOUT_S: float = 180.0
DEFAULT_RETRIES: int = 2
USER_AGENT: str = "ux-pipeline/0.1 (+https://github.com/ogneocortext/space-analyzer-pro)"

# Policy: models may only be pulled on an explicit user request, and only when the
# system (boot) disk has comfortable free space. This guards against accidental or
# automatic pulls that would fill the C: drive. The pull() method refuses otherwise.
MIN_C_FREE_GB_FOR_PULL: float = 40.0
_PULL_SYSTEM_DISK: str = "C:\\"


def _c_drive_free_gb() -> float:
    """Return free space (GB) on the system disk, or inf if it cannot be queried."""
    try:
        import shutil

        _, _, free = shutil.disk_usage(_PULL_SYSTEM_DISK)
        return free / (1024 ** 3)
    except Exception:  # pragma: no cover - defensive
        return float("inf")


class OllamaError(RuntimeError):
    """Raised when an Ollama HTTP call fails after all retries."""


class OllamaClient:
    """Tiny HTTP client for the Ollama REST API.

    Args:
        host: Base URL such as ``http://localhost:11434``. Falls back to the
            ``OLLAMA_HOST`` environment variable.
        timeout: Per-request timeout in seconds.
        retries: Number of additional attempts on transport errors. The first
            attempt is not counted, so ``retries=2`` means up to three tries.
    """

    def __init__(
        self,
        host: str | None = None,
        timeout: float = DEFAULT_TIMEOUT_S,
        retries: int = DEFAULT_RETRIES,
    ) -> None:
        raw_host = host or os.getenv("OLLAMA_HOST") or DEFAULT_HOST
        if not raw_host.startswith(("http://", "https://")):
            raw_host = "http://" + raw_host
        if "://" in raw_host and not raw_host.split("://", 1)[1].split("/")[0].count(":"):
            raw_host = raw_host.rstrip("/") + ":11434"
        self.host: str = raw_host.rstrip("/")
        self.timeout: float = float(timeout)
        self.retries: int = max(0, int(retries))

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def list_models(self) -> list[dict[str, Any]]:
        """Return ``/api/tags`` payload (one entry per installed model).

        The Ollama API returns ``{"models": [...]}``; we unwrap that here so
        callers receive the bare list of model dicts.

        Returns:
            List of model entries. Empty list on error (errors are logged
            at debug level so the package remains usable without a live
            Ollama instance).
        """
        try:
            payload = self._request_json("GET", "/api/tags")
        except OllamaError as exc:
            logger.debug("list_models failed: %s", exc)
            return []
        models = payload.get("models", [])
        return list(models) if isinstance(models, list) else []

    def generate(
        self,
        model: str,
        prompt: str,
        *,
        stream: bool = False,
        think: bool | None = None,
        format: str | None = None,
        options: dict[str, Any] | None = None,
        images: Iterable[bytes] | None = None,
        system: str | None = None,
        keep_alive: "float | str | None" = None,
    ) -> str:
        """Call ``/api/generate`` and return the concatenated response text.

        Args:
            model: Ollama model name (e.g. ``qwen3-vl:2b``).
            prompt: Prompt text.
            stream: When ``True``, the server streams NDJSON chunks. We always
                aggregate them and return a single string.
            think: Set to ``False`` to disable thinking/reasoning mode for
                models that support it (e.g. Qwen3). ``None`` uses the
                model default.
            format: Response format constraint, e.g. ``"json"`` to force
                valid JSON output.
            options: Generation options (temperature, num_predict, ...).
            images: Optional iterable of raw image bytes (base64 encoded
                before being sent).

        Returns:
            The model's response text.

        Raises:
            OllamaError: If the request fails after all retries.
        """
        body: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": bool(stream),
        }
        if think is not None:
            body["think"] = bool(think)
        if format is not None:
            body["format"] = format
        if options:
            body["options"] = dict(options)
        if system:
            body["system"] = system
        if images:
            import base64

            body["images"] = [base64.b64encode(img).decode("ascii") for img in images]
        if keep_alive is not None:
            body["keep_alive"] = keep_alive

        try:
            payload = self._request_json("POST", "/api/generate", json_body=body)
        except OllamaError as exc:
            raise OllamaError(f"generate({model!r}) failed: {exc}") from exc
        response = str(payload.get("response", ""))
        if not response:
            response = str(payload.get("thinking", ""))
        return response

    def stream_generate(
        self,
        model: str,
        prompt: str,
        *,
        think: bool | None = None,
        format: str | dict[str, Any] | None = None,
        options: dict[str, Any] | None = None,
        images: Iterable[bytes] | None = None,
        system: str | None = None,
        on_chunk: "Callable[[str], None] | None" = None,
    ) -> str:
        """Stream ``/api/generate`` NDJSON, invoking ``on_chunk`` per text piece.

        Returns the full concatenated response text so callers can parse it
        exactly like :meth:`generate`. Network errors raise ``OllamaError``;
        a stream cut short still returns whatever text was accumulated.
        """
        import base64

        body: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": True,
        }
        if think is not None:
            body["think"] = bool(think)
        if format is not None:
            body["format"] = format
        if options:
            body["options"] = dict(options)
        if system:
            body["system"] = system
        if images:
            body["images"] = [base64.b64encode(img).decode("ascii") for img in images]

        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            self._url("/api/generate"),
            data=data,
            headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"},
            method="POST",
        )
        pieces: list[str] = []
        thinking_pieces: list[str] = []
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                for raw in resp:
                    raw = raw.strip()
                    if not raw:
                        continue
                    try:
                        obj = json.loads(raw)
                    except (ValueError, json.JSONDecodeError):
                        continue
                    # qwen3-vl streams reasoning into "thinking" (even with
                    # think=False) and only fills "response" at the end, so we
                    # surface whichever field carries text for live visibility.
                    piece = str(obj.get("response", "")) or str(obj.get("thinking", ""))
                    if obj.get("response", ""):
                        pieces.append(str(obj.get("response", "")))
                    elif obj.get("thinking", ""):
                        thinking_pieces.append(str(obj.get("thinking", "")))
                    if piece and on_chunk is not None:
                        on_chunk(piece)
                    if obj.get("done"):
                        break
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
            raise OllamaError(f"stream_generate({model!r}) failed: {exc}") from exc
        return "".join(pieces) or "".join(thinking_pieces)

    def generate_json(
        self,
        model: str,
        prompt: str,
        schema: dict[str, Any],
        *,
        stream: bool = False,
        think: bool | None = False,
        options: dict[str, Any] | None = None,
        images: Iterable[bytes] | None = None,
    ) -> str:
        """Call ``/api/generate`` with a JSON schema constraint.

        Returns the model's response text, which should be valid JSON
        conforming to ``schema``.
        """
        body: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": bool(stream),
            "format": schema,
        }
        if think is not None:
            body["think"] = bool(think)
        if options:
            body["options"] = dict(options)
        if images:
            import base64

            body["images"] = [base64.b64encode(img).decode("ascii") for img in images]

        try:
            payload = self._request_json("POST", "/api/generate", json_body=body)
        except OllamaError as exc:
            raise OllamaError(f"generate_json({model!r}) failed: {exc}") from exc
        response = str(payload.get("response", ""))
        if not response:
            response = str(payload.get("thinking", ""))
        return response

    def chat(
        self,
        model: str,
        messages: list[dict[str, Any]],
        *,
        stream: bool = False,
        think: bool | None = None,
        format: str | dict[str, Any] | None = None,
        options: dict[str, Any] | None = None,
        keep_alive: "float | str | None" = None,
    ) -> str:
        """Call ``/api/chat`` and return the assistant's response text.

        Args:
            model: Ollama model name (e.g. ``qwen3-vl:2b``).
            messages: Chat history. Each dict must have ``role`` and
                ``content``. For multimodal models, add an ``images`` key
                with a list of base64-encoded image strings.
            stream: When ``True``, the server streams NDJSON chunks; we
                aggregate them and return a single string.
            think: Set to ``False`` to disable thinking/reasoning mode
                for models that support it (e.g. Qwen3, DeepSeek-R1).
            format: Response format constraint, e.g. ``"json"`` to force
                valid JSON output.
            options: Generation options (temperature, num_predict, ...).
            keep_alive: How long to keep the model resident in VRAM after the
                call (seconds, or a string like ``"5m"``/``"0"``). Pass
                ``0`` to evict immediately; useful for freeing VRAM before
                loading a different model.

        Returns:
            The assistant's response text.

        Raises:
            OllamaError: If the request fails after all retries.
        """
        body: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": bool(stream),
        }
        if think is not None:
            body["think"] = bool(think)
        if format is not None:
            body["format"] = format
        if options:
            body["options"] = dict(options)
        if keep_alive is not None:
            body["keep_alive"] = keep_alive

        try:
            payload = self._request_json("POST", "/api/chat", json_body=body)
        except OllamaError as exc:
            raise OllamaError(f"chat({model!r}) failed: {exc}") from exc
        msg = payload.get("message", {})
        if isinstance(msg, dict):
            text = msg.get("content", "")
            if not text:
                text = str(msg.get("thinking", ""))
            if text:
                return str(text)
        return str(payload.get("response", ""))

    def chat_with_tools(
        self,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        *,
        think: bool | None = False,
        format: str | dict[str, Any] | None = None,
        options: dict[str, Any] | None = None,
        tool_choice: str | dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Call ``/api/chat`` with a tool schema and return the assistant message.

        Unlike :meth:`chat` (which flattens the reply to text), this returns the
        raw ``message`` object so callers can inspect ``tool_calls`` and feed the
        results back as ``role: "tool"`` messages for a multi-turn agent loop.

        Args:
            model: Ollama model name.
            messages: Chat history (``role``/``content``; tool results carry a
                ``name`` and ``role == "tool"``).
            tools: OpenAI-style tool list, each
                ``{"type": "function", "function": {name, description, parameters}}``.
            think: Disable reasoning mode (recommended for agents so the reply
                stays terse and the tool calls are easy to parse).
            format: Optional JSON-schema / format constraint.
            options: Generation options.
            tool_choice: ``"auto"`` (default), ``"none"``, or a forced function.

        Returns:
            The assistant ``message`` dict, e.g.
            ``{"role": "assistant", "content": "...", "tool_calls": [...]}``.
            ``tool_calls`` is present (and non-empty) only when the model decided
            to invoke one or more tools.

        Raises:
            OllamaError: If the request fails after all retries.
        """
        body: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": False,
            "tools": tools,
        }
        if think is not None:
            body["think"] = bool(think)
        if format is not None:
            body["format"] = format
        if options:
            body["options"] = dict(options)
        if tool_choice is not None:
            body["tool_choice"] = tool_choice

        try:
            payload = self._request_json("POST", "/api/chat", json_body=body)
        except OllamaError as exc:
            raise OllamaError(f"chat_with_tools({model!r}) failed: {exc}") from exc
        msg = payload.get("message", {})
        if isinstance(msg, dict):
            # Ollama reports token/timing telemetry at the *top level* of the
            # /api/chat payload (siblings of ``message``), not inside it. Surface
            # those as a ``usage`` block so agent loops can record GenAI-style
            # signals (prompt/completion tokens, durations, finish reason) —
            # the basis of the dashboard's live execution trace.
            meta: dict[str, Any] = {}
            for key in (
                "prompt_eval_count", "eval_count", "total_duration",
                "prompt_eval_duration", "eval_duration", "load_duration",
                "done_reason",
            ):
                if key in payload:
                    meta[key] = payload[key]
            if meta:
                msg = dict(msg)
                msg["usage"] = meta
            return msg
        return {"role": "assistant", "content": str(payload.get("response", ""))}

    def pull(self, model: str, *, allow_auto: bool = False) -> bool:
        """Trigger ``/api/pull`` for ``model`` (explicit user request only).

        Automatic pulls are disabled by policy. Callers must pass
        ``allow_auto=True`` to acknowledge an explicit user request, and the
        system (C:) disk must have at least ``MIN_C_FREE_GB_FOR_PULL`` GB free,
        otherwise the pull is refused with an ``OllamaError``.

        Raises:
            OllamaError: If the pull is refused by policy or the disk is too full.
        """
        if not allow_auto:
            raise OllamaError(
                f"pull({model!r}) refused: automatic pulls are disabled by policy. "
                f"Pull only on an explicit user request."
            )
        free_gb = _c_drive_free_gb()
        if free_gb < MIN_C_FREE_GB_FOR_PULL:
            raise OllamaError(
                f"pull({model!r}) refused: C: drive has only {free_gb:.1f} GB free "
                f"(< {MIN_C_FREE_GB_FOR_PULL:.0f} GB required). Free disk space "
                f"before pulling models."
            )
        try:
            self._request_json("POST", "/api/pull", json_body={"model": model, "stream": False})
        except OllamaError as exc:
            logger.debug("pull(%s) failed: %s", model, exc)
            return False
        return True

    def delete(self, model: str) -> bool:
        """Trigger ``DELETE /api/delete`` for ``model``."""
        try:
            self._request("DELETE", "/api/delete", json_body={"model": model})
        except OllamaError as exc:
            logger.debug("delete(%s) failed: %s", model, exc)
            return False
        return True

    def ps(self) -> dict[str, Any]:
        """Return ``/api/ps`` payload: models currently loaded into VRAM.

        The payload is ``{"models": [{"name", "size", "size_vram", "details",
        "expires_at", ...}]}``. Returns ``{}`` on error (logged at debug level)
        so callers can render an empty "no models running" state gracefully.
        """
        try:
            return self._request_json("GET", "/api/ps")
        except OllamaError as exc:
            logger.debug("ps failed: %s", exc)
            return {}


    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    def _url(self, path: str) -> str:
        if not path.startswith("/"):
            path = "/" + path
        return f"{self.host}{path}"

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
    ) -> tuple[int, bytes, dict[str, str]]:
        """Perform a single HTTP request with no retry logic.

        Returns:
            ``(status, body_bytes, headers)`` tuple.

        Raises:
            OllamaError: On transport or decoding errors.
        """
        data: bytes | None = None
        headers: dict[str, str] = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }
        if json_body is not None:
            data = json.dumps(json_body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(
            self._url(path),
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.status, resp.read(), dict(resp.headers)
        except urllib.error.HTTPError as exc:
            body = exc.read() if hasattr(exc, "read") else b""
            raise OllamaError(
                f"HTTP {exc.code} {exc.reason} for {method} {path}: {body[:200]!r}"
            ) from exc
        except urllib.error.URLError as exc:
            raise OllamaError(f"URLError for {method} {path}: {exc.reason}") from exc
        except (TimeoutError, OSError) as exc:
            raise OllamaError(f"{type(exc).__name__} for {method} {path}: {exc}") from exc

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Issue ``_request`` with retry/backoff and JSON-decode the body.

        Retries transport-level failures and transient HTTP statuses
        (408, 429, 500, 502, 503, 504). Client HTTP errors fail immediately.
        """
        attempts = self.retries + 1
        last_exc: OllamaError | None = None
        for attempt in range(1, attempts + 1):
            try:
                status, body, _ = self._request(method, path, json_body=json_body)
            except OllamaError as exc:
                last_exc = exc
                if not self._should_retry_ollama_error(exc):
                    raise
                if attempt >= attempts:
                    raise
                backoff = min(2.0 ** (attempt - 1), 8.0)
                logger.debug(
                    "%s %s attempt %d/%d failed: %s; sleeping %.2fs",
                    method, path, attempt, attempts, exc, backoff,
                )
                time.sleep(backoff)
                continue
            if status >= 400:
                raise OllamaError(f"HTTP {status} for {method} {path}: {body[:200]!r}")
            if not body:
                return {}
            try:
                decoded = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise OllamaError(f"Non-JSON response from {method} {path}") from exc
            if not isinstance(decoded, dict):
                # Some endpoints occasionally return lists directly.
                return {"_": decoded}
            return decoded
        if last_exc is not None:
            raise last_exc
        raise OllamaError(f"unreachable: {method} {path}")

    def _should_retry_ollama_error(self, exc: OllamaError) -> bool:
        msg = str(exc)
        retryable_http = any(f"HTTP {status}" in msg for status in (408, 429, 500, 502, 503, 504))
        retryable_transport = any(token in msg for token in ("URLError", "TimeoutError", "OSError"))
        return retryable_http or retryable_transport
