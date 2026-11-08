# 🏥 Medical Clinic Booking System

[![Tests](https://github.com/kelvismoncayo95/clinica-reservas/actions/workflows/tests.yml/badge.svg)](https://github.com/kelvismoncayo95/clinica-reservas/actions/workflows/tests.yml)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

🇪🇸 [Leer en español](README.es.md)

A full-stack web application that replaces WhatsApp and spreadsheets for a small medical clinic: patients book their own appointments, reception manages the daily schedule, and doctors see their agenda.

Built with **FastAPI**, **PostgreSQL** and **vanilla JavaScript**, with a strong focus on the backend: business rules, data integrity, security and automated tests.

<p align="center">
  <img src="docs/screenshots/mobile-calendario.png" width="230" alt="Booking calendar showing the doctor's available days">
  &nbsp;
  <img src="docs/screenshots/mobile-horarios.png" width="230" alt="Available time slots grouped by morning and afternoon">
  &nbsp;
  <img src="docs/screenshots/mobile-mis-citas.png" width="230" alt="Patient's appointments">
</p>

---

## 🌐 Live Demo

| | Link |
|---|---|
| **Web App** | [clinica-reservas-frontend.vercel.app](https://clinica-reservas-frontend.vercel.app/) |
| **API Docs (Swagger)** | [clinica-reservas.onrender.com/docs](https://clinica-reservas.onrender.com/docs) |

**Test accounts** (all data is fictional):

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `maria.admin@clinicadelsur.test` | `clinicadelsur2026` |
| **Reception** | `sofia.recepcion@clinicadelsur.test` | `clinicadelsur2026` |
| **Doctor** | `martin.garcia@clinicadelsur.test` | `clinicadelsur2026` |
| **Patient** | Click **"Registrarme"** and create your own account | — |

> ⏳ The backend runs on Render's free tier and sleeps after 15 minutes of inactivity. The first request can take up to 50 seconds.

---

## ✨ Features

**For patients**
- Self sign-up, login and **password recovery** by email.
- **Availability calendar**: green days are bookable; grey days explain why not (doctor doesn't work that day, absence, fully booked…).
- Time slots grouped by **morning / afternoon**.
- Cancel and reschedule their own appointments.

**For staff**
- **Role-based access**: Admin, Reception, Doctor and Patient, each with its own panel.
- Weekly agenda, appointment search and filters, attendance tracking (attended / no-show).
- CRUD for doctors, patients, specialties and weekly schedules (with a cut-off date to close a schedule without touching past appointments).
- Doctors can report an absence; reception sees it and the day becomes unbookable.

**Under the hood**
- **48 REST endpoints**, documented with OpenAPI/Swagger.
- **36 integration tests** run on every push with GitHub Actions.
- Email notifications (booking, cancellation, rescheduling, password reset) through the Resend API.
- Responsive design, checked on phone and desktop.

<p align="center">
  <img src="docs/screenshots/admin-agenda.png" width="49%" alt="Admin weekly agenda">
  <img src="docs/screenshots/admin-nueva-cita.png" width="49%" alt="Reception creating an appointment with the availability calendar">
</p>

---

## 🧠 Key Technical Decisions

### 1. Double-booking is impossible, even under race conditions
Checking "is this slot free?" in Python is not enough: two requests can check at the same time, both see the slot free, and both insert. Instead, PostgreSQL enforces it with an **`EXCLUDE USING gist` constraint** on `(doctor_id, date, time range)` for confirmed appointments. If two people book the same slot at the same time, the database rejects the second one and the API returns a friendly `409 Conflict`.

### 2. Business rules live in the backend, once
Minimum notice (1 h), maximum booking window (60 days), max 3 future appointments per patient, 24 h cancellation rule, doctor schedules, blocked days and absences are all validated in the service layer. They are configurable via environment variables.
The availability calendar does **not** duplicate this logic in JavaScript: it calls `GET /doctors/{id}/available-dates`, which applies the same rules and returns, for each day, whether it is bookable and the **reason** if it is not.

### 3. No N+1 queries
The availability endpoint loads schedules, blocks, absences and appointments for the whole month in **4 queries** and computes each day in memory, instead of querying once per day. Lists use SQLAlchemy `selectinload` for the same reason.

### 4. Secure password recovery
- Tokens are random (`secrets.token_urlsafe`) and **only their SHA-256 hash is stored**, so a database leak does not expose usable tokens.
- Tokens expire in 30 minutes, are single-use, and requesting a new one invalidates the previous ones.
- The endpoint returns the same response whether the email exists or not, and sends the email in a background task, to prevent **user enumeration**.
- Rate limited (3 requests/minute).

### 5. Timezone-aware rules
"Can this appointment still be cancelled?" depends on the clinic's local time, not the server's (UTC on Render). All time comparisons use `ZoneInfo("America/Montevideo")`.

### 6. Automated, safe deployments
On every deploy, Render runs `alembic upgrade head && uvicorn ...`. Thanks to `&&`, if a migration fails the new version never starts and the previous one keeps serving traffic.

### 7. Audit trail and soft deletes
Doctors, patients and schedules are deactivated, not deleted (`activo`, `deactivated_at`, `deactivated_by`), and every change to an appointment is recorded in `appointment_logs`.

---

## 🗂️ Database Schema

```mermaid
erDiagram
    users ||--o| patients : "has profile"
    users ||--o| doctors : "has profile"
    users ||--o{ password_reset_tokens : requests
    doctors }o--o{ specialties : "doctor_specialties"
    doctors ||--o{ schedules : works
    doctors ||--o{ blocks : "blocked days"
    doctors ||--o{ doctor_absences : reports
    patients ||--o{ appointments : books
    doctors ||--o{ appointments : attends
    specialties ||--o{ appointments : "for"
    appointments ||--o{ appointment_logs : "history"

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
        int day_of_week "0 = Monday"
        time start_time
        time end_time
        int slot_duration_minutes
        date valid_until "cut-off date"
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

## 🏗️ Architecture

```mermaid
flowchart LR
    Browser["Browser<br/>HTML · CSS · JS<br/>(Vercel)"] -->|"REST + JWT"| API["FastAPI<br/>(Render)"]
    API --> Routers["api/<br/>endpoints"]
    Routers --> Services["services/<br/>business rules"]
    Services --> Models["models/<br/>SQLAlchemy"]
    Models --> DB[("PostgreSQL<br/>(Neon)")]
    Services -->|emails| Resend["Resend API"]
```

The backend follows a layered structure: **routers** handle HTTP (validation with Pydantic, status codes), **services** contain the business rules, and **models** map the database. Routers never contain business logic.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, Alembic |
| Database | PostgreSQL 15 (`btree_gist` extension) |
| Auth & security | JWT, bcrypt, slowapi (rate limiting), HTML escaping against XSS, gitleaks |
| Frontend | HTML5, CSS3, vanilla JavaScript (no frameworks) |
| Testing | Pytest (integration tests against a real PostgreSQL database), GitHub Actions CI |
| DevOps | Docker, Docker Compose, GitHub Actions, Render, Vercel, Neon |

---

## ⚙️ Run Locally

**Requirements:** Docker and Python 3.

```bash
# 1. Clone the repository
git clone https://github.com/kelvismoncayo95/clinica-reservas.git
cd clinica-reservas

# 2. Start PostgreSQL and the API
docker compose up -d --build

# 3. Create the tables and load demo data
docker compose exec db psql -U postgres -d clinica_reservas -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
docker compose exec api alembic upgrade head
docker compose exec api python -m scripts.seed_demo_data

# 4. Serve the frontend
cd frontend && python3 -m http.server 5500
```

- Web app: http://localhost:5500
- API docs: http://localhost:8000/docs

To configure emails and business rules, copy `backend/.env.example` to `backend/.env` and adjust the values.

### Run the tests

Tests run against a separate database called `clinica_test` (never against your real data):

```bash
docker compose exec db psql -U postgres -c "CREATE DATABASE clinica_test;"
docker compose exec db psql -U postgres -d clinica_test -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"

cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/clinica_test SECRET_KEY=test pytest -q
```

---

## 📦 Project Structure

```
backend/
  app/
    api/        → HTTP endpoints (routers)
    services/   → business rules
    models/     → SQLAlchemy tables
    schemas/    → Pydantic validation
    core/       → config, security, rate limiting
  alembic/      → database migrations
  tests/        → Pytest integration tests
  scripts/      → demo data loaders
frontend/       → static HTML/CSS/JS client
docs/           → PRD, technical docs, screenshots
```

---

## 👨‍💻 Author

**Kelvis Moncayo** — Backend developer (Python)
- [LinkedIn](https://linkedin.com/in/kelvismoncayohurtado)
