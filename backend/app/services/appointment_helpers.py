from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.specialty import Specialty
from app.schemas.appointment import AppointmentResponse


def enrich_appointment(
    db: Session, appointment: Appointment
) -> AppointmentResponse:
    """Convierte una cita en AppointmentResponse incluyendo nombres."""
    patient = db.get(Patient, appointment.patient_id)
    doctor = db.get(Doctor, appointment.doctor_id)
    specialty = db.get(Specialty, appointment.specialty_id)

    return AppointmentResponse(
        id=appointment.id,
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        specialty_id=appointment.specialty_id,
        appointment_date=appointment.appointment_date,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        status=appointment.status,
        created_by=appointment.created_by,
        cancelled_at=appointment.cancelled_at,
        cancelled_by=appointment.cancelled_by,
        created_at=appointment.created_at,
        updated_at=appointment.updated_at,
        patient_name=(
            f"{patient.last_name}, {patient.first_name}"
            if patient else None
        ),
        doctor_name=(
            f"{doctor.last_name}, {doctor.first_name}"
            if doctor else None
        ),
        specialty_name=(specialty.name if specialty else None),
    )


def enrich_appointments(
    db: Session, appointments: list[Appointment]
) -> list[AppointmentResponse]:
    """Version en lote de enrich_appointment."""
    return [enrich_appointment(db, a) for a in appointments]
