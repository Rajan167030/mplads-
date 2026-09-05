"""LLM provider abstraction (spec's AI Assistant requirement). No provider is
hard-coded — `LLM_PROVIDER`/`LLM_API_KEY` come from environment/.env and
default to "none". When unconfigured, callers must handle
`LLMNotConfiguredError` rather than receiving a fabricated response — this
codebase never simulates an LLM's output.
"""

import httpx

from app.core.config import get_settings


class LLMNotConfiguredError(Exception):
    pass


class LLMRequestError(Exception):
    pass


def generate_completion(prompt: str, system: str | None = None) -> str:
    settings = get_settings()

    if settings.llm_provider == "none" or not settings.llm_api_key:
        raise LLMNotConfiguredError(
            "No LLM provider configured. Set LLM_PROVIDER (gemini|openai|groq) and LLM_API_KEY to enable the assistant."
        )

    if settings.llm_provider == "gemini":
        return _call_gemini(prompt, system, settings.llm_api_key, settings.llm_model)
    if settings.llm_provider == "openai":
        return _call_openai_compatible(
            "https://api.openai.com/v1/chat/completions", prompt, system, settings.llm_api_key, settings.llm_model
        )
    if settings.llm_provider == "groq":
        # Groq's API is OpenAI-compatible (same request/response shape) — only
        # the base URL and available models differ.
        return _call_openai_compatible(
            "https://api.groq.com/openai/v1/chat/completions", prompt, system, settings.llm_api_key, settings.llm_model
        )

    raise LLMNotConfiguredError(
        f"Unknown LLM_PROVIDER: {settings.llm_provider!r} (expected 'gemini', 'openai', or 'groq')"
    )


def _call_gemini(prompt: str, system: str | None, api_key: str, model: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload: dict = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}

    try:
        response = httpx.post(url, params={"key": api_key}, json=payload, timeout=30.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise LLMRequestError(f"Gemini request failed: {exc}") from exc

    data = response.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise LLMRequestError(f"Unexpected Gemini response shape: {data}") from exc


def _call_openai_compatible(url: str, prompt: str, system: str | None, api_key: str, model: str) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": model, "messages": messages},
            timeout=30.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise LLMRequestError(f"Request to {url} failed: {exc}") from exc

    data = response.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise LLMRequestError(f"Unexpected response shape from {url}: {data}") from exc
