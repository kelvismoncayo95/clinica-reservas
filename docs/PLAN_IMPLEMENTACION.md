# Plan de Implementación - Pendientes (QA y UX)

Este documento detalla los pasos a seguir para resolver los problemas reportados.

## 1. Búsqueda con Tildes (RESUELTO)
- **Problema:** "Garcia" no encontraba "García".
- **Solución:** Se agregó `normalizarTexto()` en `config.js` y se aplicó en los filtros.

## 2. Responsive Móvil (PRIORIDAD MEDIA)
- **Problema:** Tablas y modales se rompen en pantallas pequeñas.
- **Solución:** Ajustar CSS con `@media (max-width: 768px)` y usar `overflow-x: auto` en tablas.

## 3. Edición/Creación de Médicos (BUG CRÍTICO)
- **Problema:** El formulario no guarda cambios.
- **Causa probable:** El endpoint `POST /doctors` no recibe bien los datos o el frontend no envía los campos correctos.
- **Solución:** Revisar `app/api/doctors.py` y `frontend/js/medicos-admin.js`.

## 4. Verificación de Doble Correo (SEGURIDAD)
- **Problema:** Los usuarios pueden registrarse con emails falsos.
- **Solución:** Implementar envío de email de confirmación con Resend (requiere dominio verificado).

## 5. Recuperación de Contraseña (UX)
- **Problema:** No hay "Olvidé mi contraseña".
- **Solución:** Endpoint `/auth/forgot-password` que envía un email con un token temporal.

## 6. Mejoras de Agenda (UX)
- **Problema:** Fechas y horarios difíciles de leer.
- **Solución:** Cambiar formato de fecha (ej: "Lunes 4 de Nov") y agrupar horarios por bloques (mañana/tarde).

## 7. Migración a React (FUTURO)
- **Recomendación de mentor:** React + Vite + TypeScript.
- **Plan:** Empezar por el login y el dashboard de cliente, dejando el backend igual.
