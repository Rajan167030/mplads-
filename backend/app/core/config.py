from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "MPLADS Intelligence Platform"
    environment: str = "development"
    api_v1_prefix: str = "/api"

    database_url: str = "postgresql+psycopg2://mplads:mplads@localhost:5433/mplads"

    cors_origins: list[str] = ["http://localhost:3000"]

    # LLM provider abstraction (see app.services.llm) — no provider is hard-coded.
    llm_provider: str = "none"  # "gemini" | "openai" | "groq" | "none"
    llm_api_key: str | None = None
    llm_model: str = "gemini-2.0-flash"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8


@lru_cache
def get_settings() -> Settings:
    return Settings()
