from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


class Settings(BaseSettings):
    app_name: str = "SIMPLE SURGERY API"
    app_env: str = "development"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5434/simple_surgery"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60
    api_port: int = 8010
    frontend_origin: str = "http://localhost:3010"
    database_sslmode: str = "require"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def sqlalchemy_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if "+psycopg2" in url:
            url = url.replace("+psycopg2", "+psycopg")
        elif url.startswith("postgresql://") and "+" not in url.split("://", 1)[0]:
            url = "postgresql+psycopg://" + url[len("postgresql://") :]

        # Keep SSL behavior explicit for Render/managed Postgres and allow override via env.
        if url.startswith("postgresql") and self.database_sslmode:
            parts = urlsplit(url)
            query_params = dict(parse_qsl(parts.query, keep_blank_values=True))
            query_params["sslmode"] = self.database_sslmode
            url = urlunsplit(
                (
                    parts.scheme,
                    parts.netloc,
                    parts.path,
                    urlencode(query_params),
                    parts.fragment,
                )
            )
        return url

    @property
    def frontend_origins(self) -> list[str]:
        raw = self.frontend_origin or ""
        origins = [item.strip() for item in raw.split(",") if item.strip()]
        if not origins:
            origins = ["http://localhost:3010"]
        return origins


settings = Settings()
