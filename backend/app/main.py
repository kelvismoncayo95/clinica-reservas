from fastapi import FastAPI, Request
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
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
from app.core.limiter import limiter


settings = get_settings()


app = FastAPI(
    state=type('State', (), {'limiter': limiter})(),
    title="Sistema de Reservas - Clinica",
    description="API para gestion de turnos medicos",
    version="0.1.0",
)
app.state.limiter = limiter


origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
