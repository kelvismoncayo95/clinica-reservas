from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración del proyecto, leída desde el archivo .env"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Entorno
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Base de datos
    DATABASE_URL: str

    # Seguridad
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    CORS_ORIGINS: str = ""

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int | None = None
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = ""
    CLINIC_TIMEZONE: str = "America/Montevideo"
    RESEND_API_KEY: str = ""

    # Reglas de negocio de citas
    APPOINTMENT_MIN_HOURS_NOTICE: int = 1
    APPOINTMENT_MAX_DAYS_AHEAD: int = 60
    APPOINTMENT_MAX_FUTURE_PER_PATIENT: int = 3
    APPOINTMENT_MIN_HOURS_CANCEL_PATIENT: int = 24


@lru_cache
def get_settings() -> Settings:
    return Settings()
