from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.doctor import Doctor
from app.models.user import User
from app.schemas.availability import AvailabilityResponse, AvailabilitySlot as AvailabilitySlotSchema
from app.services.availability_service import get_availability


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
