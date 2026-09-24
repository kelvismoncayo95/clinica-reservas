from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Datos que envia el usuario para iniciar sesion."""

    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    """Respuesta del login: token JWT + tipo."""

    access_token: str
    token_type: str = "bearer"
