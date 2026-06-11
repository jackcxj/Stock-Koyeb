from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    wechat_webhook_url: str = ""
    poll_interval_seconds: int = 60
    alert_cooldown_minutes: int = 45
    demo_mode: bool = True
    enable_auto_poll: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
