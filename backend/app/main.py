from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    appointments,
    auth,
    availability,
    doctor_absences,
    doctors,
    patients,
    schedules,
    specialties,
    users,
)
from app.core.config import get_settings


settings = get_settings()


app = FastAPI(
    title="Sistema de Reservas - Clinica",
    description="API para gestion de turnos medicos",
    version="0.1.0",
)


origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(specialties.router)
app.include_router(users.router)
app.include_router(patients.router)
app.include_router(doctor_absences.router)
app.include_router(doctors.router)
app.include_router(schedules.router)
app.include_router(appointments.router)
app.include_router(availability.router)


@app.get("/")
def root():
    """Endpoint de salud."""
    return {"status": "ok", "service": "clinica-reservas"}
