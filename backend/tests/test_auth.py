from fastapi.testclient import TestClient
from app.main import app
from tests.helpers import crear_paciente, crear_admin

client = TestClient(app)


def get_auth_headers(email, password):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password}
    )
    assert response.status_code == 200, f"Fallo login: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_login_exitoso():
    """Test 1: un usuario con credenciales válidas recibe un token."""
    crear_admin("admin@test.com", "admin123")
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@test.com", "password": "admin123"}
    )
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_fallido_contrasena_incorrecta():
    """Test 2: contraseña incorrecta devuelve 401."""
    crear_admin("admin@test.com", "admin123")
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@test.com", "password": "incorrecta"}
    )
    assert response.status_code == 401


def test_paciente_no_puede_listar_pacientes():
    """Test 3: un paciente NO puede listar a todos los pacientes (403)."""
    crear_paciente("paciente1@test.com", "prueba123", "11111111")
    headers = get_auth_headers("paciente1@test.com", "prueba123")
    response = client.get("/api/v1/patients", headers=headers)
    assert response.status_code == 403


def test_sin_token_no_puede_listar_pacientes():
    """Test 4: sin token, el endpoint devuelve 401."""
    response = client.get("/api/v1/patients")
    assert response.status_code == 401


def test_registro_publico_paciente_exitoso():
    """Test: un paciente puede registrarse desde el endpoint público."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Nuevo",
            "last_name": "Paciente",
            "dni": "99999999",
            "birth_date": "1995-05-15",
            "phone": "099999999",
            "email": "nuevo.paciente@test.com",
            "password": "prueba123",
            "obra_social": "ASSE",
        }
    )
    assert response.status_code == 201, f"Error: {response.text}"


def test_registro_publico_email_duplicado():
    """Test: no se puede registrar dos veces el mismo email."""
    payload = {
        "first_name": "Duplicado",
        "last_name": "Uno",
        "dni": "88888888",
        "birth_date": "1995-05-15",
        "phone": "099999999",
        "email": "duplicado@test.com",
        "password": "prueba123",
        "obra_social": "ASSE",
    }
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201, f"Error al crear el primero: {r1.text}"

    # Intentar registrar el mismo email con otro DNI
    payload2 = payload.copy()
    payload2["dni"] = "77777777"
    r2 = client.post("/api/v1/auth/register", json=payload2)
    assert r2.status_code == 409, f"Esperaba 400, recibí {r2.status_code}: {r2.text}"


def test_registro_publico_dni_duplicado():
    """Test: no se puede registrar dos veces el mismo DNI."""
    payload = {
        "first_name": "Duplicado",
        "last_name": "Dos",
        "dni": "66666666",
        "birth_date": "1995-05-15",
        "phone": "099999999",
        "email": "duplicado.dos@test.com",
        "password": "prueba123",
        "obra_social": "ASSE",
    }
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201, f"Error al crear el primero: {r1.text}"

    # Intentar registrar el mismo DNI con otro email
    payload2 = payload.copy()
    payload2["email"] = "duplicado.dos.tres@test.com"
    r2 = client.post("/api/v1/auth/register", json=payload2)
    assert r2.status_code == 409, f"Esperaba 400, recibí {r2.status_code}: {r2.text}"
