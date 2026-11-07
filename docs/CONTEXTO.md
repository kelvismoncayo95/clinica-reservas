# Contexto del Proyecto - Sistema de Reservas Clínica

Este documento explica el propósito del proyecto, las decisiones técnicas y el estado actual, para que cualquier desarrollador que se sume entienda el contexto.

## 1. ¿Qué es este proyecto?
Es un sistema web de gestión de turnos para una clínica médica pequeña. Reemplaza la gestión por WhatsApp y planillas por un sistema centralizado con 4 roles: Admin, Recepción, Médico y Paciente.

## 2. Stack Tecnológico
- **Backend:** FastAPI (Python 3.12), SQLAlchemy 2.x, Alembic, Pydantic v2.
- **Base de datos:** PostgreSQL 15 (con extensión `btree_gist`).
- **Frontend:** HTML, CSS y JavaScript vanilla (en proceso de migración a React).
- **Infraestructura:** Docker, Docker Compose, GitHub Actions (CI).
- **Testing:** Pytest (36 tests de integración).
- **Deploy:** Backend en Render, Frontend en Vercel, DB en Neon.

## 3. Decisiones Técnicas Clave
- **Evitar solapamientos:** Se usa un `EXCLUDE USING gist` en PostgreSQL. Si dos personas reservan el mismo horario a la vez, la base de datos frena la segunda. El backend lo captura y devuelve un error amigable.
- **Zona Horaria:** El sistema usa `ZoneInfo` (America/Montevideo) para comparar fechas y horas, evitando el bug de UTC.
- **Tests:** Los tests corren contra una base separada (`clinica_test`). Se crean datos con fixtures y se limpian después.
- **Emails:** Integración con Resend API. En desarrollo, solo envía al email de prueba.
- **Seguridad:** Rate limiting (5/min en login), XSS protection, JWT, gitleaks (sin secretos en el repo).

## 4. Estado Actual
- **Backend:** 37 endpoints funcionando.
- **Frontend:** Login, panel de paciente, panel de admin, panel de médico.
- **Tests:** 36 tests en verde, CI configurado en GitHub Actions.
- **Deploy:** Sistema desplegado y funcionando en internet.
- **Datos:** Base de datos poblada con 50 pacientes, 6 médicos y 100 citas (datos ficticios).

## 5. Metodología de Trabajo
Para futuros colaboradores (o IAs), leer `docs/METODOLOGIA_TRABAJO.md`. Reglas clave:
- Producción (`main`) siempre debe estar estable.
- Nunca borrar la base de datos de producción.
- Trabajar en ramas `feature/...`.
- Probar en local antes de subir.

## 6. Pendientes (Feedback de QA)
1. ~~**Responsive móvil:** Ajustar vistas en celulares.~~ (Resuelto)
2. ~~**Edición/Creación de médicos:** El formulario actual no guarda cambios.~~ (Resuelto)
3. **Verificación de doble correo:** Al registrarse, pedir confirmación por email.
4. ~~**Recuperación de contraseña:** Implementar "Olvidé mi contraseña".~~ (Resuelto)
5. ~~**Fechas en agenda del paciente:** Mejorar legibilidad.~~ (Resuelto)
6. ~~**Horarios en agenda:** Mejorar legibilidad.~~ (Resuelto)
7. **Búsqueda con tildes:** El buscador debe tratar "Garcia" y "García" como iguales (usar normalización o `unaccent` en PostgreSQL).
