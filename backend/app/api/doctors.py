from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.dependencies import get_current_user, require_admin
from app.database import get_db
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.user import User
from app.schemas.appointment import AppointmentResponse
from app.schemas.doctor import DoctorCreate, DoctorResponse, DoctorUpdate
from app.services.appointment_helpers import enrich_appointments
from app.services.doctor_service import (
    DoctorServiceError,
    create_doctor,
    get_doctor_with_specialties,
    update_doctor,
)


router = APIRouter(prefix="/api/v1/doctors", tags=["doctors"])


def to_doctor_response(doctor: Doctor) -> DoctorResponse:
    """Convierte un Doctor a DoctorResponse incluyendo specialty_ids."""
    return DoctorResponse(
        id=doctor.id,
        user_id=doctor.user_id,
        first_name=doctor.first_name,
        last_name=doctor.last_name,
        license_number=doctor.license_number,
        phone=doctor.phone,
        email=doctor.email,
        activo=doctor.activo,
        created_at=doctor.created_at,
        updated_at=doctor.updated_at,
        specialty_ids=[s.id for s in doctor.specialties],
    )


@router.get("", response_model=list[DoctorResponse])
def list_doctors(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista todos los medicos activos con sus especialidades."""
    stmt = (
        select(Doctor)
        .where(Doctor.activo.is_(True))
        .options(selectinload(Doctor.specialties))
        .order_by(Doctor.last_name)
    )
    doctors = list(db.scalars(stmt).all())
    return [to_doctor_response(d) for d in doctors]


@router.get("/{doctor_id}", response_model=DoctorResponse)
def get_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Devuelve un medico por id con sus especialidades."""
    doctor = get_doctor_with_specialties(db, doctor_id)
    if doctor is None or not doctor.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medico no encontrado",
        )
    return to_doctor_response(doctor)


@router.get(
    "/{doctor_id}/appointments",
    response_model=list[AppointmentResponse],
)
def doctor_appointments(
    doctor_id: int,
    status_filter: str | None = Query(default=None, alias="status"),
    date_filter: str | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista las citas de un medico. El medico solo puede ver las suyas.

    Acepta un filtro opcional ?status=confirmed para traer solo las
    confirmadas (util para el panel del dia del medico).
    """
    doctor = db.get(Doctor, doctor_id)
    if doctor is None or not doctor.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medico no encontrado",
        )

    if current_user.role == "doctor":
        own_doctor = db.scalar(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        if own_doctor is None or own_doctor.id != doctor.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Medico no encontrado",
            )

    stmt = select(Appointment).where(Appointment.doctor_id == doctor.id)
    if status_filter is not None:
        stmt = stmt.where(Appointment.status == status_filter)
    if date_filter is not None:
        stmt = stmt.where(Appointment.appointment_date == date_filter)
    stmt = stmt.order_by(
        Appointment.appointment_date, Appointment.start_time
    )
    citas = list(db.scalars(stmt).all())
    return enrich_appointments(db, citas)


@router.post(
    "",
    response_model=DoctorResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_doctor_endpoint(
    data: DoctorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Crea un medico nuevo (User + Doctor + especialidades). Solo admin."""
    try:
        doctor = create_doctor(db, data)
    except DoctorServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(e)
        )

    doctor = get_doctor_with_specialties(db, doctor.id)
    return to_doctor_response(doctor)


@router.put("/{doctor_id}", response_model=DoctorResponse)
def update_doctor_endpoint(
    doctor_id: int,
    data: DoctorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Modifica un medico. Solo admin."""
    doctor = db.get(Doctor, doctor_id)
    if doctor is None or not doctor.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medico no encontrado",
        )

    try:
        doctor = update_doctor(db, doctor, data)
    except DoctorServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(e)
        )

    doctor = get_doctor_with_specialties(db, doctor.id)
    return to_doctor_response(doctor)


@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Desactiva un medico (soft delete). Solo admin."""
    doctor = db.get(Doctor, doctor_id)
    if doctor is None or not doctor.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medico no encontrado",
        )

    doctor.activo = False
    doctor.deactivated_at = datetime.now(timezone.utc)
    doctor.deactivated_by = current_user.id
    db.commit()
    return None
