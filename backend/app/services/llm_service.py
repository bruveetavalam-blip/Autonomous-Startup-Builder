"""Provider-aware LLM integration for all agents.

Set LLM_PROVIDER to one of: groq, openai, gemini, ollama.
"""

import logging
import os
from pathlib import Path
from typing import Callable, Literal

import requests
from dotenv import dotenv_values

logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
PROJECT_ENV_PATH = PROJECT_ROOT / ".env"


def _load_environment() -> None:
    """Load config from the project-level .env first, then the backend-local .env."""
    env_files = [PROJECT_ENV_PATH, BACKEND_ENV_PATH]
    for env_path in env_files:
        if not env_path.exists():
            continue
        for name, value in dotenv_values(env_path).items():
            if not name or value is None:
                continue
            existing = os.getenv(name)
            if existing is None or existing.strip() == "":
                os.environ[name] = value


_load_environment()

ProviderName = Literal["groq", "openai", "gemini", "ollama"]


class LLMConfigurationError(RuntimeError):
    """Raised when the selected LLM provider is not configured."""


def _provider() -> ProviderName:
    provider = os.getenv("LLM_PROVIDER", "groq").strip().lower()
    if provider not in {"groq", "openai", "gemini", "ollama"}:
        raise LLMConfigurationError(
            "LLM_PROVIDER must be one of: groq, openai, gemini, ollama"
        )
    return provider  # type: ignore[return-value]


def _fallback_order(primary: ProviderName) -> list[ProviderName]:
    configured = os.getenv("LLM_FALLBACK_ORDER", "groq,gemini,openai,ollama")
    ordered = [
        item.strip().lower()
        for item in configured.split(",")
        if item.strip().lower() in {"groq", "openai", "gemini", "ollama"}
    ]
    providers = [primary]
    providers.extend(provider for provider in ordered if provider not in providers)
    return providers  # type: ignore[return-value]


def _env_value(name: str) -> str:
    return (os.getenv(name) or "").strip()


def _provider_model(provider: ProviderName) -> str:
    return {
        "groq": _env_value("GROQ_MODEL") or "llama-3.3-70b-versatile",
        "openai": _env_value("OPENAI_MODEL") or "gpt-4o-mini",
        "gemini": _env_value("GEMINI_MODEL") or "gemini-2.5-flash",
        "ollama": _env_value("OLLAMA_MODEL") or "llama3.1",
    }[provider]


def _provider_key_present(provider: ProviderName) -> bool:
    if provider == "groq":
        return bool(_env_value("GROQ_API_KEY"))
    if provider == "openai":
        return bool(_env_value("OPENAI_API_KEY"))
    if provider == "gemini":
        return bool(_env_value("GEMINI_API_KEY") or _env_value("GOOGLE_API_KEY"))
    return bool(_env_value("OLLAMA_BASE_URL") or os.getenv("LLM_PROVIDER", "").strip().lower() == "ollama")


def _provider_configured(provider: ProviderName) -> bool:
    return _provider_key_present(provider)


def _log_provider_config(primary: ProviderName, providers: list[ProviderName]) -> None:
    logger.warning(
        "LLM config: project_env=%s backend_env=%s selected=%s fallback_order=%s keys=%s models=%s",
        PROJECT_ENV_PATH,
        BACKEND_ENV_PATH,
        primary,
        ",".join(providers),
        {
            "groq": _provider_key_present("groq"),
            "gemini": _provider_key_present("gemini"),
            "openai": _provider_key_present("openai"),
            "ollama_base_url": _provider_key_present("ollama"),
        },
        {provider: _provider_model(provider) for provider in providers},
    )


def _generate_with_groq(prompt: str, temperature: float) -> str:
    from groq import Groq

    api_key = _env_value("GROQ_API_KEY")
    if not api_key:
        raise LLMConfigurationError("GROQ_API_KEY is required when LLM_PROVIDER=groq")
    completion = Groq(api_key=api_key).chat.completions.create(
        model=_provider_model("groq"),
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return completion.choices[0].message.content or ""


def _generate_with_openai(prompt: str, temperature: float) -> str:
    from openai import OpenAI

    api_key = _env_value("OPENAI_API_KEY")
    if not api_key:
        raise LLMConfigurationError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
    completion = OpenAI(api_key=api_key).chat.completions.create(
        model=_provider_model("openai"),
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return completion.choices[0].message.content or ""


def _generate_with_gemini(prompt: str, temperature: float) -> str:
    from google import genai

    api_key = _env_value("GEMINI_API_KEY") or _env_value("GOOGLE_API_KEY")
    if not api_key:
        raise LLMConfigurationError(
            "GEMINI_API_KEY or GOOGLE_API_KEY is required when LLM_PROVIDER=gemini"
        )
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=_provider_model("gemini"),
        contents=prompt,
        config={"temperature": temperature},
    )
    return response.text or ""


def _generate_with_ollama(prompt: str, temperature: float) -> str:
    base_url = (_env_value("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")
    model = _provider_model("ollama")
    response = requests.post(
        f"{base_url}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        },
        timeout=120,
    )
    response.raise_for_status()
    return response.json().get("response", "")


def _generator_for(provider: ProviderName) -> Callable[[str, float], str]:
    return {
        "groq": _generate_with_groq,
        "openai": _generate_with_openai,
        "gemini": _generate_with_gemini,
        "ollama": _generate_with_ollama,
    }[provider]


def generate_response(prompt: str, temperature: float = 0.7) -> str:
    """Generate text using the configured provider, then configured fallbacks."""
    errors: list[str] = []
    primary = _provider()
    providers = _fallback_order(primary)
    _log_provider_config(primary, providers)
    for provider in providers:
        if provider != primary and not _provider_configured(provider):
            logger.warning(
                "LLM provider %s skipped: missing config (selected=%s key_present=%s model=%s)",
                provider,
                primary,
                _provider_key_present(provider),
                _provider_model(provider),
            )
            continue
        try:
            logger.warning(
                "LLM provider %s selected: key_present=%s model=%s",
                provider,
                _provider_key_present(provider),
                _provider_model(provider),
            )
            response = _generator_for(provider)(prompt, temperature)
            if response.strip():
                return response
            errors.append(f"{provider}: empty response")
            logger.warning("LLM provider %s failed: empty response", provider)
        except Exception as exc:
            logger.warning(
                "LLM provider %s failed: %s (selected=%s key_present=%s model=%s)",
                provider,
                exc,
                primary,
                _provider_key_present(provider),
                _provider_model(provider),
                exc_info=True,
            )
            errors.append(f"{provider}: {exc}")
    raise LLMConfigurationError("All LLM providers failed. " + " | ".join(errors))


def get_llm_status() -> dict[str, str | bool]:
    """Return provider configuration metadata without exposing secrets."""
    provider = _provider()
    required_keys = {
        "groq": ["GROQ_API_KEY"],
        "openai": ["OPENAI_API_KEY"],
        "gemini": ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "ollama": [],
    }[provider]
    configured = True
    if provider == "gemini":
        configured = bool(_env_value("GEMINI_API_KEY") or _env_value("GOOGLE_API_KEY"))
    elif required_keys:
        configured = all(bool(_env_value(key)) for key in required_keys)
    return {
        "provider": provider,
        "configured": configured,
        "model": _provider_model(provider),
        "fallback_order": ",".join(_fallback_order(provider)),
    }
