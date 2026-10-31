from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.core.dependencies import get_current_user
from app.core.security import create_access_token
from app.database import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.patient import PatientResponse, PatientSelfRegister
from app.schemas.user import UserResponse
from app.services.auth_service import (
    AuthServiceError,
    authenticate_user,
    register_patient,
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
