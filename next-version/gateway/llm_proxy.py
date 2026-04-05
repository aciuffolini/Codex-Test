"""LLM Proxy — streams chat completions from OpenAI or Anthropic.

Absorbed from 7_farm_visit/apps/web/test-server.js, rewritten in async Python
for the FastAPI gateway.  The frontend sends the user's API key via
``X-API-Key`` and provider via ``X-Provider`` headers — the gateway never
stores keys.
"""
from __future__ import annotations

import json
from typing import Any, AsyncIterator, Dict, List

import httpx

SYSTEM_PROMPT = (
    "You are a helpful agricultural field visit assistant. You help farmers "
    "and agricultural professionals with:\n\n"
    "• Field visit data capture and organization\n"
    "• Crop identification and management advice\n"
    "• Pest and disease detection and treatment recommendations\n"
    "• Agricultural best practices and field management\n"
    "• GPS location-based agricultural insights\n\n"
    "Be concise, practical, and provide actionable advice. Use the visit "
    "context provided (GPS location, notes, photos, audio recordings, saved "
    "visit records) to give specific, relevant responses.\n\n"
    "Respond in a friendly, professional manner suitable for field work."
)


async def stream_chat(
    messages: List[Dict[str, Any]],
    api_key: str,
    provider: str = "openai",
    model: str | None = None,
) -> AsyncIterator[str]:
    """Yield SSE ``data: ...`` frames from the upstream LLM provider.

    All frames are normalised to the OpenAI-compatible format the frontend
    expects::

        data: {"choices":[{"delta":{"content":"token"}}]}
        ...
        data: [DONE]
    """
    if provider == "claude-code":
        async for frame in _stream_anthropic(messages, api_key, model):
            yield frame
    else:
        async for frame in _stream_openai(messages, api_key, model):
            yield frame


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------

async def _stream_openai(
    messages: List[Dict[str, Any]],
    api_key: str,
    model: str | None = None,
) -> AsyncIterator[str]:
    has_system = any(m.get("role") == "system" for m in messages)
    if not has_system:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}, *messages]

    body = {
        "model": model or "gpt-4o-mini",
        "messages": messages,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
        async with client.stream(
            "POST",
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        ) as resp:
            if resp.status_code != 200:
                error_text = ""
                async for chunk in resp.aiter_text():
                    error_text += chunk
                yield f"data: {json.dumps({'error': error_text, 'status': resp.status_code})}\n\n"
                return

            async for line in resp.aiter_lines():
                if not line:
                    continue
                if line.startswith("data: "):
                    yield line + "\n\n"
                    if line.strip() == "data: [DONE]":
                        return

    yield "data: [DONE]\n\n"


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------

async def _stream_anthropic(
    messages: List[Dict[str, Any]],
    api_key: str,
    model: str | None = None,
) -> AsyncIterator[str]:
    # Anthropic expects messages without system role; system goes top-level
    system_text = ""
    filtered: list[dict] = []
    for m in messages:
        if m.get("role") == "system":
            system_text += m.get("content", "")
        else:
            filtered.append(m)

    if not system_text:
        system_text = SYSTEM_PROMPT

    body: dict[str, Any] = {
        "model": model or "claude-sonnet-4-20250514",
        "max_tokens": 4096,
        "system": system_text,
        "messages": filtered,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
        async with client.stream(
            "POST",
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json=body,
        ) as resp:
            if resp.status_code != 200:
                error_text = ""
                async for chunk in resp.aiter_text():
                    error_text += chunk
                yield f"data: {json.dumps({'error': error_text, 'status': resp.status_code})}\n\n"
                return

            async for line in resp.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if raw == "[DONE]":
                    break
                try:
                    parsed = json.loads(raw)
                    if parsed.get("type") == "content_block_delta":
                        text = parsed.get("delta", {}).get("text", "")
                        if text:
                            openai_fmt = json.dumps(
                                {"choices": [{"delta": {"content": text}}]}
                            )
                            yield f"data: {openai_fmt}\n\n"
                except json.JSONDecodeError:
                    pass

    yield "data: [DONE]\n\n"
