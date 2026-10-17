from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_auth_headers(email, password):
    """Hace login y devuelve las cabeceras con el token."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password}
    )
    assert response.status_code == 200, f"Fallo login: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_login_exitoso():
    """Test 1: un usuario con credenciales válidas recibe un token."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@test.com", "password": "admin123"}
    )
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert len(data["access_token"]) > 20


def test_login_fallido_contrasena_incorrecta():
    """Test 2: contraseña incorrecta devuelve 401."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@test.com", "password": "contrasena_incorrecta_123"}
    )
    assert response.status_code == 401, f"Esperaba 401, recibí {response.status_code}"


def test_paciente_no_puede_listar_pacientes():
    """Test 3: un paciente NO puede listar a todos los pacientes (403)."""
    headers = get_auth_headers("juan.perez@test.com", "prueba123")
    response = client.get("/api/v1/patients", headers=headers)
    assert response.status_code == 403, f"Esperaba 403, recibí {response.status_code}"


def test_sin_token_no_puede_listar_pacientes():
    """Test 4: sin token, el endpoint devuelve 401."""
    response = client.get("/api/v1/patients")
    assert response.status_code == 401, f"Esperaba 401, recibí {response.status_code}"
