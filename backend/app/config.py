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

    @property
    def data_dir(self) -> Path:
        return Path.home() / ".athql"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "metadata.db"


settings = Settings()
