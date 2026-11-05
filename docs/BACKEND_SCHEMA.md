# Backend Schema
## Tablas Principales
- users (id, email, password_hash, role)
- patients (id, user_id, dni, nombre, etc.)
- doctors (id, user_id, matricula)
- appointments (id, patient_id, doctor_id, fecha, hora, estado)
- schedules (id, doctor_id, dia_semana, hora_inicio, hora_fin)
## Endpoints Clave
- POST /auth/login
- POST /appointments (crear cita)
- GET /appointments?date=...
- PATCH /appointments/{id}/cancel
