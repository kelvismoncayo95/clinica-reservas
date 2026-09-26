from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.patient import Patient
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientSelfRegister


class AuthServiceError(Exception):
    """Error de negocio del servicio de autenticacion."""
    pass


def register_patient(
    db: Session, data: PatientSelfRegister | PatientCreate
) -> Patient:
    """Registra un paciente nuevo: crea User + Patient en una transaccion.

    Sirve tanto para el registro publico (PatientSelfRegister) como
    para que admin/recepcion cree un paciente (PatientCreate). Los
    dos schemas tienen la misma forma.
    """

    if db.scalar(select(User).where(User.email == data.email)):
        raise AuthServiceError("Ya existe una cuenta con ese email")

    if db.scalar(select(Patient).where(Patient.dni == data.dni)):
        raise AuthServiceError("Ya existe un paciente con ese DNI")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role="patient",
    )
    db.add(user)
    db.flush()

    patient = Patient(
        user_id=user.id,
        first_name=data.first_name,
        last_name=data.last_name,
        dni=data.dni,
        birth_date=data.birth_date,
        phone=data.phone,
        email=data.email,
        obra_social=data.obra_social,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Verifica credenciales. Devuelve el User o None."""
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.activo:
        return None
    return user
