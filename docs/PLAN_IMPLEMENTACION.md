# Plan de Implementación - Pendientes (QA y UX)

Este documento detalla los pasos a seguir para resolver los problemas reportados.

## 1. Búsqueda con Tildes (RESUELTO)
- **Problema:** "Garcia" no encontraba "García".
- **Solución:** Se agregó `normalizarTexto()` en `config.js` y se aplicó en los filtros.

## 2. Responsive Móvil (RESUELTO)
- **Problema:** En el celular, la Agenda del admin hacía que toda la página se corriera hacia los costados.
- **Causa:** `.app-main` es un hijo de un layout flex y se estiraba al ancho de la tabla (le faltaba `min-width: 0`). Además había CSS dañado en `.filtros-acciones` (`display:ita flex;`).
- **Solución:** `min-width: 0` en `.app-main`, CSS corregido, y la tabla de la Agenda se muestra como tarjetas en pantallas de hasta 600px. Revisadas en tamaño iPhone todas las pantallas de admin, paciente, médico, login, registro y recuperar contraseña.

## 3. Edición/Creación de Médicos (RESUELTO)
- **Problema:** El formulario no abría ni guardaba.
- **Causa:** En `medicos-admin.js` se usaba un elemento que ya no existía (`med-user-email-group`) y una variable mal escrita (`medState`), y no se enviaban `password` ni `specialty_ids`. En el backend, cambiar el email del médico no cambiaba su email de login y no se validaba el formato.
- **Solución:** Frontend corregido, email sincronizado con `users` (con chequeo de duplicados) y 8 tests nuevos en `backend/tests/test_doctors.py`.

## 4. Verificación de Doble Correo (SEGURIDAD)
- **Problema:** Los usuarios pueden registrarse con emails falsos.
- **Solución:** Implementar envío de email de confirmación con Resend (requiere dominio verificado).

## 5. Recuperación de Contraseña (RESUELTO)
- **Problema:** No había "Olvidé mi contraseña".
- **Solución:** `POST /auth/forgot-password` y `POST /auth/reset-password`, tabla `password_reset_tokens` y página `frontend/reset-password.html`.
- **Seguridad:** el token se guarda hasheado (SHA-256), vence a los 30 minutos, sirve una sola vez, pedir uno nuevo anula los anteriores, la respuesta no revela si el email existe y hay rate limit.
- **Tests:** 8 tests en `backend/tests/test_password_reset.py`.

## 6. Mejoras de Agenda (RESUELTO)
- **Problema:** Fechas y horarios difíciles de leer.
- **Solución:** función única `formatFechaLegible()` en `config.js` ("Lunes 9 de noviembre", "Lun 9 nov", "Hoy", "Mañana", "Ayer") usada en paciente, médico, citas y agenda. Los horarios para reservar se agrupan en "Mañana" y "Tarde" (`renderHorariosPorBloque()`).
- **Bugs encontrados al probar:** un nombre repetido (`DIAS_SEMANA`) que habría roto la sección Horarios del admin, y horarios duplicados si se cambiaba la fecha rápido.

## 7. Migración a React (FUTURO)
- **Recomendación de mentor:** React + Vite + TypeScript.
- **Plan:** Empezar por el login y el dashboard de cliente, dejando el backend igual.
