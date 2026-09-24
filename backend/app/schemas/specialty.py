from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SpecialtyBase(BaseModel):
    """Campos comunes de una especialidad."""

    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class SpecialtyCreate(SpecialtyBase):
    """Datos para crear una especialidad."""
    pass


class SpecialtyUpdate(BaseModel):
    """Datos para modificar una especialidad. Todos opcionales."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    activo: bool | None = None


class SpecialtyResponse(SpecialtyBase):
    """Especialidad devuelta por la API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    activo: bool
    created_at: datetime
