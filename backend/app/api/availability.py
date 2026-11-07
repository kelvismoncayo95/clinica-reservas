from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.doctor import Doctor
from app.models.user import User
from app.schemas.availability import (
    AvailabilityResponse,
    AvailabilitySlot as AvailabilitySlotSchema,
    DayAvailability as DayAvailabilitySchema,
)
from app.services.availability_service import (
    MAX_RANGE_DAYS,
    get_availability,
    get_available_dates,
)


router = APIRouter(prefix="/api/v1", tags=["availability"])


@router.get(
    "/availability",
    response_model=AvailabilityResponse,
)
def get_availability_endpoint(
    doctor_id: int,
    date_param: date = Query(alias="date"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Devuelve los slots disponibles de un medico en una fecha."""
    doctor = db.get(Doctor, doctor_id)
    if doctor is None or not doctor.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medico no encontrado",
        )

    slots = get_availability(db, doctor_id, date_param)

    return AvailabilityResponse(
        doctor_id=doctor_id,
        date=date_param,
        slots=[
            AvailabilitySlotSchema(
                start_time=s.start_time,
                end_time=s.end_time,
                available=s.available,
            )
            for s in slots
        ],
    )


@router.get(
    "/doctors/{doctor_id}/available-dates",
    response_model=list[DayAvailabilitySchema],
)
def get_available_dates_endpoint(
    doctor_id: int,
    date_from: date = Query(alias="from"),
    date_to: date = Query(alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Dias del rango en los que se puede reservar con el medico.

    Lo usa el calendario para pintar en verde los dias disponibles y en
    gris los que no, con el motivo (no atiende, ausencia, completo...).
    """
    if date_to < date_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha 'to' no puede ser anterior a 'from'",
        )
    if (date_to - date_from).days > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El rango no puede superar {MAX_RANGE_DAYS} dias",
        )
    doctor = db.get(Doctor, doctor_id)
    if doctor is None or not doctor.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medico no encontrado",
        )

    days = get_available_dates(db, doctor_id, date_from, date_to)
    return [
        DayAvailabilitySchema(date=d.date, available=d.available, reason=d.reason)
        for d in days
    ]
