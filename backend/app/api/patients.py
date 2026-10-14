from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin, require_reception_or_admin
from app.database import get_db
from app.models.patient import Patient
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate
from app.services.auth_service import AuthServiceError, register_patient


router = APIRouter(prefix="/api/v1/patients", tags=["patients"])


def _get_accessible_patient(
    patient_id: int,
    current_user: User,
    db: Session,
) -> Patient:
    """Devuelve el paciente si el usuario tiene acceso. 404 si no."""
    if current_user.role in ("admin", "reception"):
        patient = db.get(Patient, patient_id)
    elif current_user.role == "patient":
        patient = db.scalar(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.user_id == current_user.id,
            )
        )
    else:
        patient = None

    if patient is None or not patient.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado",
        )
    return patient


@router.get("", response_model=list[PatientResponse])
def list_patients(
    db: Session = Depends(get_db),
    _: User = Depends(require_reception_or_admin),
):
    """Lista todos los pacientes activos. Solo admin y recepcion."""
    stmt = select(Patient).where(Patient.activo.is_(True)).order_by(Patient.last_name)
    return list(db.scalars(stmt).all())


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve un paciente. Admin/recepcion cualquiera, paciente solo el suyo."""
    return _get_accessible_patient(patient_id, current_user, db)


@router.post(
    "",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_patient(
    data: PatientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_reception_or_admin),
):
    """Crea un paciente desde el panel. Solo admin y recepcion."""
    try:
        patient = register_patient(db, data)
    except AuthServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(e)
        )
    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: int,
    data: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Modifica un paciente. Admin/recepcion cualquiera, paciente solo el suyo."""
    patient = _get_accessible_patient(patient_id, current_user, db)

    update_data = data.model_dump(exclude_unset=True)

    if "activo" in update_data and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo admin puede cambiar el estado activo",
        )

    for field, value in update_data.items():
        setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return patient


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Desactiva un paciente (soft delete). Solo admin."""
    patient = db.get(Patient, patient_id)
    if patient is None or not patient.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado",
        )

    patient.activo = False
    patient.deactivated_at = datetime.now(timezone.utc)
    patient.deactivated_by = current_user.id
    db.commit()
    return None
