from datetime import date, time
from pydantic import BaseModel, ConfigDict, Field


class AvailabilitySlot(BaseModel):
    """Un slot de tiempo en la grilla del medico."""

    start_time: time
    end_time: time
    available: bool


class AvailabilityResponse(BaseModel):
    """Respuesta del endpoint /availability."""

    doctor_id: int
    date: date
    slots: list[AvailabilitySlot] = Field(default_factory=list)
