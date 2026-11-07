from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.limiter import limiter
from app.core.dependencies import get_current_user
from app.core.security import create_access_token
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.patient import PatientResponse, PatientSelfRegister
from app.schemas.user import UserResponse
from app.services.auth_service import (
    AuthServiceError,
    authenticate_user,
    register_patient,
)
from app.services.email_service import enviar_email
from app.services.email_templates import get_email_recuperar_password
from app.services.password_reset_service import (
    PasswordResetError,
    request_password_reset,
    reset_password,
)


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Inicia sesion. Recibe form-data con username (email) y password."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contrasena incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token)


@router.post(
    "/register",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    data: PatientSelfRegister,
    db: Session = Depends(get_db),
):
    """Registra un paciente nuevo desde la web publica."""
    try:
        patient = register_patient(db, data)
    except AuthServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(e)
        )
    return patient


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Devuelve los datos del usuario logueado."""
    return current_user


FORGOT_PASSWORD_MESSAGE = (
    "Si el email está registrado, te enviamos un enlace para "
    "crear una contraseña nueva."
)


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute")
def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Pide un enlace para cambiar la contraseña.

    Siempre responde lo mismo, exista o no el email, para que nadie pueda
    usar este endpoint para averiguar quien tiene cuenta en la clinica.
    El correo se manda en segundo plano para que la respuesta tarde lo
    mismo en los dos casos.
    """
    result = request_password_reset(db, data.email)
    if result is not None:
        user, token = result
        settings = get_settings()
        link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password.html?token={token}"
        asunto, html = get_email_recuperar_password(
            link, settings.PASSWORD_RESET_EXPIRE_MINUTES
        )
        background_tasks.add_task(enviar_email, user.email, asunto, html)
    return MessageResponse(message=FORGOT_PASSWORD_MESSAGE)


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("5/minute")
def reset_password_endpoint(
    request: Request,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Cambia la contraseña usando el token que llegó por correo."""
    try:
        reset_password(db, data.token, data.new_password)
    except PasswordResetError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return MessageResponse(message="Tu contraseña se cambió. Ya podés iniciar sesión.")
