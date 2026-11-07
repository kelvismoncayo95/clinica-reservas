"""Tests del calendario de dias disponibles.

GET /api/v1/doctors/{id}/available-dates?from=...&to=...

El medico de prueba (helpers.crear_medico) atiende de lunes a viernes de
9 a 17, en turnos de 30 minutos (16 turnos por dia).
"""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.database import SessionLocal
from app.main import app
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.doctor_absence import DoctorAbsence
from tests.helpers import crear_especialidad, crear_medico, crear_paciente

client = TestClient(app)


def hoy_en_la_clinica() -> date:
    return datetime.now(ZoneInfo(get_settings().CLINIC_TIMEZONE)).date()


def proximo(dia_semana: int, desde_dias: int = 2) -> date:
    """Proxima fecha (a partir de hoy + desde_dias) que cae en ese dia (0=lunes)."""
    fecha = hoy_en_la_clinica() + timedelta(days=desde_dias)
    while fecha.weekday() != dia_semana:
        fecha += timedelta(days=1)
    return fecha


def preparar():
    """Crea especialidad, medico y paciente. Devuelve (doctor_id, esp_id, headers)."""
    esp = crear_especialidad("Cardiologia")
    user = crear_medico("medico@test.com", "prueba123", "MP-001", esp.id)
    crear_paciente("paciente@test.com", "prueba123")
    r = client.post(
        "/api/v1/auth/login",
        data={"username": "paciente@test.com", "password": "prueba123"},
    )
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    with SessionLocal() as db:
        doctor_id = db.scalar(select(Doctor.id).where(Doctor.user_id == user.id))
    return doctor_id, esp.id, headers


def pedir_dias(doctor_id, desde: date, hasta: date, headers):
    r = client.get(
        f"/api/v1/doctors/{doctor_id}/available-dates",
        params={"from": desde.isoformat(), "to": hasta.isoformat()},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    return {d["date"]: d for d in r.json()}


def test_dias_que_atiende_disponibles_y_fin_de_semana_no():
    doctor_id, _, headers = preparar()
    lunes = proximo(0)
    sabado = lunes + timedelta(days=5)

    dias = pedir_dias(doctor_id, lunes, sabado, headers)

    assert len(dias) == 6
    assert dias[lunes.isoformat()]["available"] is True
    assert dias[lunes.isoformat()]["reason"] is None
    assert dias[sabado.isoformat()] == {
        "date": sabado.isoformat(), "available": False, "reason": "no_atiende"
    }


def test_dias_pasados_y_demasiado_lejanos_no_estan_disponibles():
    doctor_id, _, headers = preparar()
    hoy = hoy_en_la_clinica()
    ayer = hoy - timedelta(days=1)
    lejos = hoy + timedelta(days=get_settings().APPOINTMENT_MAX_DAYS_AHEAD + 1)

    assert pedir_dias(doctor_id, ayer, ayer, headers)[ayer.isoformat()]["reason"] == "pasado"
    assert pedir_dias(doctor_id, lejos, lejos, headers)[lejos.isoformat()]["reason"] == "fuera_de_rango"


def test_dia_de_ausencia_no_esta_disponible_y_no_se_puede_reservar():
    doctor_id, esp_id, headers = preparar()
    martes = proximo(1)
    with SessionLocal() as db:
        medico_user_id = db.get(Doctor, doctor_id).user_id
        db.add(DoctorAbsence(
            doctor_id=doctor_id, absence_date=martes, notified_by=medico_user_id,
        ))
        db.commit()

    dias = pedir_dias(doctor_id, martes, martes, headers)
    assert dias[martes.isoformat()]["reason"] == "ausencia"

    # El backend tambien rechaza la reserva (antes la dejaba pasar)
    r = client.post(
        "/api/v1/appointments",
        json={
            "doctor_id": doctor_id,
            "specialty_id": esp_id,
            "appointment_date": martes.isoformat(),
            "start_time": "10:00:00",
        },
        headers=headers,
    )
    assert r.status_code == 409
    assert "no atiende" in r.json()["detail"]


def test_dia_con_todos_los_turnos_ocupados_esta_completo():
    doctor_id, esp_id, headers = preparar()
    miercoles = proximo(2)
    jueves = miercoles + timedelta(days=1)
    with SessionLocal() as db:
        medico_user_id = db.get(Doctor, doctor_id).user_id
        # Llenamos los 16 turnos del miercoles (9:00 a 17:00)
        for i in range(16):
            inicio = datetime.combine(miercoles, time(9, 0)) + timedelta(minutes=30 * i)
            db.add(Appointment(
                patient_id=1, doctor_id=doctor_id, specialty_id=esp_id,
                appointment_date=miercoles,
                start_time=inicio.time(),
                end_time=(inicio + timedelta(minutes=30)).time(),
                status="confirmed", created_by=medico_user_id,
            ))
        db.commit()

    dias = pedir_dias(doctor_id, miercoles, jueves, headers)

    assert dias[miercoles.isoformat()]["reason"] == "completo"
    assert dias[jueves.isoformat()]["available"] is True


def test_rango_invalido_devuelve_400():
    doctor_id, _, headers = preparar()
    hoy = hoy_en_la_clinica()

    al_reves = client.get(
        f"/api/v1/doctors/{doctor_id}/available-dates",
        params={"from": hoy.isoformat(), "to": (hoy - timedelta(days=1)).isoformat()},
        headers=headers,
    )
    muy_largo = client.get(
        f"/api/v1/doctors/{doctor_id}/available-dates",
        params={"from": hoy.isoformat(), "to": (hoy + timedelta(days=100)).isoformat()},
        headers=headers,
    )

    assert al_reves.status_code == 400
    assert muy_largo.status_code == 400


def test_sin_iniciar_sesion_devuelve_401():
    hoy = hoy_en_la_clinica().isoformat()
    r = client.get(
        "/api/v1/doctors/1/available-dates", params={"from": hoy, "to": hoy}
    )
    assert r.status_code == 401
