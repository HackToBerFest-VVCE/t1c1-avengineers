from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemma_model: str = "gemma-4-26b-a4b-it"
    frontend_origin: str = "http://localhost:5173"
    max_upload_mb: int = Field(default=8, ge=1, le=16)
    max_pdf_pages: int = Field(default=5, ge=1, le=10)
    gemma_timeout_seconds: float = Field(default=40, ge=1, le=120)
    gemma_max_retries: int = Field(default=2, ge=0, le=2)
    session_ttl_seconds: int = Field(default=1200, ge=60, le=3600)
    session_max_count: int = Field(default=32, ge=1, le=128)
    session_max_bytes: int = Field(default=64 * 1024 * 1024, ge=1_000_000, le=256 * 1024 * 1024)

    # Scholarship Freshness Intelligence settings
    search_provider: str = "tavily"
    tavily_api_key: str = ""
    freshness_search_enabled: bool = True
    freshness_max_search_results: int = Field(default=5, ge=1, le=10)
    freshness_request_timeout_seconds: float = Field(default=20.0, ge=5, le=60)
    freshness_authority_domains: str = ""  # Comma-separated extra domains

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache

def get_settings() -> Settings:
    return Settings()
