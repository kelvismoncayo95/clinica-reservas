from datetime import date, datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.block import Block
from app.models.schedule import Schedule
from app.services.time_utils import generate_slots, ranges_overlap


class AvailabilitySlot:
    """Representa un slot con su disponibilidad."""

    def __init__(
        self, start_time: time, end_time: time, available: bool
    ):
        self.start_time = start_time
        self.end_time = end_time
        self.available = available


def _get_schedules_for_date(
    db: Session, doctor_id: int, appointment_date: date
) -> list[Schedule]:
    """Devuelve los horarios activos del medico para el dia de la semana."""
    day_of_week = appointment_date.weekday()
    stmt = select(Schedule).where(
        Schedule.doctor_id == doctor_id,
        Schedule.day_of_week == day_of_week,
        Schedule.activo.is_(True),
    )
    return list(db.scalars(stmt).all())


def _is_blocked(
    db: Session, doctor_id: int, appointment_date: date
) -> bool:
    """True si la fecha cae dentro de algun bloqueo del medico."""
    stmt = select(Block).where(
        Block.doctor_id == doctor_id,
        Block.start_date <= appointment_date,
        Block.end_date >= appointment_date,
    )
    return db.scalar(stmt) is not None


def _get_confirmed_appointments(
    db: Session, doctor_id: int, appointment_date: date
) -> list[Appointment]:
    """Citas confirmadas del medico en ese dia."""
    stmt = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appointment_date,
        Appointment.status == "confirmed",
    )
    return list(db.scalars(stmt).all())


def _is_past(appointment_date: date) -> bool:
    """True si la fecha es anterior a hoy."""
    return appointment_date < date.today()


def get_availability(
    db: Session, doctor_id: int, appointment_date: date
) -> list[AvailabilitySlot]:
    """Calcula los slots del dia con su disponibilidad."""
    if _is_blocked(db, doctor_id, appointment_date):
        return []

    schedules = _get_schedules_for_date(
        db, doctor_id, appointment_date
    )
    if not schedules:
        return []

    appointments = _get_confirmed_appointments(
        db, doctor_id, appointment_date
    )

    is_past = _is_past(appointment_date)

    slots: list[AvailabilitySlot] = []
    for schedule in schedules:
        for start, end in generate_slots(
            schedule.start_time,
            schedule.end_time,
            schedule.slot_duration_minutes,
        ):
            occupied = any(
                ranges_overlap(start, end, a.start_time, a.end_time)
                for a in appointments
            )
            available = not occupied and not is_past
            slots.append(AvailabilitySlot(start, end, available))

    return slots
