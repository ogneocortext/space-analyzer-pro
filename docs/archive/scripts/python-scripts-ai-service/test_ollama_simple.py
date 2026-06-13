#!/usr/bin/env python3
"""Simple test to verify Ollama client works."""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "ai-service"))

from ollama_client import OllamaClient

print("Testing Ollama client...")
client = OllamaClient(base_url="http://localhost:11434", default_model="qwen2.5-coder:7b-instruct")

print(f"Checking server...")
if client.check_server():
    print("Server available")
else:
    print("Server not available")
    sys.exit(1)

print(f"Testing generation...")
response = client.generate("Say hello in one word.", model="qwen2.5-coder:7b-instruct")
print(f"Success: {response.success}")
print(f"Response: {response.response}")
print(f"Error: {response.error}")
print(f"Tokens/sec: {response.tokens_per_second}")
