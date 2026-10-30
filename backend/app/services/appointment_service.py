from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
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
from app.core.config import get_settings
from app.services.email_service import enviar_email
from app.services.email_templates import get_email_reserva, get_email_cancelacion, get_email_reprogramacion
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

    # 1b. Reglas de negocio de reserva
    settings = get_settings()
    now = datetime.now(timezone.utc)

    # Anticipacion minima
    appointment_dt = datetime.combine(
        data.appointment_date, data.start_time, tzinfo=timezone.utc
    )
    hours_until = (appointment_dt - now).total_seconds() / 3600
    if hours_until < settings.APPOINTMENT_MIN_HOURS_NOTICE:
        raise AppointmentServiceError(
            f"El turno debe reservarse con al menos "
            f"{settings.APPOINTMENT_MIN_HOURS_NOTICE} hora(s) de anticipacion"
        )

    # Anticipacion maxima
    days_until = hours_until / 24
    if days_until > settings.APPOINTMENT_MAX_DAYS_AHEAD:
        raise AppointmentServiceError(
            f"No se puede reservar con mas de "
            f"{settings.APPOINTMENT_MAX_DAYS_AHEAD} dias de anticipacion"
        )

    # Maximo de citas futuras por paciente
    future_count = db.scalar(
        select(func.count(Appointment.id)).where(
            Appointment.patient_id == patient.id,
            Appointment.status == "confirmed",
            Appointment.appointment_date >= now.date(),
        )
    )
    if future_count >= settings.APPOINTMENT_MAX_FUTURE_PER_PATIENT:
        raise AppointmentServiceError(
            f"Ya tenes {settings.APPOINTMENT_MAX_FUTURE_PER_PATIENT} citas "
            f"futuras. No podes reservar mas."
        )

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

    # ENVÍO DE EMAIL AL PACIENTE
    try:
        asunto, html = get_email_reserva(
            patient_name=f"{patient.last_name}, {patient.first_name}",
            doctor_name=f"{doctor.last_name}, {doctor.first_name}",
            specialty=specialty.name,
            date=data.appointment_date.strftime("%d/%m/%Y"),
            time=data.start_time.strftime("%H:%M")
        )
        enviar_email(patient.email, asunto, html)
    except Exception as e:
        print(f"Error enviando email de reserva al paciente: {e}")

    # ENVÍO DE EMAIL AL MÉDICO
    try:
        doctor_user = db.get(User, doctor.user_id)
        if doctor_user and doctor_user.email:
            asunto_med, html_med = get_email_reserva(
                patient_name=f"{patient.last_name}, {patient.first_name}",
                doctor_name=f"{doctor.last_name}, {doctor.first_name}",
                specialty=specialty.name,
                date=data.appointment_date.strftime("%d/%m/%Y"),
                time=data.start_time.strftime("%H:%M")
            )
            html_med = html_med.replace("Hola", "Dr/a.")
            enviar_email(doctor_user.email, asunto_med, html_med)
    except Exception as e:
        print(f"Error enviando email al médico: {e}")

    return appointment


def cancel_appointment(
    db: Session, appointment: Appointment, current_user: User
) -> Appointment:
    """Cancela una cita. Solo si esta confirmada."""
    if appointment.status != "confirmed":
        raise AppointmentServiceError(
            "Solo se pueden cancelar citas confirmadas"
        )

    # Regla de anticipacion minima solo para pacientes
    if current_user.role == "patient":
        settings = get_settings()
        now = datetime.now(timezone.utc)
        appointment_dt = datetime.combine(
            appointment.appointment_date,
            appointment.start_time,
            tzinfo=timezone.utc,
        )
        hours_until = (appointment_dt - now).total_seconds() / 3600
        if hours_until < settings.APPOINTMENT_MIN_HOURS_CANCEL_PATIENT:
            raise AppointmentServiceError(
                f"No podes cancelar con menos de "
                f"{settings.APPOINTMENT_MIN_HOURS_CANCEL_PATIENT} horas "
                f"de anticipacion. Comunicate con recepcion."
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

    # ENVÍO DE EMAIL AL PACIENTE
    try:
        patient = db.get(Patient, appointment.patient_id)
        if patient and patient.email:
            asunto, html = get_email_cancelacion(
                patient_name=f"{patient.last_name}, {patient.first_name}",
                date=appointment.appointment_date.strftime("%d/%m/%Y"),
                time=appointment.start_time.strftime("%H:%M")
            )
            enviar_email(patient.email, asunto, html)
    except Exception as e:
        print(f"Error enviando email de cancelación: {e}")

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

    # ENVÍO DE EMAIL AL PACIENTE
    try:
        patient = db.get(Patient, appointment.patient_id)
        if patient and patient.email:
            asunto, html = get_email_reprogramacion(
                patient_name=f"{patient.last_name}, {patient.first_name}",
                old_date=old_date.strftime("%d/%m/%Y"),
                old_time=old_start.strftime("%H:%M"),
                new_date=new_date.strftime("%d/%m/%Y"),
                new_time=new_start_time.strftime("%H:%M")
            )
            enviar_email(patient.email, asunto, html)
    except Exception as e:
        print(f"Error enviando email de reprogramación: {e}")

    return appointment


def update_status(
    db: Session,
    appointment: Appointment,
    new_status: str,
    current_user: User,
) -> Appointment:
    """Cambia el estado de la cita.

    Transiciones validas:
    - confirmed -> attended
    - confirmed -> no_show
    - attended -> confirmed (solo dentro de las 2 horas)
    - no_show -> confirmed (solo dentro de las 2 horas)
    """
    valid_statuses = ("confirmed", "attended", "no_show")
    if new_status not in valid_statuses:
        raise AppointmentServiceError(
            "Estado invalido. Solo confirmed, attended o no_show"
        )

    old_status = appointment.status

    if old_status == "confirmed":
        # Marcando asistencia
        if new_status == "confirmed":
            raise AppointmentServiceError(
                "La cita ya esta confirmada"
            )
        # No se puede marcar asistencia antes de que la cita haya ocurrido
        appointment_dt = datetime.combine(
            appointment.appointment_date, appointment.start_time
        )
        if appointment_dt > datetime.now():
            raise AppointmentServiceError(
                "No podes marcar asistencia antes de que la cita haya ocurrido"
            )

    elif old_status in ("attended", "no_show"):
        # Deshaciendo
        if new_status != "confirmed":
            raise AppointmentServiceError(
                "Solo se puede volver al estado confirmado"
            )
        # Verificar que hayan pasado menos de 2 horas desde el cambio
        last_log = db.scalar(
            select(AppointmentLog)
            .where(
                AppointmentLog.appointment_id == appointment.id,
                AppointmentLog.action == "status_changed",
            )
            .order_by(AppointmentLog.created_at.desc())
        )
        if last_log is None:
            raise AppointmentServiceError(
                "No hay registro del cambio de estado"
            )
        delta = datetime.now(timezone.utc) - last_log.created_at
        if delta.total_seconds() > 2 * 3600:
            raise AppointmentServiceError(
                "Ya pasaron mas de 2 horas. No se puede deshacer"
            )
    else:
        raise AppointmentServiceError(
            f"No se puede cambiar el estado desde {old_status}"
        )

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
