"""Carga datos de prueba: pacientes, médicos, citas. Reset de la base."""

from datetime import date, time, timedelta
from app.database import SessionLocal
from app.models.user import User
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.specialty import Specialty
from app.models.schedule import Schedule
from app.models.appointment import Appointment
from app.models.appointment_log import AppointmentLog
from app.models.block import Block
from app.models.doctor_absence import DoctorAbsence
from app.models.doctor_specialty import doctor_specialties
from app.core.security import hash_password

db = SessionLocal()

print("Limpiando base de datos...")

# Borrar en orden: hijos primero, padres al final
db.query(AppointmentLog).delete()
db.query(Appointment).delete()
db.query(Block).delete()
db.query(Schedule).delete()
db.query(DoctorAbsence).delete()
db.execute(doctor_specialties.delete())

# Guardar IDs de users asociados a patients/doctors antes de borrar
ids_users = []
ids_users.extend([p.user_id for p in db.query(Patient).all()])
ids_users.extend([m.user_id for m in db.query(Doctor).all()])

db.query(Patient).delete()
db.query(Doctor).delete()

# Borrar usuarios (solo los que eran de pacientes o médicos)
if ids_users:
    db.query(User).filter(User.id.in_(ids_users)).delete(synchronize_session=False)

db.commit()
print("Base limpia.")

# 1. Especialidades (conservar las existentes, crear si faltan)
especialidades_nombres = ["Cardiología", "Clínica Médica", "Dermatología", "Pediatría", "Ginecología"]
especialidades = []
for nombre in especialidades_nombres:
    esp = db.query(Specialty).filter(Specialty.name == nombre).first()
    if not esp:
        esp = Specialty(name=nombre, description=f"Especialidad de {nombre.lower()}")
        db.add(esp)
        db.flush()
    especialidades.append(esp)
db.commit()
print(f"Especialidades listas: {len(especialidades)}")

# 2. Pacientes (15 ficticios)
nombres_pacientes = [
    ("Ana", "García", "30123456", "099111111"),
    ("Luis", "Rodríguez", "30123457", "099111112"),
    ("María", "López", "30123458", "099111113"),
    ("Carlos", "Martínez", "30123459", "099111114"),
    ("Laura", "González", "30123460", "099111115"),
    ("José", "Pérez", "30123461", "099111116"),
    ("Carmen", "Sánchez", "30123462", "099111117"),
    ("Diego", "Fernández", "30123463", "099111118"),
    ("Sofía", "Ramírez", "30123464", "099111119"),
    ("Miguel", "Torres", "30123465", "099111120"),
    ("Isabel", "Flores", "30123466", "099111121"),
    ("Javier", "Rivera", "30123467", "099111122"),
    ("Lucía", "Gómez", "30123468", "099111123"),
    ("Pablo", "Díaz", "30123469", "099111124"),
    ("Marta", "Ruiz", "30123470", "099111125"),
]

pacientes_creados = []
for i, (nombre, apellido, dni, tel) in enumerate(nombres_pacientes):
    email = f"paciente{i+1}@test.com"
    user = User(email=email, password_hash=hash_password("prueba123"), role="patient")
    db.add(user)
    db.flush()
    patient = Patient(
        user_id=user.id,
        first_name=nombre,
        last_name=apellido,
        dni=dni,
        birth_date=date(1990, 1, 1),
        phone=tel,
        email=email,
        obra_social="OSDE" if i % 2 == 0 else "Swiss Medical",
    )
    db.add(patient)
    db.flush()
    pacientes_creados.append(patient)
db.commit()
print(f"Pacientes creados: {len(pacientes_creados)}")

# 3. Médicos (3 ficticios)
nombres_medicos = [
    ("Roberto", "Silva", "MP-50001", "099222221", especialidades[0]),
    ("Patricia", "Vega", "MP-50002", "099222222", especialidades[1]),
    ("Fernando", "Castro", "MP-50003", "099222223", especialidades[2]),
]

medicos_creados = []
for i, (nombre, apellido, matricula, tel, esp) in enumerate(nombres_medicos):
    email = f"medico{i+1}@test.com"
    user = User(email=email, password_hash=hash_password("prueba123"), role="doctor")
    db.add(user)
    db.flush()
    doctor = Doctor(
        user_id=user.id,
        first_name=nombre,
        last_name=apellido,
        license_number=matricula,
        phone=tel,
        email=email,
    )
    db.add(doctor)
    db.flush()
    doctor.specialties.append(esp)
    for dia in range(5):
        schedule = Schedule(
            doctor_id=doctor.id,
            day_of_week=dia,
            start_time=time(9, 0),
            end_time=time(18, 0),
            slot_duration_minutes=30,
        )
        db.add(schedule)
    medicos_creados.append(doctor)
db.commit()
print(f"Médicos creados: {len(medicos_creados)}")

# 4. Citas (20 repartidas en la semana actual)
# Buscar un admin para usar como created_by
admin = db.query(User).filter(User.role == "admin").first()
if not admin:
    print("ERROR: no hay ningún admin en la base. Creá uno primero.")
    db.close()
    exit(1)
admin_id = admin.id

hoy = date.today()
lunes = hoy - timedelta(days=hoy.weekday())
estados = ["confirmed", "confirmed", "confirmed", "attended", "cancelled"]
citas_creadas = 0
for i in range(20):
    paciente = pacientes_creados[i % len(pacientes_creados)]
    medico = medicos_creados[i % len(medicos_creados)]
    especialidad = medico.specialties[0]
    dia = lunes + timedelta(days=i % 5)
    hora = 9 + (i % 8)
    start = time(hora, 0)
    end = time(hora, 30)
    estado = estados[i % len(estados)]
    cita = Appointment(
        patient_id=paciente.id,
        doctor_id=medico.id,
        specialty_id=especialidad.id,
        appointment_date=dia,
        start_time=start,
        end_time=end,
        status=estado,
        created_by=admin_id,
    )
    db.add(cita)
    citas_creadas += 1
db.commit()
print(f"Citas creadas: {citas_creadas}")
print("¡Listo!")
db.close()
