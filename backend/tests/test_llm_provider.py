import pytest

from app.core.config import get_settings
from app.services.llm import LLMNotConfiguredError, generate_completion


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_none_provider_raises_without_network_call(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "none")
    monkeypatch.setenv("LLM_API_KEY", "")
    with pytest.raises(LLMNotConfiguredError):
        generate_completion("does it matter")


def test_missing_api_key_raises_even_if_provider_set(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_API_KEY", "")
    with pytest.raises(LLMNotConfiguredError):
        generate_completion("does it matter")


def test_unknown_provider_raises(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "some-made-up-provider")
    monkeypatch.setenv("LLM_API_KEY", "sk-fake")
    with pytest.raises(LLMNotConfiguredError):
        generate_completion("does it matter")


def test_groq_missing_api_key_raises_without_network_call(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_API_KEY", "")
    with pytest.raises(LLMNotConfiguredError):
        generate_completion("does it matter")


def test_groq_dispatches_to_openai_compatible_call(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_API_KEY", "gsk-fake")
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")

    calls = []

    def fake_call(url, prompt, system, api_key, model):
        calls.append((url, prompt, system, api_key, model))
        return "fake groq answer"

    monkeypatch.setattr("app.services.llm._call_openai_compatible", fake_call)

    result = generate_completion("hello", system="be terse")

    assert result == "fake groq answer"
    assert len(calls) == 1
    url, prompt, system, api_key, model = calls[0]
    assert url == "https://api.groq.com/openai/v1/chat/completions"
    assert prompt == "hello"
    assert system == "be terse"
    assert api_key == "gsk-fake"
    assert model == "llama-3.3-70b-versatile"
