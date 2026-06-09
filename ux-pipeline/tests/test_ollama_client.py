"""Tests for the stdlib-only Ollama HTTP client.

The tests build a tiny in-process HTTP server that speaks the Ollama
endpoints we exercise. We point :class:`OllamaClient` at that server using
``http://127.0.0.1:<port>`` and assert the client decodes responses
correctly, retries on transient failures, and surfaces a final
:class:`OllamaError` after exhausting retries.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import pytest

from ux_pipeline._ollama_client import OllamaClient, OllamaError


class _Recorder:
    """Shared mutable state used by the fake server + tests."""

    def __init__(self) -> None:
        self.requests: list[tuple[str, str, dict[str, Any] | None]] = []
        self.fail_n_times: int = 0
        self.response_status: int = 200
        self.response_body: bytes = b""


def _make_server(recorder: _Recorder) -> tuple[ThreadingHTTPServer, str]:
    """Spin up a localhost server that records all incoming requests."""

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
            pass

        def _read_body(self) -> bytes:
            length = int(self.headers.get("Content-Length") or 0)
            return self.rfile.read(length) if length else b""

        def _record(self, method: str, path: str, body: bytes) -> None:
            decoded: dict[str, Any] | None = None
            if body:
                try:
                    decoded = json.loads(body.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    decoded = None
            recorder.requests.append((method, path, decoded))

        def do_GET(self) -> None:  # noqa: N802
            self._record("GET", self.path, b"")
            if recorder.fail_n_times > 0:
                recorder.fail_n_times -= 1
                self.send_response(503)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"transient")
                return
            self.send_response(recorder.response_status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(recorder.response_body)

        def do_POST(self) -> None:  # noqa: N802
            body = self._read_body()
            self._record("POST", self.path, body)
            if recorder.fail_n_times > 0:
                recorder.fail_n_times -= 1
                self.send_response(503)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"transient")
                return
            self.send_response(recorder.response_status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(recorder.response_body)

        def do_DELETE(self) -> None:  # noqa: N802
            body = self._read_body()
            self._record("DELETE", self.path, body)
            self.send_response(recorder.response_status)
            self.send_header("Content-Length", "0")
            self.end_headers()

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    return server, f"http://{host}:{port}"


@pytest.fixture
def fake_server() -> Any:
    rec = _Recorder()
    server, base = _make_server(rec)
    try:
        yield rec, base
    finally:
        server.shutdown()
        server.server_close()


def test_list_models_unwraps_response(fake_server: Any) -> None:
    rec, base = fake_server
    rec.response_body = json.dumps(
        {"models": [{"name": "phi4-mini:latest", "size": 1024}]}
    ).encode("utf-8")
    client = OllamaClient(host=base, timeout=2.0, retries=0)
    models = client.list_models()
    assert models == [{"name": "phi4-mini:latest", "size": 1024}]
    assert rec.requests and rec.requests[0][0] == "GET"
    assert rec.requests[0][1] == "/api/tags"


def test_generate_posts_payload_and_returns_response(fake_server: Any) -> None:
    rec, base = fake_server
    rec.response_body = json.dumps({"response": "hello"}).encode("utf-8")
    client = OllamaClient(host=base, timeout=2.0, retries=0)
    out = client.generate("phi4-mini:latest", "ping", stream=False)
    assert out == "hello"
    method, path, body = rec.requests[0]
    assert method == "POST"
    assert path == "/api/generate"
    assert body == {"model": "phi4-mini:latest", "prompt": "ping", "stream": False}


def test_generate_with_options_and_images(fake_server: Any) -> None:
    rec, base = fake_server
    rec.response_body = json.dumps({"response": "ok"}).encode("utf-8")
    client = OllamaClient(host=base, timeout=2.0, retries=0)
    client.generate(
        "phi4-mini:latest",
        "x",
        options={"temperature": 0.1},
        images=[b"\x89PNG\r\n\x1a\nfake"],
    )
    _, _, body = rec.requests[0]
    assert body is not None
    assert body["options"] == {"temperature": 0.1}
    assert isinstance(body["images"], list) and len(body["images"]) == 1
    import base64

    assert base64.b64decode(body["images"][0]) == b"\x89PNG\r\n\x1a\nfake"


def test_retries_transient_failures_then_succeeds(fake_server: Any) -> None:
    rec, base = fake_server
    rec.fail_n_times = 2
    rec.response_body = json.dumps({"response": "yay"}).encode("utf-8")
    client = OllamaClient(host=base, timeout=2.0, retries=3)
    assert client.generate("m", "p") == "yay"
    assert len(rec.requests) == 3


def test_gives_up_after_retries(fake_server: Any) -> None:
    rec, base = fake_server
    rec.fail_n_times = 99
    rec.response_status = 503
    client = OllamaClient(host=base, timeout=2.0, retries=2)
    # ``list_models`` swallows errors and returns []; ``generate`` raises.
    assert client.list_models() == []
    with pytest.raises(OllamaError):
        client.generate("phi4-mini:latest", "ping")
    # list_models retries 2 times (3 total GETs) + generate retries 2 times (3 total POSTs) = 6
    assert len(rec.requests) == 6


def test_unreachable_host_returns_empty_list() -> None:
    client = OllamaClient(host="http://127.0.0.1:1", timeout=0.5, retries=0)
    assert client.list_models() == []
    assert client.pull("missing-model") is False
    assert client.delete("missing-model") is False


def test_host_strips_trailing_slash(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OLLAMA_HOST", raising=False)
    client = OllamaClient(host="http://example.com:11434/", timeout=0.1, retries=0)
    assert client.host == "http://example.com:11434"
    assert client._url("/api/tags") == "http://example.com:11434/api/tags"
