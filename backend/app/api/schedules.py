from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.database import get_db
from app.models.block import Block
from app.models.doctor import Doctor
from app.models.schedule import Schedule
from app.models.user import User
from app.schemas.block import BlockCreate, BlockResponse
from app.schemas.appointment import AppointmentResponse
from app.schemas.schedule import ScheduleClose, ScheduleCreate, ScheduleResponse, ScheduleUpdate
from app.services.schedule_service import (
    ScheduleServiceError,
    close_schedule,
    count_future_appointments,
    create_block,
    create_schedule,
    update_schedule,
)


router = APIRouter(prefix="/api/v1", tags=["schedules"])


def _get_active_doctor(db: Session, doctor_id: int) -> Doctor:
    doctor = db.get(Doctor, doctor_id)
    if doctor is None or not doctor.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medico no encontrado",
        )
    return doctor


# ----- Horarios semanales -----


@router.get(
    "/doctors/{doctor_id}/schedules",
    response_model=list[ScheduleResponse],
)
def list_schedules(
    doctor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista los horarios activos de un medico."""
    _get_active_doctor(db, doctor_id)
    stmt = (
        select(Schedule)
        .where(
            Schedule.doctor_id == doctor_id,
            Schedule.activo.is_(True),
        )
        .order_by(Schedule.day_of_week, Schedule.start_time)
    )
    return list(db.scalars(stmt).all())


@router.post(
    "/doctors/{doctor_id}/schedules",
    response_model=ScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_schedule_endpoint(
    doctor_id: int,
    data: ScheduleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Crea un horario semanal para un medico. Solo admin."""
    doctor = _get_active_doctor(db, doctor_id)
    try:
        schedule = create_schedule(db, doctor, data)
    except ScheduleServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    return schedule


@router.put("/schedules/{schedule_id}", response_model=ScheduleResponse)
def update_schedule_endpoint(
    schedule_id: int,
    data: ScheduleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Modifica un horario. Solo admin."""
    schedule = db.get(Schedule, schedule_id)
    if schedule is None or not schedule.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Horario no encontrado",
        )
    try:
        schedule = update_schedule(db, schedule, data)
    except ScheduleServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    return schedule


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Desactiva un horario (soft delete). Solo admin.

    Si hay citas futuras confirmadas en este horario, no se puede
    desactivar. Primero hay que gestionarlas (cancelarlas,
    reprogramarlas, o cerrar el horario con fecha de corte).
    """
    schedule = db.get(Schedule, schedule_id)
    if schedule is None or not schedule.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Horario no encontrado",
        )

    pendientes = count_future_appointments(db, schedule)
    if pendientes > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Este horario tiene {pendientes} cita(s) futura(s). "
                f"No se puede desactivar sin gestionarlas. "
                f"Cerralo con fecha de corte o gestiona las citas primero."
            ),
        )

    schedule.activo = False
    schedule.deactivated_at = datetime.now(timezone.utc)
    schedule.deactivated_by = current_user.id
    db.commit()
    return None


# ----- Bloqueos -----


@router.get(
    "/doctors/{doctor_id}/blocks",
    response_model=list[BlockResponse],
)
def list_blocks(
    doctor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista los bloqueos de un medico."""
    _get_active_doctor(db, doctor_id)
    stmt = (
        select(Block)
        .where(Block.doctor_id == doctor_id)
        .order_by(Block.start_date)
    )
    return list(db.scalars(stmt).all())


@router.post(
    "/doctors/{doctor_id}/blocks",
    response_model=BlockResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_block_endpoint(
    doctor_id: int,
    data: BlockCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Crea un bloqueo de dias para un medico. Solo admin."""
    doctor = _get_active_doctor(db, doctor_id)
    try:
        block = create_block(db, doctor, data)
    except ScheduleServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    return block


@router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block_endpoint(
    block_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Elimina un bloqueo (borrado real). Solo admin."""
    block = db.get(Block, block_id)
    if block is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bloqueo no encontrado",
        )
    db.delete(block)
    db.commit()
    return None
@router.patch(
    "/schedules/{schedule_id}/close",
    tags=["schedules"],
)
def close_schedule_endpoint(
    schedule_id: int,
    data: ScheduleClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Cierra un horario con una fecha de corte. Solo admin.

    Devuelve el horario actualizado y la lista de citas confirmadas
    que quedan despues de la fecha de corte (para que el admin las
    gestione).
    """
    schedule = db.get(Schedule, schedule_id)
    if schedule is None or not schedule.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Horario no encontrado",
        )
    try:
        schedule, afectadas = close_schedule(
            db, schedule, data.valid_until, current_user
        )
    except ScheduleServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )

    # Armar la respuesta con el email del admin que cerro
    response = ScheduleResponse.model_validate(schedule)
    if schedule.closed_by:
        admin = db.get(User, schedule.closed_by)
        if admin:
            response.closed_by_email = admin.email

    return {
        "schedule": response,
        "affected_appointments": [
            AppointmentResponse.model_validate(c) for c in afectadas
        ],
    }
