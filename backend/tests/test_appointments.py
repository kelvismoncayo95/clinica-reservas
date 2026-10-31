from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import get_settings
from tests.helpers import (
    crear_paciente,
    crear_medico,
    crear_especialidad,
    crear_medico_full,
)

client = TestClient(app)


def get_auth_headers(email, password):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password}
    )
    assert response.status_code == 200, f"Fallo login: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def proximo_dia_habil(desde: date, dias_adelante: int = 1) -> date:
    fecha = desde + timedelta(days=dias_adelante)
    while fecha.weekday() > 4:
        fecha += timedelta(days=1)
    return fecha


def test_crear_cita_exitosa():
    crear_paciente("paciente1@test.com", "prueba123", "11111111")
    headers_pac = get_auth_headers("paciente1@test.com", "prueba123")

    esp = crear_especialidad("Cardiología")
    crear_medico("medico1@test.com", "prueba123", "MP-001", esp.id)

    fecha_futura = proximo_dia_habil(date.today(), 2).isoformat()
    payload = {
        "doctor_id": 1,
        "specialty_id": esp.id,
        "appointment_date": fecha_futura,
        "start_time": "10:00:00"
    }
    response = client.post("/api/v1/appointments", json=payload, headers=headers_pac)
    assert response.status_code == 201, f"Error: {response.text}"


def test_rechazar_solapamiento():
    crear_paciente("paciente2@test.com", "prueba123", "22222222")
    headers = get_auth_headers("paciente2@test.com", "prueba123")

    esp = crear_especialidad("Dermatología")
    crear_medico("medico2@test.com", "prueba123", "MP-002", esp.id)

    fecha_futura = proximo_dia_habil(date.today(), 3).isoformat()
    payload = {
        "doctor_id": 1,
        "specialty_id": esp.id,
        "appointment_date": fecha_futura,
        "start_time": "11:00:00"
    }
    r1 = client.post("/api/v1/appointments", json=payload, headers=headers)
    assert r1.status_code == 201, f"Fallo al crear la primera: {r1.text}"

    r2 = client.post("/api/v1/appointments", json=payload, headers=headers)
    assert r2.status_code == 409, f"Esperaba 409, recibí {r2.status_code}: {r2.text}"


def test_zona_horaria_cancelacion_25_horas():
    """Test: una cita a ~18 horas reales debe rechazar la cancelación (bug de zona horaria)."""
    crear_paciente("paciente4@test.com", "prueba123", "44444444")
    headers = get_auth_headers("paciente4@test.com", "prueba123")

    esp = crear_especialidad("Clinica")
    crear_medico_full("medico4@test.com", "prueba123", "MP-004", esp.id)

    tz = ZoneInfo(get_settings().CLINIC_TIMEZONE)
    ahora = datetime.now(tz)
    # Mañana a las 10:00 (está a ~18 horas de ahora, menos de 24)
    manana = (ahora + timedelta(days=1)).date()

    payload = {
        "doctor_id": 1,
        "specialty_id": esp.id,
        "appointment_date": manana.isoformat(),
        "start_time": "10:00:00"
    }
    r_crear = client.post("/api/v1/appointments", json=payload, headers=headers)
    if r_crear.status_code != 201:
        import pytest
        pytest.skip(f"No se pudo crear la cita: {r_crear.text}")

    cita_id = r_crear.json()["id"]

    r_cancel = client.patch(f"/api/v1/appointments/{cita_id}/cancel", headers=headers)
    assert r_cancel.status_code == 400, (
        f"BUG DE ZONA HORARIA DETECTADO: la cita fue cancelada pero debería rechazarse. "
        f"Recibí {r_cancel.status_code}: {r_cancel.text}"
    )


def test_rechazar_cancelacion_sin_anticipacion():
    """Test: un paciente no puede cancelar con menos de 24 horas."""
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    from app.core.config import get_settings

    crear_paciente("paciente3@test.com", "prueba123", "33333333")
    headers = get_auth_headers("paciente3@test.com", "prueba123")

    esp = crear_especialidad("Pediatría")
    crear_medico_full("medico3@test.com", "prueba123", "MP-003", esp.id)

    tz = ZoneInfo(get_settings().CLINIC_TIMEZONE)
    ahora = datetime.now(tz)
    manana = (ahora + timedelta(days=1)).date()

    payload = {
        "doctor_id": 1,
        "specialty_id": esp.id,
        "appointment_date": manana.isoformat(),
        "start_time": "10:00:00"
    }
    r_crear = client.post("/api/v1/appointments", json=payload, headers=headers)
    if r_crear.status_code != 201:
        import pytest
        pytest.skip(f"No se pudo crear la cita: {r_crear.text}")

    cita_id = r_crear.json()["id"]

    r_cancel = client.patch(f"/api/v1/appointments/{cita_id}/cancel", headers=headers)
    assert r_cancel.status_code == 400, f"Esperaba 400, recibí {r_cancel.status_code}: {r_cancel.text}"
