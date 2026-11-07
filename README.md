# 🏥 Medical Clinic Booking System

A full-stack web application for managing medical appointments, built with **FastAPI**, **PostgreSQL**, and **Vanilla JavaScript**.

## ✨ Features
- **Role-based access control:** Admin, Receptionist, Doctor, and Patient.
- **Smart Scheduling:** Prevents overlapping appointments using PostgreSQL `EXCLUDE` constraints.
- **Business Rules Engine:** Configurable rules via `.env` (min/max advance booking, max future appointments per patient).
- **Email Notifications:** Integration with Resend API for booking, cancellation, and rescheduling alerts.
- **Audit Trail:** Soft deletes and `appointment_logs` track all critical changes.
- **Password Recovery:** "Forgot password" flow with single-use, hashed, time-limited tokens.
- **Security:** JWT authentication, bcrypt password hashing, Rate Limiting (5 req/min on login), XSS protection.


## 🌐 Live Demo & Test Credentials

**Frontend (Web App):** [https://clinica-reservas-frontend.vercel.app/](https://clinica-reservas-frontend.vercel.app/)
**Backend (API Docs):** [https://clinica-reservas.onrender.com/docs](https://clinica-reservas.onrender.com/docs)

### How to test the system (Please read):
To test the full flow, you have two options:

1. **As a Patient (Register):** Click on "Registrarme" (Sign up) and create a new patient account with a valid email (e.g., your own Gmail). Then, you can book, view, and cancel appointments.
2. **As Staff (Login):** Use one of the following pre-seeded accounts to access the Admin, Reception, or Doctor panels.

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `maria.admin@clinicadelsur.test` | `clinicadelsur2026` |
| **Reception** | `sofia.recepcion@clinicadelsur.test` | `clinicadelsur2026` |
| **Doctor** | `martin.garcia@clinicadelsur.test` | `clinicadelsur2026` |

*(Note: The free tier of Render spins down after 15 minutes of inactivity. The first request may take up to 50 seconds to wake up the server).*

## 🛠️ Tech Stack
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2.
- **Database:** PostgreSQL 15 (with `btree_gist` extension).
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (no frameworks).
- **DevOps:** Docker, Docker Compose, GitHub Actions (CI).
- **Testing:** Pytest (30 integration tests covering core business rules).

## 📦 Project Structure
- backend/: FastAPI application (API, models, schemas, services)
- backend/alembic/: Database migrations
- backend/tests/: Pytest test suite
- frontend/: Static HTML/CSS/JS client
- docker-compose.yml: Container orchestration

## ⚙️ How to run locally (Docker)
1. Clone the repository.
2. Create your `.env` file based on `.env.example`.
3. Run:
   docker compose up -d
   docker compose exec api alembic upgrade head
4. Access the API docs at `http://localhost:8000/docs`.

## 🧠 Key Technical Decisions
- **Overlap Prevention:** Used PostgreSQL `EXCLUDE USING gist` constraint instead of application-level checks. This guarantees data integrity even under race conditions.
- **Timezone Handling:** The system relies on `ZoneInfo` (America/Montevideo) to compare naive datetimes properly. This prevents bugs when checking if a cancellation is allowed.
- **Testing Strategy:** Tests run against an isolated `clinica_test` database. They create their own data (fixtures) and truncate tables after each run. CI runs these tests automatically on every push.
- **Email Testing:** Integrated Resend API. In development, it only sends emails to the registered test account (sandbox mode).

## 🔒 Security
- Passwords are hashed with bcrypt.
- JWT tokens expire in 60 minutes.
- Login endpoint is rate-limited (slowapi).
- HTML escaping on the frontend to prevent XSS.
- No secrets in Git history (verified with `gitleaks`).

## 👨‍💻 Author
**Kelvis Moncayo**
- [LinkedIn](https://linkedin.com/in/kelvismoncayohurtado)
