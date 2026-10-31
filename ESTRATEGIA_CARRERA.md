# ESTRATEGIA DE CARRERA Y ESTUDIO - BACKEND DEVELOPER

Este documento define el rumbo de aprendizaje y el portafolio a construir para ingresar al mercado laboral IT (enfocado en Backend). Basado en el análisis de ofertas reales y en el proyecto en curso (Sistema de Reservas Clínica).

## 1. El Punto de Partida (Lo que YA TENEMOS)
Tenemos un proyecto **en curso** (Sistema de Reservas para Clínica con FastAPI + PostgreSQL). Fue construido utilizando asistentes de IA, pero **entendiendo cada parte y cada decisión técnica**.
*   **Python**, **FastAPI**, **APIs REST**.
*   **PostgreSQL** y migraciones (Alembic).
*   Seguridad básica (JWT, hashing, rate limiting, XSS).
*   **Lógica de Negocio compleja** (solapamientos, estados).
*   Integración con APIs externas (Resend en modo de pruebas).
*   **Git**, **GitHub**, **pytest**, **gitleaks**.

## 2. El Mercado Laboral (Lo que piden las empresas)
Muestra inicial de 6 ofertas (n=6). El patrón que se repite:
*   **Docker:** Altísima frecuencia (Requisito no negociable).
*   **Testing (Pytest):** Alta frecuencia.
*   **Cloud (AWS):** Alta frecuencia.
*   **SQL / Bases de Datos:** Altísima frecuencia.
*   **Automatización de Datos:** Media.
*   **Microservicios / Go / Java:** Media (perfil Senior).

## 3. Definición de "Terminado" (Proyecto Clínica)
La clínica estará lista para el CV cuando cumpla estos 6 puntos:
1. **Bugs corregidos:** Zona horaria, horarios cerrados (`valid_until`), especialidad del médico, choques de reserva (`IntegrityError`), registro público. **✅ COMPLETADO**
2. **Tests con base de pruebas separada:** Pytest corriendo en `clinica_test`. **✅ COMPLETADO (14 tests)**
3. **CI (Integración Continua):** GitHub Actions ejecutando tests en cada commit (insignia verde). **⏸️ PENDIENTE**
4. **Seguridad básica:** Freno al login (rate limiting), XSS, sin credenciales en el historial. **✅ COMPLETADO (gitleaks limpio)**
5. **Docker:** `docker compose up` levanta la API y la base de datos. **⏸️ BLOQUEADO (virtualización en BIOS)**
6. **Despliegue y Demo:** Sistema en Render con datos falsos. README en inglés. **⏸️ PENDIENTE**

## 4. Calendario de Ejecución
**Disponibilidad:** 2 a 4 horas diarias, de lunes a viernes (aprox. 15 horas semanales).
*   **Semana 1:** Base de pruebas y primer test rojo a verde. **✅ COMPLETADO**
*   **Semana 2:** Resto de bugs de reglas (valid_until, especialidad, choque, registro). **✅ COMPLETADO**
*   **Semana 3:** Seguridad y permisos (XSS, rate limiting, gitleaks). **✅ COMPLETADO**
*   **Semana 4:** Docker y CI. **⏸️ PENDIENTE (Docker bloqueado)**
*   **Semana 5:** Despliegue y presentación (README, CV, LinkedIn). **⏸️ PENDIENTE**
*   **Semana 6:** Margen y entrevistas. **⏸️ PENDIENTE**

## 5. Proyecto 2: Pipeline de Documentos a Datos
**Regla:** Aprender cada herramienta *justo antes* de usarla.
*   **Etapa 1 (Sin IA):** Subir un Excel/CSV, extraer datos con `pandas` y guardarlos en PostgreSQL.
*   **Etapa 2:** Tests y validación de errores.
*   **Etapa 3:** Docker Compose (API + Base de datos) y CI.
*   **Etapa 4 (PDF y IA):** Integrar `pdfplumber` para PDFs. Luego, integrar la API de IA para extraer campos cuando el formato varíe.
*   **Etapa 5:** Tareas en segundo plano y envío de resumen por email.
*   **Etapa 6:** Despliegue.

## 6. Metodología y Preparación
*   **Estudio dirigido:** Aprender lo mínimo necesario para avanzar en el proyecto.
*   **Documentar:** Escribir un párrafo de lo aprendido y los errores al final de cada etapa.
*   **Preparación para entrevistas:** Practicar en voz alta la explicación de 3 decisiones técnicas:
    1.  El control de solapamientos (`EXCLUDE constraint` en PostgreSQL).
    2.  El manejo de zona horaria (`ZoneInfo`).
    3.  Los permisos por rol (JWT y dependencias).
*   **Postulación temprana:** 5 postulaciones por semana a partir de la Semana 3.

## 7. Progreso Actual (31/10/2026)
- **14 tests en verde.**
- **Bugs arreglados:** Zona horaria, `valid_until`.
- **Seguridad:** XSS protegido, rate limiting (5/min), gitleaks (0 leaks).
- **Pendiente:** Docker (bloqueado por BIOS), CI, README, despliegue.
