from datetime import date, datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.block import Block
from app.models.doctor import Doctor
from app.models.appointment import Appointment
from app.models.schedule import Schedule
from app.schemas.block import BlockCreate
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate
from app.schemas.appointment import AppointmentResponse
from app.services.appointment_helpers import enrich_appointments
from app.services.time_utils import ranges_overlap


ALLOWED_DURATIONS = (15, 30, 45, 60)


class ScheduleServiceError(Exception):
    """Error de negocio del servicio de horarios."""
    pass


def validate_slot_duration(minutes: int) -> None:
    """Valida que la duracion sea 15, 30, 45 o 60."""
    if minutes not in ALLOWED_DURATIONS:
        raise ScheduleServiceError(
            f"La duracion debe ser una de: {list(ALLOWED_DURATIONS)}"
        )


def check_schedule_overlap(
    db: Session,
    doctor_id: int,
    day_of_week: int,
    start_time: time,
    end_time: time,
    exclude_id: int | None = None,
) -> None:
    """Lanza error si el nuevo horario se superpone con otro activo del mismo medico."""
    stmt = select(Schedule).where(
        Schedule.doctor_id == doctor_id,
        Schedule.day_of_week == day_of_week,
        Schedule.activo.is_(True),
    )
    if exclude_id is not None:
        stmt = stmt.where(Schedule.id != exclude_id)

    existing = list(db.scalars(stmt).all())
    for s in existing:
        if ranges_overlap(start_time, end_time, s.start_time, s.end_time):
            raise ScheduleServiceError(
                f"Se superpone con un horario existente: "
                f"{s.start_time.strftime('%H:%M')} a "
                f"{s.end_time.strftime('%H:%M')}"
            )


def create_schedule(
    db: Session, doctor: Doctor, data: ScheduleCreate
) -> Schedule:
    """Crea un horario semanal para un medico."""
    if data.end_time <= data.start_time:
        raise ScheduleServiceError(
            "La hora de fin debe ser mayor que la de inicio"
        )

    validate_slot_duration(data.slot_duration_minutes)
    check_schedule_overlap(
        db,
        doctor_id=doctor.id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
    )

    schedule = Schedule(
        doctor_id=doctor.id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        slot_duration_minutes=data.slot_duration_minutes,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


def update_schedule(
    db: Session, schedule: Schedule, data: ScheduleUpdate
) -> Schedule:
    """Modifica un horario. Revalida superposiciones."""
    update_data = data.model_dump(exclude_unset=True)

    new_start = update_data.get("start_time", schedule.start_time)
    new_end = update_data.get("end_time", schedule.end_time)
    new_day = update_data.get("day_of_week", schedule.day_of_week)
    new_duration = update_data.get(
        "slot_duration_minutes", schedule.slot_duration_minutes
    )

    if new_end <= new_start:
        raise ScheduleServiceError(
            "La hora de fin debe ser mayor que la de inicio"
        )

    validate_slot_duration(new_duration)
    check_schedule_overlap(
        db,
        doctor_id=schedule.doctor_id,
        day_of_week=new_day,
        start_time=new_start,
        end_time=new_end,
        exclude_id=schedule.id,
    )

    for field, value in update_data.items():
        setattr(schedule, field, value)

    db.commit()
    db.refresh(schedule)
    return schedule


def create_block(
    db: Session, doctor: Doctor, data: BlockCreate
) -> Block:
    """Crea un bloqueo de dias para un medico."""
    if data.end_date < data.start_date:
        raise ScheduleServiceError(
            "La fecha de fin debe ser mayor o igual a la de inicio"
        )

    block = Block(
        doctor_id=doctor.id,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


def close_schedule(
    db: Session, schedule: Schedule, end_date: date
) -> tuple[Schedule, list[Appointment]]:
    """Establece fecha de corte para un horario.

    Devuelve el horario actualizado y la lista de citas confirmadas
    que quedan despues de end_date (las que el admin tiene que
    gestionar).
    """
    if end_date < date.today():
        raise ScheduleServiceError(
            "La fecha de corte no puede ser en el pasado"
        )

    # Buscar citas confirmadas despues de la fecha de corte,
    # del mismo doctor, en el mismo dia de la semana
    stmt = select(Appointment).where(
        Appointment.doctor_id == schedule.doctor_id,
        Appointment.status == "confirmed",
        Appointment.appointment_date > end_date,
    )
    candidatas = list(db.scalars(stmt).all())

    # Filtrar solo las que caen en el mismo dia de la semana
    afectadas = [
        c for c in candidatas
        if c.appointment_date.weekday() == schedule.day_of_week
    ]

    schedule.valid_until = end_date
    db.commit()
    db.refresh(schedule)
    return schedule, afectadas



def count_future_appointments(
    db: Session, schedule: Schedule
) -> int:
    """Cuenta las citas confirmadas futuras de este horario.

    Solo cuenta las que caen en el mismo dia de la semana del horario
    y tienen fecha >= hoy.
    """
    hoy = date.today()
    stmt = select(Appointment).where(
        Appointment.doctor_id == schedule.doctor_id,
        Appointment.status == "confirmed",
        Appointment.appointment_date >= hoy,
    )
    candidatas = list(db.scalars(stmt).all())
    return sum(
        1 for c in candidatas
        if c.appointment_date.weekday() == schedule.day_of_week
    )