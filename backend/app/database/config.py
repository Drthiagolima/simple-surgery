from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SIMPLE SURGERY API"
    app_env: str = "development"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5434/simple_surgery"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60
    api_port: int = 8010
    frontend_origin: str = "http://localhost:3010"

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
        return url


settings = Settings()
