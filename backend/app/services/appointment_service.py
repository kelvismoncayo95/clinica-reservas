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


def _get_schedules_for_date(
    db: Session, doctor_id: int, appointment_date: date
) -> list[Schedule]:
    """Devuelve TODOS los horarios activos del medico para ese dia."""
    day_of_week = appointment_date.weekday()
    stmt = select(Schedule).where(
        Schedule.doctor_id == doctor_id,
        Schedule.day_of_week == day_of_week,
        Schedule.activo.is_(True),
    )
    schedules = list(db.scalars(stmt).all())
    if not schedules:
        raise AppointmentServiceError(
            "El medico no atiende ese dia de la semana"
        )
    return schedules


def _calculate_end_time(
    schedule: Schedule, start_time: time
) -> time:
    """Calcula la hora de fin sumando la duracion del slot al start."""
    start_min = start_time.hour * 60 + start_time.minute
    end_min = start_min + schedule.slot_duration_minutes
    return time(end_min // 60, end_min % 60)


def _validate_slot_exists(
    schedules: list[Schedule], start_time: time
) -> time:
    """Valida que start_time sea un slot valido de ALGUN horario del dia.

    Devuelve el end_time calculado con la duracion del horario que lo contiene.
    """
    for schedule in schedules:
        slots = generate_slots(
            schedule.start_time,
            schedule.end_time,
            schedule.slot_duration_minutes,
        )
        valid_starts = [s[0] for s in slots]
        if start_time in valid_starts:
            return _calculate_end_time(schedule, start_time)

    raise AppointmentServiceError(
        f"El horario {start_time.strftime('%H:%M')} no es un slot valido del medico"
    )


def create_appointment(
    db: Session, data: AppointmentCreate, current_user: User
) -> Appointment:
    """Crea una cita con todas las validaciones.'
    """
    # 1. Resolver el paciente
    if current_user.role == "patient":
        patient = db.scalar(
            select(Patient).where(Patient.user_id == current_user.id)
        )
        if patient is None or not patient.activo:
            raise AppointmentServiceError(
                "No se encontro tu ficha de paciente"
            )
    else:
        if data.patient_id is None:
            raise AppointmentServiceError(
                "Hay que indicar el paciente"
            )
        patient = db.get(Patient, data.patient_id)
        if patient is None or not patient.activo:
            raise AppointmentServiceError("Paciente no encontrado")

    # 2. Doctor y especialidad
    doctor = db.get(Doctor, data.doctor_id)
    if doctor is None or not doctor.activo:
        raise AppointmentServiceError("Medico no encontrado")

    specialty = db.get(Specialty, data.specialty_id)
    if specialty is None or not specialty.activo:
        raise AppointmentServiceError("Especialidad no encontrada")

    # 3. Fecha no pasada
    if is_past_datetime(data.appointment_date, data.start_time):
        raise AppointmentServiceError(
            "No se puede reservar una fecha u hora pasada"
        )

    # 4. Fecha no bloqueada
    _check_date_not_blocked(db, doctor.id, data.appointment_date)

    # 5. Horario valido y end_time
    schedules = _get_schedules_for_date(db, doctor.id, data.appointment_date)
    end_time = _validate_slot_exists(schedules, data.start_time)

    # 6. Sin superposicion
    _check_doctor_available(
        db,
        doctor_id=doctor.id,
        appointment_date=data.appointment_date,
        start_time=data.start_time,
        end_time=end_time,
    )

    # 7. Crear
    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        specialty_id=specialty.id,
        appointment_date=data.appointment_date,
        start_time=data.start_time,
        end_time=end_time,
        status="confirmed",
        created_by=current_user.id,
    )
    db.add(appointment)
    db.flush()

    log_action(
        db,
        appointment_id=appointment.id,
        action="created",
        performed_by=current_user.id,
        details=f"Cita creada para el {data.appointment_date} a las {data.start_time.strftime('%H:%M')}",
    )

    db.commit()
    db.refresh(appointment)
    return appointment


def cancel_appointment(
    db: Session, appointment: Appointment, current_user: User
) -> Appointment:
    """Cancela una cita. Solo si esta confirmada."""
    if appointment.status != "confirmed":
        raise AppointmentServiceError(
            "Solo se pueden cancelar citas confirmadas"
        )

    appointment.status = "cancelled"
    appointment.cancelled_at = datetime.now()
    appointment.cancelled_by = current_user.id

    log_action(
        db,
        appointment_id=appointment.id,
        action="cancelled",
        performed_by=current_user.id,
        details="Cita cancelada",
    )

    db.commit()
    db.refresh(appointment)
    return appointment


def reschedule_appointment(
    db: Session,
    appointment: Appointment,
    new_date: date,
    new_start_time: time,
    current_user: User,
) -> Appointment:
    """Reprograma una cita. Revalida todo como si fuera nueva."""
    if appointment.status != "confirmed":
        raise AppointmentServiceError(
            "Solo se pueden reprogramar citas confirmadas"
        )

    if is_past_datetime(new_date, new_start_time):
        raise AppointmentServiceError(
            "No se puede reprogramar a una fecha u hora pasada"
        )

    _check_date_not_blocked(db, appointment.doctor_id, new_date)
    schedules = _get_schedules_for_date(db, appointment.doctor_id, new_date)
    new_end_time = _validate_slot_exists(schedules, new_start_time)

    _check_doctor_available(
        db,
        doctor_id=appointment.doctor_id,
        appointment_date=new_date,
        start_time=new_start_time,
        end_time=new_end_time,
        exclude_appointment_id=appointment.id,
    )

    old_date = appointment.appointment_date
    old_start = appointment.start_time

    appointment.appointment_date = new_date
    appointment.start_time = new_start_time
    appointment.end_time = new_end_time

    log_action(
        db,
        appointment_id=appointment.id,
        action="rescheduled",
        performed_by=current_user.id,
        details=(
            f"De {old_date} {old_start.strftime('%H:%M')} "
            f"a {new_date} {new_start_time.strftime('%H:%M')}"
        ),
    )

    db.commit()
    db.refresh(appointment)
    return appointment


def update_status(
    db: Session,
    appointment: Appointment,
    new_status: str,
    current_user: User,
) -> Appointment:
    """Cambia el estado. Solo confirmed -> attended o no_show."""
    if appointment.status != "confirmed":
        raise AppointmentServiceError(
            "Solo se puede cambiar el estado de citas confirmadas"
        )

    if new_status not in ("attended", "no_show"):
        raise AppointmentServiceError(
            "Estado invalido. Solo attended o no_show"
        )

    # No se puede marcar asistencia antes de que la cita haya ocurrido
    appointment_dt = datetime.combine(
        appointment.appointment_date, appointment.start_time
    )
    if appointment_dt > datetime.now():
        raise AppointmentServiceError(
            "No podes marcar asistencia antes de que la cita haya ocurrido"
        )

    old_status = appointment.status
    appointment.status = new_status

    log_action(
        db,
        appointment_id=appointment.id,
        action="status_changed",
        performed_by=current_user.id,
        details=f"De {old_status} a {new_status}",
    )

    db.commit()
    db.refresh(appointment)
    return appointment
