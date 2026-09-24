from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AppointmentLog(Base):
    __tablename__ = "appointment_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id"), index=True
    )
    action: Mapped[str] = mapped_column(String(30))
    performed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    details: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        CheckConstraint(
            "action IN ('created', 'cancelled', 'rescheduled', 'status_changed')",
            name="ck_appointment_logs_action",
        ),
    )

    appointment: Mapped["Appointment"] = relationship(
        "Appointment", back_populates="logs"
    )
    performed_by_user: Mapped["User"] = relationship("User")
