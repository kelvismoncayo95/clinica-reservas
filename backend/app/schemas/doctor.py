from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

# Validacion simple de formato "algo@algo.algo". No usamos EmailStr porque
# rechaza dominios reservados como ".test", que usan los medicos de la demo.
Email = Annotated[
    str, Field(max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
]


class DoctorBase(BaseModel):
    """Campos comunes del medico."""

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    license_number: str = Field(min_length=1, max_length=50)
    phone: str | None = Field(default=None, max_length=50)
    email: Email | None = None


class DoctorCreate(DoctorBase):
    """Datos para crear un medico. Incluye datos de acceso y especialidades."""

    password: str = Field(min_length=6, max_length=100)
    specialty_ids: list[int] = Field(default_factory=list)


class DoctorUpdate(BaseModel):
    """Datos para modificar un medico. Todos opcionales."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    license_number: str | None = Field(default=None, min_length=1, max_length=50)
    phone: str | None = Field(default=None, max_length=50)
    email: Email | None = None
    activo: bool | None = None
    specialty_ids: list[int] | None = None


class DoctorResponse(DoctorBase):
    """Medico devuelto por la API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    activo: bool
    created_at: datetime
    updated_at: datetime
    specialty_ids: list[int] = Field(default_factory=list)
