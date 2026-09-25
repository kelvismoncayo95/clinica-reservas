from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth
from app.core.config import get_settings


settings = get_settings()


app = FastAPI(
    title="Sistema de Reservas - Clinica",
    description="API para gestion de turnos medicos",
    version="0.1.0",
)


# CORS: permite que el frontend (en otro puerto) llame al backend
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Routers
app.include_router(auth.router)


@app.get("/")
def root():
    """Endpoint de salud para verificar que el servidor esta vivo."""
    return {"status": "ok", "service": "clinica-reservas"}
