# 🏥 Sistema de Reservas para Clínica Médica

[![Tests](https://github.com/kelvismoncayo95/clinica-reservas/actions/workflows/tests.yml/badge.svg)](https://github.com/kelvismoncayo95/clinica-reservas/actions/workflows/tests.yml)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

🇬🇧 [Read in English](README.md)

Aplicación web completa que reemplaza el WhatsApp y las planillas de una clínica médica pequeña: los pacientes reservan sus propias citas, recepción organiza la agenda del día y los médicos ven sus turnos.

Hecha con **FastAPI**, **PostgreSQL** y **JavaScript sin frameworks**, con foco en el backend: reglas de negocio, integridad de datos, seguridad y tests automáticos.

<p align="center">
  <img src="docs/screenshots/mobile-calendario.png" width="230" alt="Calendario con los días disponibles del médico">
  &nbsp;
  <img src="docs/screenshots/mobile-horarios.png" width="230" alt="Horarios libres agrupados en mañana y tarde">
  &nbsp;
  <img src="docs/screenshots/mobile-mis-citas.png" width="230" alt="Citas del paciente">
</p>

---

## 🌐 Demo en vivo

| | Link |
|---|---|
| **Aplicación web** | [clinica-reservas-frontend.vercel.app](https://clinica-reservas-frontend.vercel.app/) |
| **Documentación de la API (Swagger)** | [clinica-reservas.onrender.com/docs](https://clinica-reservas.onrender.com/docs) |

**Cuentas de prueba** (todos los datos son ficticios):

| Rol | Email | Contraseña |
| :--- | :--- | :--- |
| **Admin** | `maria.admin@clinicadelsur.test` | `clinicadelsur2026` |
| **Recepción** | `sofia.recepcion@clinicadelsur.test` | `clinicadelsur2026` |
| **Médico** | `martin.garcia@clinicadelsur.test` | `clinicadelsur2026` |
| **Paciente** | Tocá **"Registrarme"** y creá tu propia cuenta | — |

> ⏳ El backend está en el plan gratuito de Render, que se "duerme" después de 15 minutos sin uso. El primer pedido puede tardar hasta 50 segundos.

---

## ✨ Funcionalidades

**Para pacientes**
- Registro, inicio de sesión y **recuperación de contraseña** por email.
- **Calendario de disponibilidad**: los días en verde se pueden reservar; los grises explican por qué no (el médico no atiende ese día, ausencia, sin turnos libres…).
- Horarios agrupados en **mañana / tarde**.
- Cancelar y reprogramar sus propias citas.

**Para el personal**
- **Acceso por roles**: Admin, Recepción, Médico y Paciente, cada uno con su panel.
- Agenda semanal, búsqueda y filtros de citas, registro de asistencia (atendida / no asistió).
- Alta, baja y edición de médicos, pacientes, especialidades y horarios semanales. Un horario se puede cerrar con una fecha de corte sin tocar las citas pasadas.
- Los médicos pueden avisar una ausencia: recepción la ve y ese día deja de poder reservarse.

**Por dentro**
- **48 endpoints REST**, documentados con OpenAPI/Swagger.
- **36 tests de integración** que corren en cada push con GitHub Actions.
- Notificaciones por email (reserva, cancelación, reprogramación y recuperación de contraseña) con la API de Resend.
- Diseño responsive, revisado en celular y computadora.

<p align="center">
  <img src="docs/screenshots/admin-agenda.png" width="49%" alt="Agenda semanal del admin">
  <img src="docs/screenshots/admin-nueva-cita.png" width="49%" alt="Recepción creando una cita con el calendario de disponibilidad">
</p>

---

## 🧠 Decisiones técnicas

### 1. Es imposible reservar dos veces el mismo turno, incluso con pedidos simultáneos
Verificar en Python "¿está libre este horario?" no alcanza: dos pedidos pueden preguntar al mismo tiempo, los dos ven el horario libre y los dos guardan la cita (una **condición de carrera**). Por eso lo garantiza PostgreSQL con una **restricción `EXCLUDE USING gist`** sobre `(médico, rango de fecha y hora)` para las citas confirmadas. Si dos personas reservan el mismo turno a la vez, la base de datos rechaza la segunda y la API responde con un `409 Conflict` amigable.

### 2. Las reglas de negocio viven en el backend, en un solo lugar
La anticipación mínima (1 hora), la ventana máxima de reserva (60 días), el máximo de 3 citas futuras por paciente, la regla de cancelación con 24 horas, los horarios del médico, los días bloqueados y las ausencias se validan en la capa de servicios. Se configuran con variables de entorno.
El calendario de disponibilidad **no repite** esa lógica en JavaScript: llama a `GET /doctors/{id}/available-dates`, que aplica las mismas reglas y devuelve, día por día, si se puede reservar y el **motivo** si no.

### 3. Sin consultas N+1
El endpoint de disponibilidad trae los horarios, bloqueos, ausencias y citas de todo el mes en **4 consultas** y calcula cada día en memoria, en vez de consultar una vez por día. Los listados usan `selectinload` de SQLAlchemy por la misma razón.

### 4. Recuperación de contraseña segura
- Los tokens son aleatorios (`secrets.token_urlsafe`) y **solo se guarda su hash SHA-256**: si alguien roba la base de datos, no puede usar los tokens.
- Vencen en 30 minutos, se usan una sola vez y pedir uno nuevo anula los anteriores.
- El endpoint responde lo mismo exista o no el email, y manda el correo en segundo plano, para evitar la **enumeración de usuarios** (que alguien averigüe quién tiene cuenta).
- Tiene límite de pedidos (3 por minuto).

### 5. Reglas que respetan la zona horaria
"¿Todavía se puede cancelar esta cita?" depende de la hora local de la clínica, no de la del servidor (que en Render está en UTC). Todas las comparaciones de tiempo usan `ZoneInfo("America/Montevideo")`.

### 6. Deploys automáticos y seguros
En cada deploy, Render ejecuta `alembic upgrade head && uvicorn ...`. Gracias al `&&`, si una migración falla la versión nueva nunca arranca y sigue funcionando la anterior.

### 7. Historial y borrado lógico
Los médicos, pacientes y horarios se desactivan en vez de borrarse (`activo`, `deactivated_at`, `deactivated_by`), y cada cambio de una cita queda registrado en `appointment_logs`.

---

## 🗂️ Base de datos

```mermaid
erDiagram
    users ||--o| patients : "tiene ficha"
    users ||--o| doctors : "tiene ficha"
    users ||--o{ password_reset_tokens : pide
    doctors }o--o{ specialties : "doctor_specialties"
    doctors ||--o{ schedules : trabaja
    doctors ||--o{ blocks : "días bloqueados"
    doctors ||--o{ doctor_absences : avisa
    patients ||--o{ appointments : reserva
    doctors ||--o{ appointments : atiende
    specialties ||--o{ appointments : "de"
    appointments ||--o{ appointment_logs : "historial"

    users {
        int id PK
        string email UK
        string password_hash
        string role "admin | reception | doctor | patient"
        bool activo
    }
    patients {
        int id PK
        int user_id FK
        string dni UK
        string first_name
        string last_name
        date birth_date
    }
    doctors {
        int id PK
        int user_id FK
        string license_number UK
        string first_name
        string last_name
    }
    specialties {
        int id PK
        string name UK
    }
    schedules {
        int id PK
        int doctor_id FK
        int day_of_week "0 = lunes"
        time start_time
        time end_time
        int slot_duration_minutes
        date valid_until "fecha de corte"
    }
    appointments {
        int id PK
        int patient_id FK
        int doctor_id FK
        int specialty_id FK
        date appointment_date
        time start_time
        time end_time
        string status "confirmed | attended | no_show | cancelled"
    }
    blocks {
        int id PK
        int doctor_id FK
        date start_date
        date end_date
    }
    doctor_absences {
        int id PK
        int doctor_id FK
        date absence_date
    }
    appointment_logs {
        int id PK
        int appointment_id FK
        string action
        int performed_by FK
    }
    password_reset_tokens {
        int id PK
        int user_id FK
        string token_hash UK
        datetime expires_at
        datetime used_at
    }
```

---

## 🏗️ Arquitectura

```mermaid
flowchart LR
    Browser["Navegador<br/>HTML · CSS · JS<br/>(Vercel)"] -->|"REST + JWT"| API["FastAPI<br/>(Render)"]
    API --> Routers["api/<br/>endpoints"]
    Routers --> Services["services/<br/>reglas de negocio"]
    Services --> Models["models/<br/>SQLAlchemy"]
    Models --> DB[("PostgreSQL<br/>(Neon)")]
    Services -->|emails| Resend["API de Resend"]
```

El backend está organizado en capas: los **routers** se ocupan de HTTP (validación con Pydantic y códigos de estado), los **services** tienen las reglas de negocio y los **models** representan la base de datos. Los routers nunca contienen lógica de negocio.

---

## 🛠️ Tecnologías

| Capa | Tecnologías |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, Alembic |
| Base de datos | PostgreSQL 15 (extensión `btree_gist`) |
| Autenticación y seguridad | JWT, bcrypt, slowapi (límite de pedidos), escape de HTML contra XSS, gitleaks |
| Frontend | HTML5, CSS3, JavaScript sin frameworks |
| Tests | Pytest (tests de integración contra un PostgreSQL real), CI con GitHub Actions |
| DevOps | Docker, Docker Compose, GitHub Actions, Render, Vercel, Neon |

---

## ⚙️ Correrlo en tu computadora

**Necesitás:** Docker y Python 3.

```bash
# 1. Clonar el repositorio
git clone https://github.com/kelvismoncayo95/clinica-reservas.git
cd clinica-reservas

# 2. Levantar PostgreSQL y la API
docker compose up -d --build

# 3. Crear las tablas y cargar los datos de demo
docker compose exec db psql -U postgres -d clinica_reservas -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
docker compose exec api alembic upgrade head
docker compose exec api python -m scripts.seed_demo_data

# 4. Servir el frontend
cd frontend && python3 -m http.server 5500
```

- Aplicación web: http://localhost:5500
- Documentación de la API: http://localhost:8000/docs

Para configurar los emails y las reglas de negocio, copiá `backend/.env.example` a `backend/.env` y ajustá los valores.

### Correr los tests

Los tests usan una base de datos aparte llamada `clinica_test` (nunca tocan tus datos reales):

```bash
docker compose exec db psql -U postgres -c "CREATE DATABASE clinica_test;"
docker compose exec db psql -U postgres -d clinica_test -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"

cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/clinica_test SECRET_KEY=test pytest -q
```

---

## 📦 Estructura del proyecto

```
backend/
  app/
    api/        → endpoints HTTP (routers)
    services/   → reglas de negocio
    models/     → tablas (SQLAlchemy)
    schemas/    → validación (Pydantic)
    core/       → configuración, seguridad, límite de pedidos
  alembic/      → migraciones de la base de datos
  tests/        → tests de integración (Pytest)
  scripts/      → carga de datos de demo
frontend/       → cliente HTML/CSS/JS
docs/           → PRD, documentación técnica, capturas
```

---

## 👨‍💻 Autor

**Kelvis Moncayo** — Desarrollador backend (Python)
- [LinkedIn](https://linkedin.com/in/kelvismoncayohurtado)
