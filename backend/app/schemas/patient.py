from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PatientBase(BaseModel):
    """Campos comunes del paciente."""

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    dni: str = Field(min_length=1, max_length=20)
    birth_date: date
    phone: str = Field(min_length=1, max_length=50)
    email: EmailStr
    obra_social: str | None = Field(default=None, max_length=100)


class PatientCreate(PatientBase):
    """Datos para crear un paciente. El admin/recepcion lo crea, sin password."""
    pass


class PatientSelfRegister(PatientBase):
    """Datos para que un paciente se registre solo desde la web. Necesita password."""

    password: str = Field(min_length=6, max_length=100)


class PatientUpdate(BaseModel):
    """Datos para modificar un paciente. Todos opcionales."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    dni: str | None = Field(default=None, min_length=1, max_length=20)
    birth_date: date | None = None
    phone: str | None = Field(default=None, min_length=1, max_length=50)
    email: EmailStr | None = None
    obra_social: str | None = Field(default=None, max_length=100)
    activo: bool | None = None


class PatientResponse(PatientBase):
    """Paciente devuelto por la API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    activo: bool
    created_at: datetime
    updated_at: datetime
