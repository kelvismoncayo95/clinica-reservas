from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.appointment import Appointment
from app.models.block import Block
from app.models.doctor_absence import DoctorAbsence
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
    """Devuelve los horarios activos del medico para el dia de la semana.

    Solo incluye horarios cuya fecha de corte (valid_until) sea NULL
    o posterior a la fecha consultada.
    """
    day_of_week = appointment_date.weekday()
    stmt = select(Schedule).where(
        Schedule.doctor_id == doctor_id,
        Schedule.day_of_week == day_of_week,
        Schedule.activo.is_(True),
        or_(
            Schedule.valid_until.is_(None),
            Schedule.valid_until >= appointment_date,
        ),
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


# ============================================================
# Dias disponibles para el calendario
# ============================================================

MAX_RANGE_DAYS = 62  # el calendario pide un mes por vez (con margen)


class DayAvailability:
    """Un dia del calendario: si se puede reservar y, si no, por que."""

    def __init__(self, day: date, available: bool, reason: str | None = None):
        self.date = day
        self.available = available
        # Motivos posibles: "pasado", "fuera_de_rango", "no_atiende",
        # "bloqueado", "ausencia", "completo"
        self.reason = reason


def get_available_dates(
    db: Session, doctor_id: int, date_from: date, date_to: date
) -> list[DayAvailability]:
    """Dice, dia por dia, si se puede reservar con este medico.

    Usa las mismas reglas que create_appointment:
    - no se reserva en el pasado ni con menos de APPOINTMENT_MIN_HOURS_NOTICE,
    - ni con mas de APPOINTMENT_MAX_DAYS_AHEAD dias,
    - ni en dias bloqueados o de ausencia del medico,
    - y tiene que quedar al menos un horario libre.

    Para no hacer una consulta por dia, trae todo el rango de una vez
    (horarios, bloqueos, ausencias y citas) y despues calcula en memoria.
    """
    settings = get_settings()
    now = datetime.now(ZoneInfo(settings.CLINIC_TIMEZONE))
    today = now.date()
    earliest = (now + timedelta(hours=settings.APPOINTMENT_MIN_HOURS_NOTICE)).replace(tzinfo=None)
    last_allowed = today + timedelta(days=settings.APPOINTMENT_MAX_DAYS_AHEAD)

    schedules = list(db.scalars(
        select(Schedule).where(
            Schedule.doctor_id == doctor_id,
            Schedule.activo.is_(True),
            or_(Schedule.valid_until.is_(None), Schedule.valid_until >= date_from),
        )
    ).all())
    blocks = list(db.scalars(
        select(Block).where(
            Block.doctor_id == doctor_id,
            Block.start_date <= date_to,
            Block.end_date >= date_from,
        )
    ).all())
    absent_days = set(db.scalars(
        select(DoctorAbsence.absence_date).where(
            DoctorAbsence.doctor_id == doctor_id,
            DoctorAbsence.absence_date.between(date_from, date_to),
        )
    ).all())
    appointments_by_day: dict[date, list[Appointment]] = {}
    for a in db.scalars(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.status == "confirmed",
            Appointment.appointment_date.between(date_from, date_to),
        )
    ).all():
        appointments_by_day.setdefault(a.appointment_date, []).append(a)

    result: list[DayAvailability] = []
    day = date_from
    while day <= date_to:
        result.append(_day_availability(
            day, today, last_allowed, earliest, schedules, blocks,
            absent_days, appointments_by_day.get(day, []),
        ))
        day += timedelta(days=1)
    return result


def _day_availability(
    day: date,
    today: date,
    last_allowed: date,
    earliest: datetime,
    schedules: list[Schedule],
    blocks: list[Block],
    absent_days: set[date],
    appointments: list[Appointment],
) -> DayAvailability:
    if day < today:
        return DayAvailability(day, False, "pasado")
    if day > last_allowed:
        return DayAvailability(day, False, "fuera_de_rango")

    day_schedules = [
        s for s in schedules
        if s.day_of_week == day.weekday()
        and (s.valid_until is None or s.valid_until >= day)
    ]
    if not day_schedules:
        return DayAvailability(day, False, "no_atiende")
    if any(b.start_date <= day <= b.end_date for b in blocks):
        return DayAvailability(day, False, "bloqueado")
    if day in absent_days:
        return DayAvailability(day, False, "ausencia")

    for schedule in day_schedules:
        for start, end in generate_slots(
            schedule.start_time, schedule.end_time, schedule.slot_duration_minutes
        ):
            if datetime.combine(day, start) < earliest:
                continue
            occupied = any(
                ranges_overlap(start, end, a.start_time, a.end_time)
                for a in appointments
            )
            if not occupied:
                return DayAvailability(day, True)
    return DayAvailability(day, False, "completo")
