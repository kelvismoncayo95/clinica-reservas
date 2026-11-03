from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


UserRole = Literal["admin", "reception", "doctor", "patient"]


class UserBase(BaseModel):
    """Campos comunes."""

    email: str
    role: UserRole


class UserCreate(UserBase):
    """Datos para crear un usuario del sistema (admin/reception)."""

    password: str = Field(min_length=6, max_length=100)


class UserUpdate(BaseModel):
    """Datos para modificar un usuario. Todos opcionales."""

    email: str | None = None
    role: UserRole | None = None
    password: str | None = Field(default=None, min_length=6, max_length=100)
    activo: bool | None = None


class UserResponse(UserBase):
    """Usuario devuelto por la API. NUNCA incluye password_hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    activo: bool
    created_at: datetime
    updated_at: datetime
