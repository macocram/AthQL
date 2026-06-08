from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ATHQL_")

    aws_profile: Optional[str] = None
    aws_region: str = "us-east-1"
    athena_workgroup: str = "primary"
    athena_output_location: Optional[str] = None
    s3_staging_dir: Optional[str] = None
    preview_row_limit: int = 200
    metadata_cache_ttl_seconds: int = 900
    debug: bool = False
    dev_port: int = 5173
    dev_host: Optional[str] = None
    dev_origins: Optional[str] = None

    def cors_origins(self) -> list[str]:
        """Browser origins allowed for the Vite dev UI (localhost + optional custom domains)."""
        defaults = [
            f"http://localhost:{self.dev_port}",
            f"http://127.0.0.1:{self.dev_port}",
        ]
        extra: list[str] = []
        if self.dev_host:
            extra.append(f"http://{self.dev_host.strip()}:{self.dev_port}")
        if self.dev_origins:
            extra.extend(part.strip() for part in self.dev_origins.split(",") if part.strip())
        seen: set[str] = set()
        merged: list[str] = []
        for origin in defaults + extra:
            if origin not in seen:
                seen.add(origin)
                merged.append(origin)
        return merged

    @property
    def data_dir(self) -> Path:
        return Path.home() / ".athql"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "metadata.db"


settings = Settings()
