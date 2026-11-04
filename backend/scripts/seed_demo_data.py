import os
import random
from datetime import date, time, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Usamos la URL de producción (Render/Neon)
URL = os.environ.get("DATABASE_URL")
if not URL:
    print("ERROR: No se encontró DATABASE_URL")
    exit(1)

engine = create_engine(URL)
Session = sessionmaker(bind=engine)
db = Session()

from app.models.user import User
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.doctor_specialty import doctor_specialties
from app.models.specialty import Specialty
from app.models.schedule import Schedule
from app.models.appointment import Appointment
from app.models.appointment_log import AppointmentLog
from app.core.security import hash_password

# Datos realistas para la demo
NOMBRES = ["Juan", "Maria", "Pedro", "Ana", "Luis", "Carla", "Diego", "Laura", "Pablo", "Sofia", "Martin", "Lucia", "Andres", "Valentina", "Javier", "Camila", "Federico", "Florencia", "Gonzalo", "Agustina"]
APELLIDOS = ["Gonzalez", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Perez", "Garcia", "Sanchez", "Romero", "Diaz", "Torres", "Ruiz", "Alvarez", "Moreno", "Munoz", "Rojas", "Sosa", "Silva", "Castro", "Vazquez"]

print("Limpiando base de datos...")
db.query(AppointmentLog).delete()
db.query(Appointment).delete()
db.query(Schedule).delete()
db.query(Patient).delete()
db.execute(doctor_specialties.delete())  # Borrar relación medico-especialidad
db.query(Doctor).delete()
db.query(Specialty).delete()
db.query(User).delete()
db.commit()

# 1. Especialidades
print("Cargando especialidades...")
esps = [Specialty(name=n) for n in ["Clinica Medica", "Cardiologia", "Dermatologia", "Pediatria", "Ginecologia", "Traumatologia"]]
db.add_all(esps)
db.commit()
for e in esps: db.refresh(e)

# 2. Admin y Recepcion
print("Cargando admin y recepcion...")
admin_user = User(email="maria.admin@clinicadelsur.test", password_hash=hash_password("clinicadelsur2026"), role="admin")
recep_user = User(email="sofia.recepcion@clinicadelsur.test", password_hash=hash_password("clinicadelsur2026"), role="reception")
db.add_all([admin_user, recep_user])
db.commit()

# 3. Medicos
print("Cargando medicos...")
medicos_data = [
    ("Martin", "Garcia", "45821", "martin.garcia@clinicadelsur.test", "Clinica Medica"),
    ("Laura", "Rodriguez", "39217", "laura.rodriguez@clinicadelsur.test", "Cardiologia"),
    ("Sebastian", "Lopez", "41763", "sebastian.lopez@clinicadelsur.test", "Dermatologia"),
    ("Carolina", "Fernandez", "36542", "carolina.fernandez@clinicadelsur.test", "Pediatria"),
    ("Valentina", "Suarez", "48105", "valentina.suarez@clinicadelsur.test", "Ginecologia"),
    ("Andres", "Martinez", "42931", "andres.martinez@clinicadelsur.test", "Traumatologia")
]
doctores = []
for nom, ape, mat, mail, esp_nom in medicos_data:
    u = User(email=mail, password_hash=hash_password("clinicadelsur2026"), role="doctor")
    db.add(u); db.flush()
    d = Doctor(user_id=u.id, first_name=nom, last_name=ape, license_number=mat, email=mail)
    e = next(x for x in esps if x.name == esp_nom)
    d.specialties.append(e)
    db.add(d); db.flush()
    doctores.append(d)
    # Horarios (lun-vie, 8-12 y 14-18)
    for dia in range(5):
        db.add(Schedule(doctor_id=d.id, day_of_week=dia, start_time=time(8,0), end_time=time(12,0), slot_duration_minutes=30))
        db.add(Schedule(doctor_id=d.id, day_of_week=dia, start_time=time(14,0), end_time=time(18,0), slot_duration_minutes=30))
db.commit()

# 4. Pacientes (50)
print("Cargando pacientes...")
pacientes = []
for i in range(50):
    nom = random.choice(NOMBRES)
    ape = random.choice(APELLIDOS)
    dni = str(10000000 + i)
    email = f"{nom.lower()}.{ape.lower()}{i}@test.com"
    u = User(email=email, password_hash=hash_password("paciente123"), role="patient")
    db.add(u); db.flush()
    p = Patient(user_id=u.id, first_name=nom, last_name=ape, dni=dni, birth_date=date(1980+i%20, 1, 1), phone=f"099{100000+i}", email=email)
    db.add(p); db.flush()
    pacientes.append(p)
db.commit()

# 5. Citas (100)
print("Cargando citas...")
hoy = date.today()
tz = ZoneInfo("America/Montevideo")

for i in range(100):
    pac = random.choice(pacientes)
    doc = random.choice(doctores)
    esp = doc.specialties[0]
    
    # Fechas variadas: pasadas, hoy, futuras
    offset = random.randint(-15, 15)
    fecha = hoy + timedelta(days=offset)
    
    # Solo dias de semana
    if fecha.weekday() > 4:
        fecha = fecha - timedelta(days=fecha.weekday() - 4)
        
    hora = random.choice([time(8,30), time(9,0), time(9,30), time(10,0), time(14,30), time(15,0), time(15,30), time(16,0)])
    
    # Evitar solapamientos exactos (simplificado)
    existe = db.query(Appointment).filter_by(doctor_id=doc.id, appointment_date=fecha, start_time=hora).first()
    if existe: continue

    # Estados
    estado = "confirmed"
    if fecha < hoy:
        estado = random.choice(["attended", "attended", "no_show"])
    elif fecha == hoy and hora < datetime.now(tz).time():
        estado = random.choice(["attended", "no_show"])
    elif random.random() < 0.1:
        estado = "cancelled"

    c = Appointment(
        patient_id=pac.id, doctor_id=doc.id, specialty_id=esp.id,
        appointment_date=fecha, start_time=hora, end_time=(datetime.combine(date.today(), hora) + timedelta(minutes=30)).time(),
        status=estado, created_by=admin_user.id
    )
    db.add(c)
db.commit()

print("¡Datos de demo cargados con éxito! 50 pacientes, 6 médicos, 100 citas.")
db.close()
