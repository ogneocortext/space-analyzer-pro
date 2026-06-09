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
from typing import Any, Iterable

logger = logging.getLogger("ux_pipeline.ollama_client")

DEFAULT_HOST: str = "http://localhost:11434"
DEFAULT_TIMEOUT_S: float = 30.0
DEFAULT_RETRIES: int = 2
USER_AGENT: str = "ux-pipeline/0.1 (+https://github.com/ogneocortext/space-analyzer-pro)"


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
        self.host: str = (host or os.getenv("OLLAMA_HOST") or DEFAULT_HOST).rstrip("/")
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
        options: dict[str, Any] | None = None,
        images: Iterable[bytes] | None = None,
    ) -> str:
        """Call ``/api/generate`` and return the concatenated response text.

        Args:
            model: Ollama model name (e.g. ``phi4-mini:latest``).
            prompt: Prompt text.
            stream: When ``True``, the server streams NDJSON chunks. We always
                aggregate them and return a single string.
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
        if options:
            body["options"] = dict(options)
        if images:
            import base64

            body["images"] = [base64.b64encode(img).decode("ascii") for img in images]

        try:
            payload = self._request_json("POST", "/api/generate", json_body=body)
        except OllamaError as exc:
            raise OllamaError(f"generate({model!r}) failed: {exc}") from exc
        return str(payload.get("response", ""))

    def pull(self, model: str) -> bool:
        """Trigger ``/api/pull`` for ``model``."""
        try:
            self._request_json("POST", "/api/pull", json_body={"name": model, "stream": False})
        except OllamaError as exc:
            logger.debug("pull(%s) failed: %s", model, exc)
            return False
        return True

    def delete(self, model: str) -> bool:
        """Trigger ``DELETE /api/delete`` for ``model``."""
        try:
            self._request("DELETE", "/api/delete", json_body={"name": model})
        except OllamaError as exc:
            logger.debug("delete(%s) failed: %s", model, exc)
            return False
        return True


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
        """Issue ``_request`` with retry/backoff and JSON-decode the body."""
        attempts = self.retries + 1
        last_exc: OllamaError | None = None
        for attempt in range(1, attempts + 1):
            try:
                status, body, _ = self._request(method, path, json_body=json_body)
            except OllamaError as exc:
                last_exc = exc
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
