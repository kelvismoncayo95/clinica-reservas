from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field


class ScheduleBase(BaseModel):
    """Campos comunes de un horario semanal."""

    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    slot_duration_minutes: int = Field(default=30)


class ScheduleCreate(ScheduleBase):
    """Datos para crear un horario semanal."""
    pass


class ScheduleUpdate(BaseModel):
    """Datos para modificar un horario. Todos opcionales."""

    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    slot_duration_minutes: int | None = None
    activo: bool | None = None


class ScheduleResponse(ScheduleBase):
    """Horario devuelto por la API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_id: int
    activo: bool
    created_at: datetime
    updated_at: datetime
