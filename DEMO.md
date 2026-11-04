# 🏥 Clínica Médica - Documentación de la Demo

Este proyecto es una **demostración funcional** de un sistema de gestión de turnos médicos. No es un producto listo para producción, sino una muestra de arquitectura, lógica de negocio y diseño de interfaces.

## 💡 ¿Por qué está pensado así?

### 1. El problema real
Una clínica pequeña gestiona sus turnos por WhatsApp, lo que genera solapamientos, olvidos y falta de trazabilidad. Este sistema centraliza esa operación.

### 2. Roles y permisos
- **Admin:** Dueño del sistema. Crea médicos, especialidades y gestiona todo.
- **Recepción:** El día a día. Agenda, cancela y reprograma turnos.
- **Médico:** Ve su agenda y marca asistencia. No puede modificar turnos (regla de negocio de la clínica).
- **Paciente:** Se registra solo, ve médicos y reserva. Solo ve sus propias citas (privacidad).

### 3. Lógica de negocio compleja
- **Evitar solapamientos:** Se usa un `EXCLUDE USING gist` en PostgreSQL. Si dos personas reservan el mismo horario a la vez, la base de datos frena la segunda. El backend lo captura y devuelve un error amigable.
- **Anticipación:** El paciente debe reservar con al menos 1 hora de anticipación y no más de 60 días.
- **Cancelación:** El paciente solo puede cancelar con 24 horas de anticipación (para no dejar el hueco vacío).
- **Cierre de horarios:** Si un médico deja de atender los martes, el admin puede poner una "fecha de corte". Las citas viejas se mantienen, pero no se generan nuevas.

### 4. Datos de prueba
La base de datos en la nube (Neon) fue poblada con 50 pacientes falsos y 100 citas. **Ningún dato es real**. Los nombres y DNIs son inventados.

## 🚀 ¿Cómo probar la demo?
1. Entrá a la web (link en el README principal).
2. Usá las credenciales de la tabla de arriba para entrar como Admin, Recepción o Médico.
3. Para probar como Paciente, **registrate con cualquier email** (no se pide contraseña, el sistema la genera).
4. Reservá una cita con cualquier médico y probá cancelarla o reprogramarla.
