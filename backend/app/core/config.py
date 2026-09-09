from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "MPLADS Intelligence Platform"
    environment: str = "development"
    api_v1_prefix: str = "/api"

    database_url: str = "postgresql+psycopg2://mplads:mplads@localhost:5433/mplads"

    cors_origins: list[str] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> object:
        # Accept either a JSON array (`["https://a.com","https://b.com"]`) or a
        # plain comma-separated string (`https://a.com,https://b.com`), since
        # host env-var UIs (e.g. Render) don't always let you enter JSON.
        if isinstance(value, str) and not value.strip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

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
