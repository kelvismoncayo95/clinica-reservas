from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DoctorAbsence(Base):
    __tablename__ = "doctor_absences"

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"), index=True)
    absence_date: Mapped[date] = mapped_column(Date, index=True)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    notified_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    seen_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    doctor: Mapped["Doctor"] = relationship(
        "Doctor", foreign_keys=[doctor_id]
    )
    notified_by_user: Mapped["User"] = relationship(
        "User", foreign_keys=[notified_by]
    )
    seen_by_user: Mapped["User | None"] = relationship(
        "User", foreign_keys=[seen_by]
    )
    resolved_by_user: Mapped["User | None"] = relationship(
        "User", foreign_keys=[resolved_by]
    )
