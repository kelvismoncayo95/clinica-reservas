"""Carga inicial de datos de la clinica."""

import sys
from pathlib import Path

# Agregar el directorio padre (backend/) al path de Python
# para que encuentre el modulo `app`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import time

from sqlalchemy import select

from app.core.security import hash_password
from app.database import SessionLocal
from app.models.doctor import Doctor
from app.models.doctor_specialty import doctor_specialties
from app.models.schedule import Schedule
from app.models.specialty import Specialty
from app.models.user import User


PASSWORD_INICIAL = "clinicadelsur2026"


ESPECIALIDADES = [
    ("Clinica Medica", "Atencion medica general"),
    ("Cardiologia", "Especialidad del corazon"),
    ("Dermatologia", "Especialidad de la piel"),
    ("Pediatria", "Atencion de ninos y adolescentes"),
    ("Ginecologia", "Salud de la mujer"),
    ("Traumatologia", "Lesiones y sistema musculoesqueletico"),
]


MEDICOS = [
    {
        "first_name": "Martin",
        "last_name": "Garcia",
        "license_number": "45821",
        "user_email": "martin.garcia@test.com",
        "phone": "099 123 456",
        "specialties": ["Clinica Medica"],
        "schedules": [
            (0, time(8, 0), time(12, 0), 30),
            (2, time(8, 0), time(12, 0), 30),
            (4, time(8, 0), time(12, 0), 30),
        ],
    },
    {
        "first_name": "Laura",
        "last_name": "Rodriguez",
        "license_number": "39217",
        "user_email": "laura.rodriguez@test.com",
        "phone": "098 234 567",
        "specialties": ["Cardiologia"],
        "schedules": [
            (1, time(14, 0), time(18, 0), 45),
            (3, time(14, 0), time(18, 0), 45),
        ],
    },
    {
        "first_name": "Sebastian",
        "last_name": "Lopez",
        "license_number": "41763",
        "user_email": "sebastian.lopez@test.com",
        "phone": "097 345 678",
        "specialties": ["Dermatologia"],
        "schedules": [
            (0, time(9, 0), time(13, 0), 30),
            (3, time(9, 0), time(13, 0), 30),
        ],
    },
    {
        "first_name": "Carolina",
        "last_name": "Fernandez",
        "license_number": "36542",
        "user_email": "carolina.fernandez@test.com",
        "phone": "096 456 789",
        "specialties": ["Pediatria"],
        "schedules": [
            (0, time(13, 0), time(17, 0), 30),
            (1, time(13, 0), time(17, 0), 30),
            (4, time(13, 0), time(17, 0), 30),
        ],
    },
    {
        "first_name": "Valentina",
        "last_name": "Suarez",
        "license_number": "48105",
        "user_email": "valentina.suarez@test.com",
        "phone": "095 567 890",
        "specialties": ["Ginecologia"],
        "schedules": [
            (2, time(14, 0), time(19, 0), 45),
            (4, time(14, 0), time(19, 0), 45),
        ],
    },
    {
        "first_name": "Andres",
        "last_name": "Martinez",
        "license_number": "42931",
        "user_email": "andres.martinez@test.com",
        "phone": "094 678 901",
        "specialties": ["Traumatologia"],
        "schedules": [
            (1, time(8, 0), time(12, 0), 30),
            (3, time(8, 0), time(12, 0), 30),
        ],
    },
]


ADMINISTRATIVOS = [
    {"email": "maria.admin@test.com", "role": "admin"},
    {"email": "sofia.recepcion@test.com", "role": "reception"},
]


def confirmar() -> bool:
    print("")
    print("=" * 60)
    print("CARGA INICIAL DE DATOS")
    print("=" * 60)
    print("")
    print("Se van a agregar:")
    print(f"  - {len(ESPECIALIDADES)} especialidades")
    print(f"  - {len(MEDICOS)} medicos con sus horarios")
    print(f"  - {len(ADMINISTRATIVOS)} usuarios administrativos")
    print("")
    print("Los datos existentes NO se van a borrar.")
    print("")
    respuesta = input("Continuar? (s/n): ").strip().lower()
    return respuesta == "s"


def cargar_especialidades(db) -> dict:
    print("")
    print("--- Cargando especialidades ---")
    creadas = {}
    for nombre, descripcion in ESPECIALIDADES:
        existente = db.scalar(
            select(Specialty).where(Specialty.name == nombre)
        )
        if existente:
            print(f"  [ya existe] {nombre}")
            creadas[nombre] = existente
            continue
        esp = Specialty(name=nombre, description=descripcion)
        db.add(esp)
        db.flush()
        creadas[nombre] = esp
        print(f"  [creada]    {nombre}")
    db.commit()
    return creadas


def cargar_medicos(db, especialidades: dict) -> None:
    print("")
    print("--- Cargando medicos ---")
    for med in MEDICOS:
        email = med["user_email"]
        nombre_completo = med["first_name"] + " " + med["last_name"]
        existente = db.scalar(select(User).where(User.email == email))
        if existente:
            print(f"  [ya existe] {nombre_completo} ({email})")
            continue

        user = User(
            email=email,
            password_hash=hash_password(PASSWORD_INICIAL),
            role="doctor",
        )
        db.add(user)
        db.flush()

        doctor = Doctor(
            user_id=user.id,
            first_name=med["first_name"],
            last_name=med["last_name"],
            license_number=med["license_number"],
            phone=med["phone"],
            email=email,
        )
        db.add(doctor)
        db.flush()

        for nombre_esp in med["specialties"]:
            if nombre_esp not in especialidades:
                print(f"    [AVISO] Especialidad {nombre_esp} no existe")
                continue
            esp = especialidades[nombre_esp]
            db.execute(
                doctor_specialties.insert().values(
                    doctor_id=doctor.id,
                    specialty_id=esp.id,
                )
            )

        for dia, hora_ini, hora_fin, duracion in med["schedules"]:
            schedule = Schedule(
                doctor_id=doctor.id,
                day_of_week=dia,
                start_time=hora_ini,
                end_time=hora_fin,
                slot_duration_minutes=duracion,
            )
            db.add(schedule)

        db.commit()
        matricula = med["license_number"]
        print(f"  [creado]    {nombre_completo} (matricula {matricula})")


def cargar_administrativos(db) -> None:
    print("")
    print("--- Cargando administrativos ---")
    for adm in ADMINISTRATIVOS:
        email = adm["email"]
        rol = adm["role"]
        existente = db.scalar(select(User).where(User.email == email))
        if existente:
            print(f"  [ya existe] {email}")
            continue
        user = User(
            email=email,
            password_hash=hash_password(PASSWORD_INICIAL),
            role=rol,
        )
        db.add(user)
        db.commit()
        print(f"  [creado]    {email} (rol: {rol})")


def main() -> None:
    if not confirmar():
        print("")
        print("Cancelado. No se hizo ningun cambio.")
        return

    db = SessionLocal()
    try:
        especialidades = cargar_especialidades(db)
        cargar_medicos(db, especialidades)
        cargar_administrativos(db)
        print("")
        print("=" * 60)
        print("CARGA COMPLETADA")
        print("=" * 60)
        print("")
        print(f"Contrasena para todos los usuarios nuevos:")
        print(f"  {PASSWORD_INICIAL}")
        print("")
    finally:
        db.close()


if __name__ == "__main__":
    main()
