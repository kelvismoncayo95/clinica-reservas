from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


AppointmentStatus = Literal["confirmed", "cancelled", "attended", "no_show"]


class AppointmentBase(BaseModel):
    """Campos comunes de una cita."""

    appointment_date: date
    start_time: time
    end_time: time


class AppointmentCreate(BaseModel):
    """Datos para reservar una cita.

    El end_time NO se envia desde el frontend: lo calcula el backend
    a partir de la duracion configurada en el horario del medico.
    """

    doctor_id: int
    specialty_id: int
    appointment_date: date
    start_time: time
    patient_id: int | None = Field(
        default=None,
        description="Solo lo usa el personal (recepcion/admin). El paciente lo deja nulo y se toma de su sesion.",
    )


class AppointmentReschedule(BaseModel):
    """Datos para reprogramar una cita."""

    appointment_date: date
    start_time: time


class AppointmentStatusUpdate(BaseModel):
    """Cambiar el estado de una cita (marcar atendida, no-show, etc.)."""

    status: AppointmentStatus


class AppointmentResponse(AppointmentBase):
    """Cita devuelta por la API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    doctor_id: int
    specialty_id: int
    status: AppointmentStatus
    created_by: int
    cancelled_at: datetime | None = None
    cancelled_by: int | None = None
    created_at: datetime
    updated_at: datetime

    # Campos derivados (nombres legibles). Opcionales para compatibilidad
    # con construcciones que no los incluyan.
    patient_name: str | None = None
    doctor_name: str | None = None
    specialty_name: str | None = None
