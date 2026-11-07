from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Datos que envia el usuario para iniciar sesion."""

    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    """Respuesta del login: token JWT + tipo."""

    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    """Pedido de "Olvidé mi contraseña": solo el email."""

    # str y no EmailStr: los usuarios de la demo usan dominios .test
    email: str = Field(min_length=3, max_length=255)


class ResetPasswordRequest(BaseModel):
    """Token recibido por correo + la contraseña nueva."""

    token: str = Field(min_length=10, max_length=200)
    new_password: str = Field(min_length=8, max_length=100)


class MessageResponse(BaseModel):
    """Respuesta simple con un mensaje."""

    message: str
