# Backend Schema
## Tablas Principales
- users (id, email, password_hash, role)
- patients (id, user_id, dni, nombre, etc.)
- doctors (id, user_id, matricula)
- appointments (id, patient_id, doctor_id, fecha, hora, estado)
- schedules (id, doctor_id, dia_semana, hora_inicio, hora_fin)
- password_reset_tokens (id, user_id, token_hash, expires_at, used_at)
## Endpoints Clave
- POST /auth/login
- POST /auth/forgot-password (pedir enlace de recuperación)
- POST /auth/reset-password (cambiar contraseña con el token)
- POST /appointments (crear cita)
- GET /appointments?date=...
- PATCH /appointments/{id}/cancel
