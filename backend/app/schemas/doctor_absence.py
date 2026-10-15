from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class DoctorAbsenceCreate(BaseModel):
    """Datos que envia el medico para notificar una ausencia."""

    absence_date: date
    reason: str | None = Field(default=None, max_length=255)


class DoctorAbsenceResponse(BaseModel):
    """Ausencia devuelta por la API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_id: int
    absence_date: date
    reason: str | None = None
    notified_at: datetime
    notified_by: int
    seen_at: datetime | None = None
    seen_by: int | None = None
    resolved_at: datetime | None = None
    resolved_by: int | None = None

    # Campos derivados (para el frontend)
    doctor_name: str | None = None
    notified_by_email: str | None = None


class DoctorAbsenceResolve(BaseModel):
    """Datos para marcar una ausencia como resuelta. Opcional."""

    reason: str | None = Field(default=None, max_length=255)
