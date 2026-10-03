# YouAutoQA — Plan de Trabajo

> Complementa a `YouAutoQA_Requisitos.md`. Aquí se traduce el "qué" del documento de requisitos en un "cómo y en qué orden".
> Última actualización: 17/09/2026

---

## Enfoque general: Walking Skeleton

No construimos de arriba a abajo (todo el frontend, luego todo el backend...) ni de abajo a arriba (toda la infra primero). Construimos un **esqueleto delgado que atraviesa todas las capas** y funciona end-to-end desde el principio, aunque sea "feo" — y luego lo vamos engordando.

**Por qué importa esto para tu TFM:** te da algo demostrable en cada sprint (bueno para reuniones de seguimiento con tu tutor), y evita el riesgo clásico de quedarte sin tiempo al final con piezas sueltas que nunca se conectaron entre sí.

Orden de las fases, de menor a mayor riesgo/incertidumbre:

```
Fase 0: Setup del repo
Fase 1: Core del agente (LangGraph) — sin UI, sin infra
Fase 2: Integración Jira (MCP)
Fase 3: API + persistencia (Postgres)
Fase 4: Frontend
Fase 5: Auth + roles
Fase 6: CI/CD + calidad de código
Fase 7: Infraestructura AWS (Terraform)
Fase 8: RAG (opcional según tiempo)
Fase 9: Memoria del TFM (transversal, no al final)
```

---

## Fase 0 — Setup del repositorio (0.5–1 sesión)

**Objetivo:** tener el repo listo para trabajar con buenas prácticas desde el commit #1, no como algo que se añade "después".

- [ ] Crear repo en GitHub con estructura de monorepo:
  ```
  youautoqa/
  ├── backend/
  ├── frontend/
  ├── rf-runner/
  ├── infra/              (Terraform, Fase 7)
  ├── docker-compose.yml
  └── YouAutoQA_Requisitos.md
  ```
- [ ] Configurar Husky + lint-staged + ESLint + Prettier en `backend/` y `frontend/` (RNF-8).
- [ ] Primer commit: estructura vacía + `.gitignore` + README con el objetivo del proyecto.
- [ ] Estrategia de ramas: `main` protegida, trabajo en `feature/*`.

**Entregable:** repo navegable, con hooks de pre-commit funcionando (pruébalo intencionalmente con un `console.log` mal puesto para verificar que bloquea el commit).

---

## Fase 1 — Core del agente en LangGraph (2–3 sesiones)

**Objetivo:** el corazón del TFM. Un grafo que reciba texto de una US "simulada" (hardcodeada, sin Jira todavía) y ejecute el ciclo generar → ejecutar → corregir, contra el runner de Robot Framework en Docker.

- [ ] Definir el estado del grafo (qué información viaja entre nodos: US, código `.robot` actual, resultado de la última ejecución, número de intento, historial de errores).
- [ ] Nodo `generar_test`: prompt al LLM con la US → devuelve `.robot`.
- [ ] Nodo `ejecutar_test`: invoca el runner Docker, captura logs/resultado.
- [ ] Nodo `clasificar_fallo`: distingue fallo técnico vs. falta de información (RF-9) — este es el nodo más delicado, dedícale tiempo aparte.
- [ ] Nodo `corregir_test`: prompt al LLM con el error → nuevo `.robot`.
- [ ] Lógica condicional del grafo: PASS → fin; fallo técnico y intentos < 5 → vuelve a `ejecutar_test`; fallo por falta de info → pausa (interrupt) esperando aclaración humana; intentos = 5 → fin con `fail`.
- [ ] Probar el ciclo completo con 2–3 User Stories de ejemplo escritas a mano (una que debería pasar a la primera, otra que necesite 2-3 correcciones, otra ambigua que dispare RF-9).

**Entregable:** script/servicio que corre en local, sin UI, y que demuestra el ciclo completo generar→ejecutar→corregir→PASS/clarificación en consola o logs.

**Nota de mentoría:** este es el momento de aprender LangGraph de verdad (nodos, edges condicionales, estado, interrupts). No conviene copiar un ejemplo genérico de internet sin entender cada pieza — te va a hacer falta ese entendimiento para la memoria del TFM.

---

## Fase 2 — Integración con Jira vía MCP (1 sesión)

**Objetivo:** sustituir las US hardcodeadas por datos reales de Jira.

- [ ] Configurar el MCP oficial de Atlassian (Rovo) — credenciales, scopes necesarios.
- [ ] Nodo o función `obtener_us(id)`: llama al MCP, devuelve descripción + criterios de aceptación.
- [ ] Manejo de error 404/403 (RF-3) — probarlo con una US inexistente a propósito.
- [ ] Enchufar esto como entrada al grafo de la Fase 1 (en vez de las US hardcodeadas).

**Entregable:** el ciclo de la Fase 1 ahora arranca desde un ID real de Jira.

---

## Fase 3 — API + persistencia (2 sesiones)

**Objetivo:** exponer el agente como servicio HTTP con estado persistente (jobs), no como script de consola.

- [ ] Levantar Postgres en Docker Compose.
- [ ] Modelo de datos mínimo: `jobs` (id, us_id, estado, intento_actual, created_at), `job_attempts` (job_id, intento, resultado, logs), `clarification_messages` (job_id, rol, mensaje, created_at).
- [ ] Endpoints backend (Express/Fastify):
  - `POST /jobs` — crea un job a partir de un US ID, dispara el grafo en background (RNF-3).
  - `GET /jobs` / `GET /jobs/:id` — consulta estado (para el polling del frontend).
  - `POST /jobs/:id/clarify` — el usuario responde a una pregunta del agente (RF-9), reinicia contador de intentos.
- [ ] Tests de integración de estos endpoints (según estrategia de testing del doc de requisitos).

**Entregable:** puedes crear un job vía Postman/curl, consultarlo, y ver su estado avanzar sin tocar el frontend todavía.

---

## Fase 4 — Frontend (2–3 sesiones)

**Objetivo:** las 3 pantallas de RF-7, consumiendo la API de la Fase 3.

- [ ] Setup Next.js + TypeScript, deploy inicial a Vercel (aunque apunte a un backend en local por ahora vía túnel o variable de entorno).
- [ ] Pantalla **Creación de test**: buscador de US + tabla de jobs con polling (estado en tiempo real).
- [ ] Pantalla **Control de test**: detalle de un job, intentos, logs.
- [ ] Subpantalla de **clarificación** (chat) cuando el job está en `esperando aclaración`.
- [ ] Pantalla **Administración** (puede quedar simple/mock en esta fase si el tiempo aprieta — no es el corazón del TFM).

**Entregable:** flujo completo usable desde el navegador: buscas una US, ves el job avanzar, respondes si el agente pregunta algo, ves PASS/FAIL final.

*En este punto ya tienes un walking skeleton demostrable end-to-end. Es un buen momento para una demo con tu tutor de TFM.*

---

## Fase 5 — Auth y roles (1–2 sesiones)

**Objetivo:** RF-1 y RF-2, antes ausentes para no bloquear el desarrollo del flujo principal.

- [ ] Integrar NextAuth.js (o similar) con provider de Atlassian OAuth.
- [ ] Tabla `users` + `linked_accounts` (pensada para múltiples proveedores a futuro, aunque solo uses Atlassian ahora).
- [ ] Middleware de autorización en el backend según la matriz de permisos de RF-2.
- [ ] Ocultar/mostrar pantallas y acciones en el frontend según rol.

**Entregable:** login funcional, y los 3 roles se comportan distinto en la UI y en la API.

---

## Fase 6 — CI/CD y calidad (1–2 sesiones)

**Objetivo:** automatizar lo que hasta ahora se ha hecho a mano.

- [ ] Workflow de GitHub Actions para CI: lint + tests + build de imágenes Docker en cada PR.
- [ ] Workflow de CD: deploy automático del frontend (ya lo hace Vercel) — de momento sin AWS, backend se sigue corriendo/probando en local o en un entorno temporal simple.
- [ ] Revisar que los hooks de pre-commit (Fase 0) sigan funcionando y estén documentados en el README para cualquiera que clone el repo.

**Entregable:** cualquier PR corre lint + tests automáticamente; el estado de los checks es visible en GitHub.

---

## Fase 7 — Infraestructura AWS con Terraform (3–4 sesiones, guiada paso a paso)

**Objetivo:** migrar el backend y el runner de local/Docker Compose a AWS, con toda la infraestructura definida como código.

Se aborda en bloques pequeños y verificables, en este orden (de menor a mayor riesgo):

- [ ] **Bloque 1 — ECR:** crear los repositorios de imágenes con Terraform, hacer push manual de las imágenes de backend y runner para verificar que el flujo funciona.
- [ ] **Bloque 2 — RDS:** provisionar Postgres gestionado, migrar los datos/esquema desde el Postgres local de Docker Compose.
- [ ] **Bloque 3 — Secrets Manager:** mover la API key de OpenAI y tokens de Jira desde `.env` a Secrets Manager.
- [ ] **Bloque 4 — IAM:** roles y permisos mínimos necesarios (el bloque que más fricción suele dar — reservar tiempo extra).
- [ ] **Bloque 5 — ECS + Fargate:** Task Definition + Service, desplegando el backend containerizado.
- [ ] **Bloque 6 — Conectar CI/CD:** actualizar el pipeline de CD de la Fase 6 para que haga push a ECR y actualice el servicio de Fargate automáticamente.

**Entregable:** el backend corre en AWS, provisionado 100% por Terraform (`terraform apply` reproducible desde cero), con el pipeline de CD desplegando automáticamente en cada merge a `main`.

**Nota de mentoría:** cuando lleguemos aquí, iremos módulo Terraform por módulo, entendiendo cada recurso (`resource`), variable y output antes de aplicarlo — no se trata de copiar un `.tf` completo de un tutorial.

---

## Fase 8 — RAG (opcional, según tiempo disponible)

**Objetivo:** RF-8, mejorar la calidad de los tests generados con contexto del proyecto real.

- [ ] Elegir vector DB (pgvector sobre el RDS ya existente, para no añadir otra tecnología).
- [ ] Indexar fuentes de Fase 2a (tests `.robot` existentes, keywords, locators, convenciones).
- [ ] Nodo de recuperación (top-k chunks relevantes) integrado como paso previo al nodo `generar_test` del grafo.

**Entregable:** el agente genera tests más ajustados al estilo/patrones reales del proyecto, no solo genéricos.

*Si el tiempo aprieta, esta fase puede quedar documentada como "trabajo futuro" en la memoria sin implementarse — el MVP + infraestructura ya es un TFM sólido por sí solo.*

---

## Fase 9 — Memoria del TFM (transversal)

**No esperar al final.** Documentar cada decisión arquitectónica (y su justificación/trade-off) inmediatamente después de tomarla, no reconstruyéndola de memoria meses después. El propio `YouAutoQA_Requisitos.md` y este plan ya son un buen esqueleto de varias secciones de la memoria (arquitectura, decisiones técnicas, roadmap).

---

## Resumen visual del orden

```
Fase 0 (setup) → Fase 1 (agente LangGraph) → Fase 2 (Jira MCP)
   → Fase 3 (API + DB) → Fase 4 (Frontend) → Fase 5 (Auth/roles)
   → Fase 6 (CI/CD) → Fase 7 (AWS + Terraform) → Fase 8 (RAG, opcional)

Fase 9 (memoria) corre en paralelo a todas las anteriores.
```

**Regla de oro:** no empezar la Fase 7 (AWS/Terraform) hasta que la Fase 4 esté funcionando end-to-end en local. La infraestructura no debe arriesgar el corazón del proyecto.
