from sqlalchemy import Column, ForeignKey, Integer, Table

from app.database import Base


doctor_specialties = Table(
    "doctor_specialties",
    Base.metadata,
    Column("doctor_id", Integer, ForeignKey("doctors.id"), primary_key=True),
    Column("specialty_id", Integer, ForeignKey("specialties.id"), primary_key=True),
)
