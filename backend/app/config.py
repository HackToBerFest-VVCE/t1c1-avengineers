from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemma_model: str = "gemma-4-26b-a4b-it"
    frontend_origin: str = "http://localhost:5173"
    max_upload_mb: int = 8
    max_pdf_pages: int = 5
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache

def get_settings() -> Settings:
    return Settings()
