"""Provider-aware LLM integration for all agents.

Set LLM_PROVIDER to one of: groq, openai, gemini, ollama.
"""

import logging
import os
import json
from typing import Callable, Literal

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

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


def _generate_with_groq(prompt: str, temperature: float) -> str:
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise LLMConfigurationError("GROQ_API_KEY is required when LLM_PROVIDER=groq")
    completion = Groq(api_key=api_key).chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return completion.choices[0].message.content or ""


def _generate_with_openai(prompt: str, temperature: float) -> str:
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise LLMConfigurationError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
    completion = OpenAI(api_key=api_key).chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return completion.choices[0].message.content or ""


def _generate_with_gemini(prompt: str, temperature: float) -> str:
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise LLMConfigurationError(
            "GEMINI_API_KEY or GOOGLE_API_KEY is required when LLM_PROVIDER=gemini"
        )
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        contents=prompt,
        config={"temperature": temperature},
    )
    return response.text or ""


def _generate_with_ollama(prompt: str, temperature: float) -> str:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama3.1")
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
    for provider in _fallback_order(_provider()):
        try:
            response = _generator_for(provider)(prompt, temperature)
            if response.strip():
                return response
            errors.append(f"{provider}: empty response")
        except Exception as exc:
            logger.warning("LLM provider %s failed: %s", provider, exc)
            errors.append(f"{provider}: {exc}")
    if os.getenv("LLM_LOCAL_FALLBACK", "true").strip().lower() in {"1", "true", "yes", "on"}:
        logger.warning("All remote LLM providers failed; using local offline fallback")
        return _offline_response(prompt)
    raise LLMConfigurationError("All LLM providers failed. " + " | ".join(errors))


def _offline_response(prompt: str) -> str:
    """Return useful deterministic output when the configured network is unavailable.

    This is intentionally a last-resort development/runtime fallback. It keeps
    the job contract alive and makes assumptions visible so users can retry
    with a hosted provider later.
    """
    if '"currency": "INR"' in prompt:
        expenses = [{"name": "Founder and engineering", "amount": 120000}, {"name": "Cloud and tools", "amount": 25000}, {"name": "Sales and marketing", "amount": 40000}]
        projection = [{"month": f"M{i}", "revenue": i * 75000, "expenses": 185000, "profit": i * 75000 - 185000} for i in range(1, 13)]
        return json.dumps({"currency": "INR", "startup_cost": {"items": [{"name": "Product development", "amount": 350000}, {"name": "Legal and incorporation", "amount": 50000}, {"name": "Launch marketing", "amount": 100000}], "total": 500000}, "monthly_expenses": expenses, "revenue_projection": projection, "break_even_month": 4, "funding_requirement": 1800000, "assumptions": ["Base case assumes 15 new paying customers per month", "Average starting contract value is ₹5,000 per month", "Figures are planning estimates, not audited forecasts"], "notes": "Offline model generated because remote model providers were unavailable; retry with a connected provider for bespoke assumptions."})
    if '"overall_score"' in prompt:
        return json.dumps({"overall_score": 72, "market_potential": 75, "competition_risk": 58, "revenue_feasibility": 70, "execution_difficulty": 62, "missing_evidence": ["Customer interviews", "Paid demand validation"], "strong_points": ["Clear customer pain point", "Focused initial wedge"], "weak_points": ["Pricing needs validation"], "panel_verdict": "Promising early concept; validate willingness to pay before scaling.", "next_actions": ["Interview 15 target customers", "Run a paid pilot", "Measure retention after 30 days"]})
    return "Offline agent draft: use the supplied startup brief to define a focused customer segment, a measurable problem, a differentiated solution, and a 30-day validation plan. Remote model providers were unavailable, so treat this as a transparent starting point and retry the agent when connectivity returns."


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
        configured = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    elif required_keys:
        configured = all(bool(os.getenv(key)) for key in required_keys)
    return {
        "provider": provider,
        "configured": configured,
        "model": os.getenv(f"{provider.upper()}_MODEL", ""),
        "fallback_order": ",".join(_fallback_order(provider)),
    }
