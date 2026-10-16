from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin, require_reception_or_admin
from app.database import get_db
from app.models.doctor import Doctor
from app.models.doctor_absence import DoctorAbsence
from app.models.user import User
from app.schemas.doctor_absence import (
    DoctorAbsenceCreate,
    DoctorAbsenceResolve,
    DoctorAbsenceResponse,
)


router = APIRouter(prefix="/api/v1", tags=["absences"])


def _get_current_doctor(db: Session, current_user: User) -> Doctor:
    """Devuelve el Doctor asociado al usuario logueado."""
    doctor = db.scalar(
        select(Doctor).where(Doctor.user_id == current_user.id)
    )
    if doctor is None or not doctor.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontro tu ficha de medico",
        )
    return doctor


def _enrich_absence(
    db: Session, absence: DoctorAbsence
) -> DoctorAbsenceResponse:
    """Convierte una ausencia en DoctorAbsenceResponse con datos extra."""
    response = DoctorAbsenceResponse.model_validate(absence)

    doctor = db.get(Doctor, absence.doctor_id)
    if doctor:
        response.doctor_name = f"{doctor.last_name}, {doctor.first_name}"

    notifier = db.get(User, absence.notified_by)
    if notifier:
        response.notified_by_email = notifier.email

    return response


@router.post(
    "/doctors/me/notify-absence",
    response_model=DoctorAbsenceResponse,
    status_code=status.HTTP_201_CREATED,
)
def notify_absence(
    data: DoctorAbsenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El medico avisa que no va a asistir en una fecha. Solo medicos."""
    if current_user.role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los medicos pueden notificar ausencias",
        )

    doctor = _get_current_doctor(db, current_user)

    if data.absence_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podes notificar una ausencia en el pasado",
        )

    existente = db.scalar(
        select(DoctorAbsence).where(
            DoctorAbsence.doctor_id == doctor.id,
            DoctorAbsence.absence_date == data.absence_date,
            DoctorAbsence.resolved_at.is_(None),
        )
    )
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya notificaste una ausencia para esa fecha",
        )

    absence = DoctorAbsence(
        doctor_id=doctor.id,
        absence_date=data.absence_date,
        reason=data.reason,
        notified_by=current_user.id,
    )
    db.add(absence)
    db.commit()
    db.refresh(absence)
    return _enrich_absence(db, absence)


@router.get(
    "/absences",
    response_model=list[DoctorAbsenceResponse],
)
def list_absences(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_reception_or_admin),
):
    """Lista ausencias. Filtros: ?status_filter=pending|seen|resolved."""
    stmt = select(DoctorAbsence).order_by(
        DoctorAbsence.absence_date.desc()
    )

    if status_filter == "pending":
        stmt = stmt.where(DoctorAbsence.seen_at.is_(None))
    elif status_filter == "seen":
        stmt = stmt.where(
            DoctorAbsence.seen_at.is_not(None),
            DoctorAbsence.resolved_at.is_(None),
        )
    elif status_filter == "resolved":
        stmt = stmt.where(DoctorAbsence.resolved_at.is_not(None))

    ausencias = list(db.scalars(stmt).all())
    return [_enrich_absence(db, a) for a in ausencias]

@router.patch(
    "/absences/{absence_id}/mark-seen",
    response_model=DoctorAbsenceResponse,
)
def mark_absence_seen(
    absence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reception_or_admin),
):
    """Marca una ausencia como vista por recepcion."""
    absence = db.get(DoctorAbsence, absence_id)
    if absence is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ausencia no encontrada",
        )

    if absence.seen_at is None:
        absence.seen_at = datetime.now(timezone.utc)
        absence.seen_by = current_user.id
        db.commit()
        db.refresh(absence)

    return _enrich_absence(db, absence)


@router.patch(
    "/absences/{absence_id}/resolve",
    response_model=DoctorAbsenceResponse,
)
def resolve_absence(
    absence_id: int,
    data: DoctorAbsenceResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reception_or_admin),
):
    """Marca una ausencia como resuelta."""
    absence = db.get(DoctorAbsence, absence_id)
    if absence is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ausencia no encontrada",
        )

    if absence.resolved_at is None:
        absence.resolved_at = datetime.now(timezone.utc)
        absence.resolved_by = current_user.id
        # Si nunca se marco como vista, marcarla ahora
        if absence.seen_at is None:
            absence.seen_at = absence.resolved_at
            absence.seen_by = current_user.id
        if data.reason:
            absence.reason = (absence.reason or "") + " | " + data.reason
        db.commit()
        db.refresh(absence)

    return _enrich_absence(db, absence)


@router.get(
    "/doctors/me/absences",
    response_model=list[DoctorAbsenceResponse],
)
def my_absences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve las ausencias notificadas por el medico logueado."""
    if current_user.role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los medicos tienen este endpoint",
        )

    doctor = _get_current_doctor(db, current_user)

    stmt = (
        select(DoctorAbsence)
        .where(DoctorAbsence.doctor_id == doctor.id)
        .order_by(DoctorAbsence.absence_date.desc())
    )
    ausencias = list(db.scalars(stmt).all())
    return [_enrich_absence(db, a) for a in ausencias]
