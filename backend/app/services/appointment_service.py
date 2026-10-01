from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.appointment_log import AppointmentLog
from app.models.block import Block
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.schedule import Schedule
from app.models.specialty import Specialty
from app.models.user import User
from app.schemas.appointment import AppointmentCreate
from app.services.time_utils import (
    generate_slots,
    is_past_datetime,
    ranges_overlap,
)


class AppointmentServiceError(Exception):
    """Error de negocio del servicio de citas."""
    pass


def log_action(
    db: Session,
    appointment_id: int,
    action: str,
    performed_by: int,
    details: str | None = None,
) -> None:
    """Registra una accion en el historial de la cita."""
    log = AppointmentLog(
        appointment_id=appointment_id,
        action=action,
        performed_by=performed_by,
        details=details,
    )
    db.add(log)


def _check_doctor_available(
    db: Session,
    doctor_id: int,
    appointment_date: date,
    start_time: time,
    end_time: time,
    exclude_appointment_id: int | None = None,
) -> None:
    """Lanza error si ya existe una cita confirmada que se superpone."""
    stmt = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appointment_date,
        Appointment.status == "confirmed",
    )
    if exclude_appointment_id is not None:
        stmt = stmt.where(Appointment.id != exclude_appointment_id)

    existing = list(db.scalars(stmt).all())
    for appt in existing:
        if ranges_overlap(start_time, end_time, appt.start_time, appt.end_time):
            raise AppointmentServiceError(
                f"Ese horario ya fue reservado"
            )


def _check_date_not_blocked(
    db: Session, doctor_id: int, appointment_date: date
) -> None:
    """Lanza error si la fecha esta dentro de un bloqueo del medico."""
    stmt = select(Block).where(
        Block.doctor_id == doctor_id,
        Block.start_date <= appointment_date,
        Block.end_date >= appointment_date,
    )
    block = db.scalar(stmt)
    if block is not None:
        raise AppointmentServiceError(
            f"El medico no atiende esa fecha ({block.reason or 'bloqueado'})"
        )


def _get_schedule_for_date(
    db: Session, doctor_id: int, appointment_date: date
) -> Schedule:
    """Devuelve el Schedule activo del medico para el dia de la semana de esa fecha."""
    day_of_week = appointment_date.weekday()
    stmt = select(Schedule).where(
        Schedule.doctor_id == doctor_id,
        Schedule.day_of_week == day_of_week,
        Schedule.activo.is_(True),
    )
    schedule = db.scalar(stmt)
    if schedule is None:
        raise AppointmentServiceError(
            "El medico no atiende ese dia de la semana"
        )
    return schedule


def _calculate_end_time(
    schedule: Schedule, start_time: time
) -> time:
    """Calcula la hora de fin sumando la duracion del slot al start."""
    start_min = start_time.hour * 60 + start_time.minute
    end_min = start_min + schedule.slot_duration_minutes
    return time(end_min // 60, end_min % 60)


def _validate_slot_exists(
    schedule: Schedule, start_time: time
) -> time:
    """Valida que el start_time sea un slot valido del horario, y devuelve end_time."""
    slots = generate_slots(
        schedule.start_time,
        schedule.end_time,
        schedule.slot_duration_minutes,
    )
    valid_starts = [s[0] for s in slots]
    if start_time not in valid_starts:
        raise AppointmentServiceError(
            f"El horario {start_time.strftime('%H:%M')} no es un slot valido del medico"
        )
    end_time = _calculate_end_time(schedule, start_time)
    return end_time
