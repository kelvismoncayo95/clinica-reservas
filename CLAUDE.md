# CLAUDE.md

Guía para cualquier sesión de IA que trabaje en este repositorio.
Este archivo es **uno solo** y se va actualizando: cuando aprendemos algo
nuevo sobre cómo trabajar, se agrega aquí (no se crean archivos aparte).

## Quién soy y para qué es este proyecto

- Soy Kelvis. Estoy aprendiendo desarrollo **backend** para conseguir mi
  primer trabajo como **desarrollador junior** en Montevideo, Uruguay.
- Este proyecto es de estudio y una **demo para reclutadores**: tiene que
  funcionar bien, estar probado y verse profesional en GitHub.
- "Terminado" = que cumpla para lo que está hecho (sistema de turnos de una
  clínica pequeña), sin bugs en la demo.

## Cómo me gusta trabajar con IA

1. **Explícame como si tuviera 10 años.** Paso a paso, con ejemplos de la
   vida diaria (restaurante, cartero, cuadernos...). No des nada por sabido.
2. **Todo lo que esté en inglés, tradúcelo al español** en el momento
   (mensajes de error, botones de GitHub, términos técnicos). No sé mucho
   inglés.
3. **Cada palabra técnica nueva va con su pronunciación**, escrita como se
   lee en español. Ejemplo: merge → *mérch* = unir. Es para no equivocarme
   en las entrevistas.
4. **Antes de hacer algo grande, explícame qué se va a hacer y por qué.**
   Después muéstrame las partes importantes del código.
5. **Al terminar cada tarea, dame 1 o 2 preguntas de entrevista** sobre lo
   que hicimos, con la explicación y una respuesta de ejemplo.
6. **Dame una recomendación**, no solo opciones. Prefiero que me digas qué
   harías tú.
7. **Escríbeme SIEMPRE en español**, también en los mensajes cortos que
   escribes mientras trabajas ("ahora reviso...", "encontré..."). Nunca
   cambies al inglés a mitad de la explicación. Mensajes claros y ordenados
   (tablas y listas ayudan).
8. Cuando subas cambios, dime **en qué Pull Request están** y si ya quedaron
   publicados o falta que yo haga merge.

## Mi objetivo de carrera (para orientar las decisiones)

Las ofertas de Montevideo que me interesan piden sobre todo:
- Python + PostgreSQL + APIs REST (lo más alcanzable para mí ahora).
- Tests y calidad de código.
- Docker, cloud (AWS) y observabilidad (logs, métricas, monitoreo).
- Integraciones y uso de herramientas de IA.

La más realista: una fintech que usa Python y acepta perfil junior.
Plan: terminar este proyecto y después hacer un segundo proyecto
(una **API de billetera digital**) orientado a esas ofertas.

## Reglas para TODOS mis proyectos

1. **Primero los documentos, después el código.** Antes de programar un
   proyecto nuevo se escriben, en este orden:
   PRD → TRD → App Flow → UX/UI → Backend Schema → Plan de implementación.
   No se empieza a programar hasta que yo los revise.
2. **Cada proyecto tiene demo pública** que cualquiera pueda usar libremente
   (cuentas de prueba, datos ficticios y, si hace falta, un reinicio
   automático de los datos de la demo).
3. Próximo proyecto: **API de billetera digital** (`digital-wallet-api`).
   Código en inglés, documentación en inglés + español. Deploy en Render +
   Neon + Upstash (Redis); AWS queda como paso opcional al final.

## Reglas del proyecto

- `main` es producción: **nunca** se trabaja directo ahí. Todo va por rama +
  Pull Request.
- Deploy: Render (backend) y Vercel (frontend) publican desde `main`.
  Render corre `alembic upgrade head` antes de arrancar: las migraciones se
  aplican solas en cada deploy. Si la migración falla, el deploy no se
  publica y queda la versión anterior.
- Correos: Resend en modo prueba (remitente `onboarding@resend.dev`), solo
  llegan al email dueño de la cuenta de Resend.
- Nunca borrar la base de datos de producción.
- Antes de subir: correr los tests (`cd backend && pytest -q`) y, si se tocó
  el frontend, probarlo en el navegador.
- Los usuarios de la demo usan emails `.test` (ej. `maria.admin@clinicadelsur.test`).
  No usar validaciones que rechacen ese dominio (por ejemplo `EmailStr` de
  Pydantic en datos que vuelven en las respuestas).
- No subir secretos (claves, contraseñas) al repo.

## Mapa rápido del proyecto

- `backend/app/api/` → endpoints (las "puertas" de la API).
- `backend/app/services/` → la lógica de negocio.
- `backend/app/models/` → tablas de la base de datos (SQLAlchemy).
- `backend/app/schemas/` → validación de datos de entrada y salida (Pydantic).
- `backend/alembic/` → migraciones (cambios en la estructura de la base de datos).
- `backend/tests/` → tests con Pytest (usan la base `clinica_test`).
- `frontend/` → HTML, CSS y JS sin frameworks.
- `docs/` → PRD, TRD, plan de implementación y pendientes.
