"""Tests de "Olvidé mi contraseña".

En vez de mandar correos de verdad, reemplazamos enviar_email por una
funcion falsa que guarda el correo en una lista (monkeypatch). Asi
podemos leer el link con el token, como haria el usuario en su bandeja.
"""
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse
import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

import app.api.auth as auth_api
from app.database import SessionLocal
from app.main import app
from app.models.password_reset_token import PasswordResetToken
from tests.helpers import crear_paciente

client = TestClient(app)


@pytest.fixture
def bandeja(monkeypatch):
    """Lista donde caen los correos 'enviados' durante el test."""
    enviados = []

    def enviar_falso(to_email, subject, html):
        enviados.append({"to": to_email, "subject": subject, "html": html})
        return True

    monkeypatch.setattr(auth_api, "enviar_email", enviar_falso)
    return enviados


def token_del_correo(correo) -> str:
    link = re.search(r'href="([^"]+)"', correo["html"]).group(1)
    return parse_qs(urlparse(link).query)["token"][0]


def puede_loguearse(email, password) -> bool:
    r = client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    )
    return r.status_code == 200


def pedir_reset(email):
    return client.post("/api/v1/auth/forgot-password", json={"email": email})


def cambiar(token, nueva="nueva-clave-123"):
    return client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": nueva},
    )


def test_flujo_completo_cambia_la_contrasena(bandeja):
    crear_paciente("ana@test.com", "vieja-clave-1")

    r = pedir_reset("ana@test.com")
    assert r.status_code == 200
    assert len(bandeja) == 1
    assert bandeja[0]["to"] == "ana@test.com"

    r = cambiar(token_del_correo(bandeja[0]))
    assert r.status_code == 200, r.text
    assert puede_loguearse("ana@test.com", "nueva-clave-123")
    assert not puede_loguearse("ana@test.com", "vieja-clave-1")


def test_email_inexistente_responde_igual_y_no_manda_correo(bandeja):
    crear_paciente("ana@test.com", "vieja-clave-1")

    existe = pedir_reset("ana@test.com")
    no_existe = pedir_reset("nadie@test.com")

    # Misma respuesta: asi nadie puede averiguar quien tiene cuenta
    assert no_existe.status_code == existe.status_code == 200
    assert no_existe.json() == existe.json()
    assert len(bandeja) == 1


def test_el_token_solo_sirve_una_vez(bandeja):
    crear_paciente("ana@test.com", "vieja-clave-1")
    pedir_reset("ana@test.com")
    token = token_del_correo(bandeja[0])

    assert cambiar(token).status_code == 200
    assert cambiar(token, "otra-clave-456").status_code == 400


def test_token_vencido_no_sirve(bandeja):
    crear_paciente("ana@test.com", "vieja-clave-1")
    pedir_reset("ana@test.com")
    token = token_del_correo(bandeja[0])

    # Viajamos en el tiempo: hacemos que el token haya vencido hace 1 minuto
    with SessionLocal() as db:
        db.execute(
            update(PasswordResetToken).values(
                expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)
            )
        )
        db.commit()

    assert cambiar(token).status_code == 400
    assert puede_loguearse("ana@test.com", "vieja-clave-1")


def test_pedir_un_token_nuevo_anula_el_anterior(bandeja):
    crear_paciente("ana@test.com", "vieja-clave-1")
    pedir_reset("ana@test.com")
    pedir_reset("ana@test.com")
    viejo, nuevo = token_del_correo(bandeja[0]), token_del_correo(bandeja[1])

    assert cambiar(viejo).status_code == 400
    assert cambiar(nuevo).status_code == 200


def test_token_inventado_no_sirve():
    assert cambiar("esto-es-un-token-inventado").status_code == 400


def test_contrasena_nueva_muy_corta_devuelve_422(bandeja):
    crear_paciente("ana@test.com", "vieja-clave-1")
    pedir_reset("ana@test.com")

    r = cambiar(token_del_correo(bandeja[0]), nueva="corta")

    assert r.status_code == 422


def test_el_token_no_se_guarda_en_texto_plano(bandeja):
    crear_paciente("ana@test.com", "vieja-clave-1")
    pedir_reset("ana@test.com")
    token = token_del_correo(bandeja[0])

    with SessionLocal() as db:
        guardado = db.query(PasswordResetToken).one()
    assert guardado.token_hash != token
    assert len(guardado.token_hash) == 64  # SHA-256 en hexadecimal
