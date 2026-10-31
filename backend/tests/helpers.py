from datetime import date, time

from app.core.security import hash_password
from app.database import SessionLocal
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.schedule import Schedule
from app.models.specialty import Specialty
from app.models.user import User


def _get_db():
    return SessionLocal()


def crear_especialidad(nombre: str) -> Specialty:
    db = _get_db()
    esp = Specialty(name=nombre)
    db.add(esp)
    db.commit()
    db.refresh(esp)
    db.close()
    return esp


def crear_paciente(email: str, password: str = "prueba123", dni: str = "12345678") -> tuple[User, Patient]:
    db = _get_db()
    user = User(
        email=email,
        password_hash=hash_password(password),
        role="patient",
    )
    db.add(user)
    db.flush()

    patient = Patient(
        user_id=user.id,
        first_name="Test",
        last_name="Paciente",
        dni=dni,
        birth_date=date(1990, 1, 1),
        phone="099111222",
        email=email,
    )
    db.add(patient)
    db.commit()
    db.refresh(user)
    db.refresh(patient)
    db.close()
    return user, patient


def crear_medico(
    email: str,
    password: str = "prueba123",
    license_number: str = "MP-TEST-01",
    specialty_id: int | None = None,
) -> User:
    db = _get_db()
    user = User(
        email=email,
        password_hash=hash_password(password),
        role="doctor",
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        first_name="Test",
        last_name="Médico",
        license_number=license_number,
        email=email,
    )
    db.add(doctor)
    db.flush()

    if specialty_id:
        esp = db.get(Specialty, specialty_id)
        if esp:
            doctor.specialties.append(esp)

    # Horario de lunes a viernes de 9 a 17
    for dia in range(5):
        db.add(Schedule(
            doctor_id=doctor.id,
            day_of_week=dia,
            start_time=time(9, 0),
            end_time=time(17, 0),
            slot_duration_minutes=30,
        ))

    db.commit()
    db.refresh(user)
    db.close()
    return user


def crear_admin(email: str = "admin@test.com", password: str = "admin123") -> User:
    db = _get_db()
    user = User(
        email=email,
        password_hash=hash_password(password),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def crear_medico_full(
    email: str,
    password: str = "prueba123",
    license_number: str = "MP-FULL-01",
    specialty_id: int | None = None,
) -> User:
    """Médico que atiende los 7 días de la semana, de 9 a 17."""
    db = _get_db()
    user = User(
        email=email,
        password_hash=hash_password(password),
        role="doctor",
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        first_name="Test",
        last_name="Full",
        license_number=license_number,
        email=email,
    )
    db.add(doctor)
    db.flush()

    if specialty_id:
        esp = db.get(Specialty, specialty_id)
        if esp:
            doctor.specialties.append(esp)

    # Horario los 7 días
    for dia in range(7):
        db.add(Schedule(
            doctor_id=doctor.id,
            day_of_week=dia,
            start_time=time(9, 0),
            end_time=time(17, 0),
            slot_duration_minutes=30,
        ))

    db.commit()
    db.refresh(user)
    db.close()
    return user


def crear_medico_sin_especialidad(
    email: str,
    password: str = "prueba123",
    license_number: str = "MP-NO-ESP",
) -> User:
    db = _get_db()
    user = User(
        email=email,
        password_hash=hash_password(password),
        role="doctor",
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        first_name="Test",
        last_name="SinEspecialidad",
        license_number=license_number,
        email=email,
    )
    db.add(doctor)
    db.flush()

    # Horario de lunes a viernes
    for dia in range(5):
        db.add(Schedule(
            doctor_id=doctor.id,
            day_of_week=dia,
            start_time=time(9, 0),
            end_time=time(17, 0),
            slot_duration_minutes=30,
        ))

    db.commit()
    db.refresh(user)
    db.close()
    return user
