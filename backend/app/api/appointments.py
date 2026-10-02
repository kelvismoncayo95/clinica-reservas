from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_reception_or_admin
from app.database import get_db
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentReschedule,
    AppointmentResponse,
    AppointmentStatusUpdate,
)
from app.services.appointment_service import (
    AppointmentServiceError,
    cancel_appointment,
    create_appointment,
    reschedule_appointment,
    update_status,
)


router = APIRouter(prefix="/api/v1/appointments", tags=["appointments"])


def _get_accessible_appointment(
    appointment_id: int, current_user: User, db: Session
) -> Appointment:
    """Devuelve la cita si el usuario tiene acceso. 404 si no."""
    appointment = db.get(Appointment, appointment_id)
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada",
        )

    if current_user.role in ("admin", "reception"):
        return appointment

    if current_user.role == "patient":
        patient = db.scalar(
            select(Patient).where(Patient.user_id == current_user.id)
        )
        if patient is None or appointment.patient_id != patient.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cita no encontrada",
            )
        return appointment

    if current_user.role == "doctor":
        doctor = db.scalar(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        if doctor is None or appointment.doctor_id != doctor.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cita no encontrada",
            )
        return appointment

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Cita no encontrada",
    )


@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_appointment_endpoint(
    data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reserva una cita. Paciente para si, admin/recepcion para cualquiera."""
    try:
        appointment = create_appointment(db, data, current_user)
    except AppointmentServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(e)
        )
    return appointment


@router.get("", response_model=list[AppointmentResponse])
def list_appointments(
    appointment_date: str | None = Query(default=None, alias="date"),
    doctor_id: int | None = None,
    patient_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(require_reception_or_admin),
):
    """Lista citas con filtros. Solo admin/recepcion."""
    stmt = select(Appointment)
    if appointment_date is not None:
        stmt = stmt.where(Appointment.appointment_date == appointment_date)
    if doctor_id is not None:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    if patient_id is not None:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    if status_filter is not None:
        stmt = stmt.where(Appointment.status == status_filter)
    stmt = stmt.order_by(
        Appointment.appointment_date, Appointment.start_time
    )
    return list(db.scalars(stmt).all())


@router.get("/me", response_model=list[AppointmentResponse])
def my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve las citas del paciente logueado."""
    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los pacientes tienen este endpoint",
        )
    patient = db.scalar(
        select(Patient).where(Patient.user_id == current_user.id)
    )
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontro tu ficha de paciente",
        )
    stmt = (
        select(Appointment)
        .where(Appointment.patient_id == patient.id)
        .order_by(Appointment.appointment_date, Appointment.start_time)
    )
    return list(db.scalars(stmt).all())


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve una cita. Admin/recepcion cualquiera, paciente y medico solo las suyas."""
    return _get_accessible_appointment(appointment_id, current_user, db)


# ----- Acciones sobre citas -----


def _appointment_is_future(appointment: Appointment) -> bool:
    """True si la cita es futura."""
    from datetime import datetime
    target = datetime.combine(
        appointment.appointment_date, appointment.start_time
    )
    return target > datetime.now()


@router.patch(
    "/{appointment_id}/cancel",
    response_model=AppointmentResponse,
)
def cancel_appointment_endpoint(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancela una cita."""
    appointment = _get_accessible_appointment(
        appointment_id, current_user, db
    )

    if current_user.role == "patient":
        if not _appointment_is_future(appointment):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No podes cancelar una cita pasada",
            )
    elif current_user.role == "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los medicos no pueden cancelar citas",
        )

    try:
        appointment = cancel_appointment(db, appointment, current_user)
    except AppointmentServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    return appointment


@router.patch(
    "/{appointment_id}/reschedule",
    response_model=AppointmentResponse,
)
def reschedule_appointment_endpoint(
    appointment_id: int,
    data: AppointmentReschedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reprograma una cita a nueva fecha/hora."""
    appointment = _get_accessible_appointment(
        appointment_id, current_user, db
    )

    if current_user.role == "patient":
        if not _appointment_is_future(appointment):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No podes reprogramar una cita pasada",
            )
    elif current_user.role == "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los medicos no pueden reprogramar citas",
        )

    try:
        appointment = reschedule_appointment(
            db,
            appointment,
            new_date=data.appointment_date,
            new_start_time=data.start_time,
            current_user=current_user,
        )
    except AppointmentServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(e)
        )
    return appointment


@router.patch(
    "/{appointment_id}/status",
    response_model=AppointmentResponse,
)
def update_status_endpoint(
    appointment_id: int,
    data: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca una cita como attended o no_show."""
    if current_user.role == "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los pacientes no pueden cambiar el estado de una cita",
        )

    appointment = db.get(Appointment, appointment_id)
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada",
        )

    if current_user.role == "doctor":
        doctor = db.scalar(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        if doctor is None or appointment.doctor_id != doctor.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cita no encontrada",
            )

    try:
        appointment = update_status(
            db, appointment, data.status, current_user
        )
    except AppointmentServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    return appointment
