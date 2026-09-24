from datetime import date, datetime, time, timezone

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"), index=True)
    specialty_id: Mapped[int] = mapped_column(ForeignKey("specialties.id"))
    appointment_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    status: Mapped[str] = mapped_column(
        String(20), default="confirmed", server_default="confirmed", index=True
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        CheckConstraint("end_time > start_time", name="ck_appointments_end_after_start"),
        CheckConstraint(
            "status IN ('confirmed', 'cancelled', 'attended', 'no_show')",
            name="ck_appointments_status",
        ),
    )

    patient: Mapped["Patient"] = relationship("Patient", back_populates="appointments")
    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="appointments")
    specialty: Mapped["Specialty"] = relationship("Specialty", back_populates="appointments")
    created_by_user: Mapped["User"] = relationship(
        "User", foreign_keys=[created_by]
    )
    cancelled_by_user: Mapped["User | None"] = relationship(
        "User", foreign_keys=[cancelled_by]
    )
    logs: Mapped[list["AppointmentLog"]] = relationship(
        "AppointmentLog", back_populates="appointment"
    )
