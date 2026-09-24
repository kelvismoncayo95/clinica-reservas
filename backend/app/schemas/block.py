from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class BlockBase(BaseModel):
    """Campos comunes de un bloqueo."""

    start_date: date
    end_date: date
    reason: str | None = Field(default=None, max_length=255)


class BlockCreate(BlockBase):
    """Datos para crear un bloqueo."""
    pass


class BlockResponse(BlockBase):
    """Bloqueo devuelto por la API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_id: int
    created_at: datetime
