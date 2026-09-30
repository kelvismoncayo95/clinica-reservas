from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password
from app.models.doctor import Doctor
from app.models.doctor_specialty import doctor_specialties
from app.models.specialty import Specialty
from app.models.user import User
from app.schemas.doctor import DoctorCreate, DoctorUpdate


class DoctorServiceError(Exception):
    """Error de negocio del servicio de medicos."""
    pass


def validate_specialty_ids(db: Session, ids: list[int]) -> list[Specialty]:
    """Valida que todos los ids existan y esten activos."""
    if not ids:
        return []

    unique_ids = list(set(ids))
    stmt = select(Specialty).where(
        Specialty.id.in_(unique_ids),
        Specialty.activo.is_(True),
    )
    specialties = list(db.scalars(stmt).all())

    if len(specialties) != len(unique_ids):
        found_ids = {s.id for s in specialties}
        missing = [i for i in unique_ids if i not in found_ids]
        raise DoctorServiceError(
            f"Especialidades no encontradas o inactivas: {missing}"
        )

    return specialties


def create_doctor(db: Session, data: DoctorCreate) -> Doctor:
    """Crea User + Doctor + especialidades en una transaccion."""

    if db.scalar(select(User).where(User.email == data.user_email)):
        raise DoctorServiceError("Ya existe un usuario con ese email")

    if db.scalar(
        select(Doctor).where(Doctor.license_number == data.license_number)
    ):
        raise DoctorServiceError("Ya existe un medico con esa matricula")

    specialties = validate_specialty_ids(db, data.specialty_ids)

    user = User(
        email=data.user_email,
        password_hash=hash_password(data.password),
        role="doctor",
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        first_name=data.first_name,
        last_name=data.last_name,
        license_number=data.license_number,
        phone=data.phone,
        email=data.email,
    )
    db.add(doctor)
    db.flush()

    for specialty in specialties:
        db.execute(
            doctor_specialties.insert().values(
                doctor_id=doctor.id,
                specialty_id=specialty.id,
            )
        )

    db.commit()
    db.refresh(doctor)
    return doctor


def update_doctor(db: Session, doctor: Doctor, data: DoctorUpdate) -> Doctor:
    """Modifica un medico. Reemplaza especialidades si vinieron."""
    update_data = data.model_dump(exclude_unset=True)

    if "license_number" in update_data:
        existing = db.scalar(
            select(Doctor).where(
                Doctor.license_number == update_data["license_number"],
                Doctor.id != doctor.id,
            )
        )
        if existing is not None:
            raise DoctorServiceError(
                "Ya existe otro medico con esa matricula"
            )

    specialty_ids = update_data.pop("specialty_ids", None)

    for field, value in update_data.items():
        setattr(doctor, field, value)

    if specialty_ids is not None:
        new_specialties = validate_specialty_ids(db, specialty_ids)

        db.execute(
            delete(doctor_specialties).where(
                doctor_specialties.c.doctor_id == doctor.id
            )
        )

        for specialty in new_specialties:
            db.execute(
                doctor_specialties.insert().values(
                    doctor_id=doctor.id,
                    specialty_id=specialty.id,
                )
            )

    db.commit()
    db.refresh(doctor)
    return doctor


def get_doctor_with_specialties(db: Session, doctor_id: int) -> Doctor | None:
    """Devuelve un medico con sus especialidades cargadas (evita N+1)."""
    stmt = (
        select(Doctor)
        .where(Doctor.id == doctor_id)
        .options(selectinload(Doctor.specialties))
    )
    return db.scalar(stmt)
