from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class PatientBase(BaseModel):
    """Campos comunes del paciente."""

    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    dni: str = Field(min_length=7, max_length=8)
    birth_date: date
    phone: str = Field(min_length=7, max_length=15)
    email: str
    obra_social: str | None = Field(default=None, max_length=100)

    @field_validator("first_name", "last_name")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío")
        for c in v:
            if not (c.isalpha() or c.isspace()):
                raise ValueError("El nombre solo puede tener letras y espacios")
        return v

    @field_validator("dni")
    @classmethod
    def validar_dni(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit():
            raise ValueError("La cédula solo puede tener números")
        if not (7 <= len(v) <= 8):
            raise ValueError("La cédula debe tener 7 u 8 dígitos")
        return v

    @field_validator("phone")
    @classmethod
    def validar_phone(cls, v: str) -> str:
        v = v.strip()
        for c in v:
            if not (c.isdigit() or c in " +-"):
                raise ValueError("El teléfono solo puede tener números, espacios, guiones o +")
        return v

    @field_validator("email")
    @classmethod
    def validar_email(cls, v: str) -> str:
        # Exigir que el dominio tenga al menos 2 letras después del último punto
        if "." not in v:
            raise ValueError("El correo debe tener un dominio con punto (ej: .com, .uy)")
        dominio = v.split("@")[-1]
        if "." not in dominio:
            raise ValueError("El correo debe tener un dominio con punto")
        tld = dominio.split(".")[-1]
        if len(tld) < 2:
            raise ValueError("El dominio del correo debe tener al menos 2 letras")
        return v


class PatientCreate(PatientBase):
    """Datos para que admin/recepcion cree un paciente desde el panel.

    Incluye password porque el endpoint crea User + Patient en una
    transaccion.
    """

    password: str = Field(min_length=8, max_length=100)


class PatientSelfRegister(PatientBase):
    """Datos para que un paciente se registre solo desde la web."""

    password: str = Field(min_length=8, max_length=100)

    @field_validator("birth_date")
    @classmethod
    def validar_edad(cls, v: date) -> date:
        hoy = date.today()
        edad = hoy.year - v.year - ((hoy.month, hoy.day) < (v.month, v.day))
        if edad < 18:
            raise ValueError("Tenés que tener al menos 18 años para registrarte")
        if edad > 120:
            raise ValueError("La fecha de nacimiento no es válida")
        return v


class PatientUpdate(BaseModel):
    """Datos para modificar un paciente. Todos opcionales.

    NOTA: el DNI no esta incluido porque no se puede modificar.
    Si hay un error en el DNI, hay que corregirlo desde la base.
    """

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    birth_date: date | None = None
    phone: str | None = Field(default=None, min_length=1, max_length=50)
    email: str | None = None
    obra_social: str | None = Field(default=None, max_length=100)
    activo: bool | None = None


class PatientResponse(BaseModel):
    """Paciente devuelto por la API.

    No hereda de PatientBase para evitar las validaciones
    (que aplican solo al crear/modificar). Asi los pacientes
    viejos con datos invalidos no rompen el endpoint.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    first_name: str
    last_name: str
    dni: str
    birth_date: date
    phone: str
    email: str
    obra_social: str | None = None
    activo: bool
    created_at: datetime
    updated_at: datetime
