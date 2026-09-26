from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.database import get_db
from app.models.specialty import Specialty
from app.models.user import User
from app.schemas.specialty import (
    SpecialtyCreate,
    SpecialtyResponse,
    SpecialtyUpdate,
)


router = APIRouter(prefix="/api/v1/specialties", tags=["specialties"])


@router.get("", response_model=list[SpecialtyResponse])
def list_specialties(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista todas las especialidades activas."""
    stmt = select(Specialty).where(Specialty.activo.is_(True)).order_by(Specialty.name)
    return list(db.scalars(stmt).all())


@router.get("/{specialty_id}", response_model=SpecialtyResponse)
def get_specialty(
    specialty_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Devuelve una especialidad por id."""
    specialty = db.get(Specialty, specialty_id)
    if specialty is None or not specialty.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Especialidad no encontrada",
        )
    return specialty


@router.post(
    "",
    response_model=SpecialtyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_specialty(
    data: SpecialtyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Crea una especialidad nueva. Solo admin."""
    existing = db.scalar(select(Specialty).where(Specialty.name == data.name))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una especialidad con ese nombre",
        )

    specialty = Specialty(name=data.name, description=data.description)
    db.add(specialty)
    db.commit()
    db.refresh(specialty)
    return specialty


@router.put("/{specialty_id}", response_model=SpecialtyResponse)
def update_specialty(
    specialty_id: int,
    data: SpecialtyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Modifica una especialidad. Solo admin."""
    specialty = db.get(Specialty, specialty_id)
    if specialty is None or not specialty.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Especialidad no encontrada",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != specialty.name:
        existing = db.scalar(
            select(Specialty).where(
                Specialty.name == update_data["name"],
                Specialty.id != specialty.id,
            )
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe otra especialidad con ese nombre",
            )

    for field, value in update_data.items():
        setattr(specialty, field, value)

    db.commit()
    db.refresh(specialty)
    return specialty


@router.delete("/{specialty_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_specialty(
    specialty_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Desactiva una especialidad (soft delete). Solo admin."""
    specialty = db.get(Specialty, specialty_id)
    if specialty is None or not specialty.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Especialidad no encontrada",
        )

    specialty.activo = False
    db.commit()
    return None
