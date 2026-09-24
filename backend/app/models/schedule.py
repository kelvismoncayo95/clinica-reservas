from datetime import datetime, time, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"), index=True)
    day_of_week: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
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
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_schedules_day_of_week"),
        CheckConstraint("end_time > start_time", name="ck_schedules_end_after_start"),
        CheckConstraint(
            "slot_duration_minutes IN (15, 30, 45, 60)",
            name="ck_schedules_slot_duration",
        ),
    )

    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="schedules")
