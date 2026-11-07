"""Tests del CRUD de medicos (crear y editar).

Cubren el flujo que usa el panel de admin: crear un medico con su
usuario de login y especialidades, y despues editarlo.
"""
from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import crear_admin, crear_especialidad, crear_paciente

client = TestClient(app)


def login(email, password):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200, f"Fallo login: {response.text}"
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def admin_headers():
    crear_admin("admin@test.com", "admin123")
    return login("admin@test.com", "admin123")


def datos_medico(specialty_ids, **cambios):
    datos = {
        "first_name": "Carlos",
        "last_name": "Garcia",
        "license_number": "MP-111",
        "phone": "099123456",
        "email": "carlos@clinica.com",
        "password": "secreto123",
        "specialty_ids": specialty_ids,
    }
    datos.update(cambios)
    return datos


def test_admin_crea_medico_y_el_medico_puede_loguearse():
    headers = admin_headers()
    esp = crear_especialidad("Cardiologia")

    r = client.post("/api/v1/doctors", json=datos_medico([esp.id]), headers=headers)

    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "carlos@clinica.com"
    assert body["specialty_ids"] == [esp.id]
    # El medico recien creado puede entrar con su email y contraseña
    login("carlos@clinica.com", "secreto123")


def test_no_se_puede_crear_medico_con_email_repetido():
    headers = admin_headers()
    esp = crear_especialidad("Cardiologia")
    client.post("/api/v1/doctors", json=datos_medico([esp.id]), headers=headers)

    r = client.post(
        "/api/v1/doctors",
        json=datos_medico([esp.id], license_number="MP-222"),
        headers=headers,
    )

    assert r.status_code == 409


def test_no_se_puede_crear_medico_sin_especialidades():
    headers = admin_headers()

    r = client.post("/api/v1/doctors", json=datos_medico([]), headers=headers)

    assert r.status_code == 409


def test_email_con_formato_invalido_devuelve_422():
    headers = admin_headers()
    esp = crear_especialidad("Cardiologia")

    r = client.post(
        "/api/v1/doctors",
        json=datos_medico([esp.id], email="esto-no-es-un-email"),
        headers=headers,
    )

    assert r.status_code == 422


def test_paciente_no_puede_crear_medicos():
    crear_paciente("paciente@test.com", "prueba123")
    headers = login("paciente@test.com", "prueba123")
    esp = crear_especialidad("Cardiologia")

    r = client.post("/api/v1/doctors", json=datos_medico([esp.id]), headers=headers)

    assert r.status_code == 403


def test_admin_edita_nombre_telefono_y_especialidades():
    headers = admin_headers()
    cardio = crear_especialidad("Cardiologia")
    pediatria = crear_especialidad("Pediatria")
    creado = client.post(
        "/api/v1/doctors", json=datos_medico([cardio.id]), headers=headers
    ).json()

    r = client.put(
        f"/api/v1/doctors/{creado['id']}",
        json={
            "first_name": "Carla",
            "phone": "098000000",
            "specialty_ids": [pediatria.id],
        },
        headers=headers,
    )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["first_name"] == "Carla"
    assert body["phone"] == "098000000"
    assert body["specialty_ids"] == [pediatria.id]
    # Lo que no mandamos queda igual
    assert body["last_name"] == "Garcia"


def test_editar_email_tambien_cambia_el_email_de_login():
    headers = admin_headers()
    esp = crear_especialidad("Cardiologia")
    creado = client.post(
        "/api/v1/doctors", json=datos_medico([esp.id]), headers=headers
    ).json()

    r = client.put(
        f"/api/v1/doctors/{creado['id']}",
        json={"email": "nuevo@clinica.com"},
        headers=headers,
    )

    assert r.status_code == 200, r.text
    login("nuevo@clinica.com", "secreto123")
    viejo = client.post(
        "/api/v1/auth/login",
        data={"username": "carlos@clinica.com", "password": "secreto123"},
    )
    assert viejo.status_code == 401


def test_editar_email_a_uno_ya_usado_devuelve_409():
    headers = admin_headers()
    esp = crear_especialidad("Cardiologia")
    creado = client.post(
        "/api/v1/doctors", json=datos_medico([esp.id]), headers=headers
    ).json()

    r = client.put(
        f"/api/v1/doctors/{creado['id']}",
        json={"email": "admin@test.com"},
        headers=headers,
    )

    assert r.status_code == 409
