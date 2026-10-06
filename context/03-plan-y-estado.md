# Plan y estado

> Detalle completo: `YouAutoQA_Plan.md`. Actualiza **este** archivo al terminar cada fase o hito.

**Enfoque**: walking skeleton — esqueleto delgado que atraviesa todas las capas y funciona end-to-end, que luego se engorda.

**Regla de oro**: no empezar la Fase 7 (AWS/Terraform) hasta que la Fase 4 funcione end-to-end en local.

## Estado

| Fase | Contenido | Sesiones est. | Estado |
|---|---|---|---|
| Pre | Requisitos, plan, `CLAUDE.md` y `context/` | — | ✅ hecho |
| Pre | User Stories con criterios de aceptación (17 US en `06-user-stories.md`) | 1 | ✅ hecho (preguntas resueltas: D-21 a D-27) |
| 0 | Setup del repo: monorepo, Husky + lint-staged + ESLint + Prettier, README, ramas | 0.5–1 | ✅ hecho |
| 1 | Core del agente en LangGraph (sin UI ni Jira) contra el runner Docker | 2–3 | ⬜ |
| 2 | Integración Jira vía MCP Atlassian + manejo 404/403 | 1 | ⬜ |
| 3 | API + PostgreSQL (jobs, intentos, clarificaciones) + tests de integración | 2 | ⬜ |
| 4 | Frontend: Creación, Control, chat de clarificación, Administración | 2–3 | ⬜ |
| 5 | Auth (Atlassian OAuth) y roles | 1–2 | ⬜ |
| 6 | CI/CD con GitHub Actions + calidad | 1–2 | ⬜ |
| 7 | Infraestructura AWS con Terraform (6 bloques: ECR → RDS → Secrets → IAM → ECS/Fargate → CD) | 3–4 | ⬜ |
| 8 | RAG (opcional según tiempo) | — | ⬜ |
| 9 | Memoria del TFM (transversal, en paralelo a todas) | — | 🔁 continuo |

## Hito demostrable
Al terminar la Fase 4 hay un walking skeleton usable desde el navegador: buen momento para enseñárselo al tutor del máster.

## Fase 0: lo que quedó hecho
- Monorepo con workspaces (`backend`, `frontend`), repo en GitHub y `main` protegida (PR obligatorio).
- Pre-commit verificado: un `console.log` en el backend bloquea el commit (regla `no-console`).
- README con puesta en marcha, hooks y flujo Git.
- Decisiones D-16 a D-20 registradas en `04-decisiones.md`.

## Pendientes heredados de la Fase 0
- Revisar las 5 vulnerabilidades de `npm audit` (solo tooling de lint) en la Fase 6.

## Siguiente acción
1. **Fase 1 en curso** (US-05, US-06, US-07, US-10 y TS-01/TS-02). Diseño del grafo cerrado (D-28 a D-32). Orden de trabajo:
   1. ✅ Estado + grafo con dobles (`FakeLlm`, `FakeRunner`) y tests Vitest de US-07 y US-10. 22 tests en verde (`npm test`). Diagrama en `context/diagramas/grafo-agente.{svg,pdf}`.
      - Pendiente de esta parte (a propósito): triage con LLM de salida estructurada (D-31, llega con el adaptador OpenAI) y limpiar/validar la respuesta del LLM (US-05.2/05.3).
   2. ✅ `rf-runner` en Docker. `DockerRunner` (`backend/src/runner/`) implementa `RunnerPort`; `buildDockerRunArgs` concentra las medidas de seguridad (usuario `pwuser`, `--memory`/`--cpus`/`--pids-limit`, sin variables de entorno, un solo volumen, nombre para `docker kill`). Tests: 31 unitarios (`npm test`) + 5 de integración contra Docker real (`npm run test:integration`, necesita Docker Desktop): PASS, FAIL con motivo, timeout con kill del contenedor, sin acceso a secretos y Chromium arrancando bajo los límites. D-34, D-35 y D-36 registradas.
      - Pendiente (menor): tests que provoquen de verdad el corte por memoria/CPU (US-06.4) y la ejecución en paralelo sin compartir archivos (US-06.5); cargar la config del runner (`RF_RUNNER_IMAGE`, límites, URL de la AUT) desde variables de entorno y `.env.example`; extraer del log solo el mensaje de FAIL para la regla de "mismo error".
   3. 🔄 Adaptador OpenAI (`openai` SDK, Responses API) y prompts. **Punto de parada** (rama `feature/rf-6-agent-graph`):
      - Hecho (TDD, 39 tests en verde): `OpenAiLlm` en `backend/src/llm/openai-llm.ts` implementa `LlmPort`; elige modelo por `tier` (`generate`/`triage`, D-37), devuelve tokens (US-05.6) y traduce errores a `LlmError` (`auth`, `quota`, `rate_limit`, `network`, `unknown`; US-05.4). `LlmRequest` tiene ahora `tier?`.
      - Falta: (a) que `buildQuestionRequest` en `prompts.ts` marque `tier: 'triage'` (con su test en `graph.test.ts`); (b) `loadOpenAiConfig(env)` que lea `OPENAI_API_KEY`, `OPENAI_MODEL_GENERATE`, `OPENAI_MODEL_TRIAGE` y falle con un error claro si faltan, sin mostrar la clave; (c) test de humo contra OpenAI real en `backend/tests/integration/` (cuesta céntimos); (d) comprobar que los ids `gpt-6.1-sol` y `gpt-6-luna` existen en la cuenta (el SDK no los lista; verificar con `GET /v1/models`); (e) limpiar/validar la respuesta del LLM (sin ```` ```robot ````, US-05.2/05.3) y el triage con salida estructurada (D-31).
   4. Probar con 2–3 US de ejemplo (pasa / necesita correcciones / ambigua).
