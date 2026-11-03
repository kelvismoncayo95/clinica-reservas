import sys
import os
from datetime import time
from sqlalchemy import text

# Aseguramos que use la base de datos de Docker
os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@db:5432/clinica_reservas"

from app.database import SessionLocal
from app.models.user import User
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.specialty import Specialty
from app.models.schedule import Schedule
from app.models.appointment import Appointment
from app.models.appointment_log import AppointmentLog
from app.models.block import Block
from app.models.doctor_absence import DoctorAbsence
from app.core.security import hash_password

def limpiar_y_cargar():
    db = SessionLocal()
    try:
        print("Limpiando base de datos...")
        # Borramos en orden por las claves foráneas
        db.query(AppointmentLog).delete()
        db.query(Appointment).delete()
        db.query(DoctorAbsence).delete()
        db.query(Block).delete()
        db.query(Schedule).delete()
        db.query(Patient).delete()
        db.query(Doctor).delete()
        db.query(Specialty).delete()
        db.query(User).delete()
        db.commit()

        print("Cargando especialidades...")
        especialidades = {
            "Clinica Medica": Specialty(name="Clinica Medica"),
            "Cardiologia": Specialty(name="Cardiologia"),
            "Dermatologia": Specialty(name="Dermatologia"),
            "Pediatria": Specialty(name="Pediatria"),
            "Ginecologia": Specialty(name="Ginecologia"),
            "Traumatologia": Specialty(name="Traumatologia"),
        }
        for e in especialidades.values():
            db.add(e)
        db.commit()

        print("Cargando personal administrativo...")
        admin = User(email="maria.admin@clinicadelsur.test", password_hash=hash_password("clinicadelsur2026"), role="admin")
        recep = User(email="sofia.recepcion@clinicadelsur.test", password_hash=hash_password("clinicadelsur2026"), role="reception")
        db.add_all([admin, recep])
        db.commit()

        print("Cargando medicos y horarios...")
        
        def crear_medico(nombre, apellido, matricula, email, telefono, especialidad, dias, hora_inicio, hora_fin, duracion):
            user = User(email=email, password_hash=hash_password("clinicadelsur2026"), role="doctor")
            db.add(user)
            db.flush()
            doctor = Doctor(user_id=user.id, first_name=nombre, last_name=apellido, license_number=matricula, email=email, phone=telefono)
            doctor.specialties.append(especialidades[especialidad])
            db.add(doctor)
            db.flush()
            for dia in dias:
                db.add(Schedule(doctor_id=doctor.id, day_of_week=dia, start_time=hora_inicio, end_time=hora_fin, slot_duration_minutes=duracion))
            db.commit()

        # 1. Dr. Martin Garcia (Lunes=0, Miercoles=2, Viernes=4)
        crear_medico("Martin", "Garcia", "45821", "martin.garcia@clinicadelsur.test", "099 123 456", "Clinica Medica", [0, 2, 4], time(8, 0), time(12, 0), 30)
        
        # 2. Dra. Laura Rodriguez (Martes=1, Jueves=3)
        crear_medico("Laura", "Rodriguez", "39217", "laura.rodriguez@clinicadelsur.test", "098 234 567", "Cardiologia", [1, 3], time(14, 0), time(18, 0), 45)
        
        # 3. Dr. Sebastian Lopez (Lunes=0, Jueves=3)
        crear_medico("Sebastian", "Lopez", "41763", "sebastian.lopez@clinicadelsur.test", "097 345 678", "Dermatologia", [0, 3], time(9, 0), time(13, 0), 30)
        
        # 4. Dra. Carolina Fernandez (Lunes=0, Martes=1, Viernes=4)
        crear_medico("Carolina", "Fernandez", "36542", "carolina.fernandez@clinicadelsur.test", "096 456 789", "Pediatria", [0, 1, 4], time(13, 0), time(17, 0), 30)
        
        # 5. Dra. Valentina Suarez (Miercoles=2, Viernes=4)
        crear_medico("Valentina", "Suarez", "48105", "valentina.suarez@clinicadelsur.test", "095 567 890", "Ginecologia", [2, 4], time(14, 0), time(19, 0), 45)
        
        # 6. Dr. Andres Martinez (Martes=1, Jueves=3)
        crear_medico("Andres", "Martinez", "42931", "andres.martinez@clinicadelsur.test", "094 678 901", "Traumatologia", [1, 3], time(8, 0), time(12, 0), 30)

        print("¡Base de datos cargada con exito!")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    limpiar_y_cargar()
