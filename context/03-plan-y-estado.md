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
      - Hecho (44 tests en verde): (a) `buildQuestionRequest` marca `tier: 'triage'` (test en `graph.test.ts`); (b) `loadOpenAiConfig(env)` en `backend/src/llm/config.ts` (lee `OPENAI_API_KEY`, `OPENAI_MODEL_GENERATE`, `OPENAI_MODEL_TRIAGE`; error claro sin mostrar la clave); (d) verificado con `GET /v1/models`: `gpt-6.1-sol` y `gpt-6-luna` existen en la cuenta (también `gpt-6-sol` y `gpt-6-astra`).
      - Hecho: (c) test de humo contra OpenAI real (`backend/tests/integration/openai-llm.integration.test.ts`, `npx vitest run openai`; carga el `.env` de la raíz). Pasa con ambos tiers; con un prompt simple `gpt-6.1-sol` devolvió el `.robot` limpio, sin vallas markdown.
      - Hecho (54 tests en verde): (e, parte 1) `extractRobotCode` (`backend/src/agent/robot-code.ts`) quita vallas/prosa y devuelve `null` si no hay `*** Test Cases ***`; `generateTest`/`fixTest` lo usan y `runTest` convierte un código vacío en intento `FAIL` sin lanzar Docker (US-05.2/05.3). Limitación conocida: dos respuestas basura seguidas generan el mismo log y el agente preguntaría al usuario, aunque no falte información en la US.
      - Hecho (D-38): clasificación más fina de fallos. `failureKind` gana `environment` (la app no carga / timeout de navegación o global): se reintenta el mismo test sin LLM y, si ocurre dos veces seguidas, el job termina en `fail` con `failureReason`. Los errores de código (keyword inexistente, sintaxis, respuesta vacía) se corrigen aunque se repitan en vez de preguntar. Pendiente menor: actualizar `context/diagramas/grafo-agente.*` con las nuevas aristas `retry` y `abort`, y ampliar la lista de patrones con errores reales del paso 4.
      - Aplazado hasta ver el paso 4: (e, parte 2) limpiar/validar la respuesta del LLM (sin ```` ```robot ````, US-05.2/05.3) y el triage con salida estructurada (D-31).
   4. ✅ Probar con 2–3 US de ejemplo contra https://www.saucedemo.com (pasa / necesita correcciones / ambigua). Script: `npm run try-agent -- <pass|fix|ambiguous>` desde `backend/` (`backend/scripts/try-agent.ts`, usa `tsx`; necesita Docker Desktop encendido y gasta céntimos de OpenAI).
      - `pass` ✅ (PASS con 1.472 tokens en total). Hallazgos: (1) el prompt de la pregunta heredaba "responde solo con un .robot" y el modelo devolvía código en vez de pregunta → separadas `DATA_RULES`/`ROBOT_RULES`/`QUESTION_RULES`; (2) Docker apagado se clasificaba como `technical` y luego `missing_info` → añadidos patrones de Docker a `environment` (D-38). Idea para la Fase 3: un fallo del runner debería ser un error del job (estado propio), no un FAIL del test.
      - `fix` ✅ (PASS a la primera, 530 tokens; no ejercitó el bucle de corrección).
      - `ambiguous` ⚠️ reveló tres problemas: (1) **falso PASS**: el modelo hizo que el test se omitiera con `Skip` y Robot sale con 0 → arreglado en D-39 (`isPassingRun` en `runner/robot-summary.ts`); (2) **nunca preguntó**: los 3 fallos fueron distintos (selector, `AUTH_STATE`, `AUTH_EMAIL`), así que la regla "mismo error dos veces" no saltó → confirma que hace falta algo más que la regla determinista (D-31); (3) **alucinó la interfaz** ("Mi perfil", "Dar de baja mi cuenta") que la web no tiene. (2) y (3) → se aborda con D-40 (`checkStory`, comprobación previa de la US con el modelo barato). Probado con `checkStory` activo: `ambiguous` pausó **antes de generar** y pidió credenciales y resultado esperado (bien). Tras responder gastó los 5 intentos (12.312 tokens, estado final `fail`, sin falso PASS) porque la web no tiene la función: desde el intento 2 el propio test lo decía ("no ofrece acceso al perfil") pero con palabras distintas cada vez, así que `isRepeatedError` no saltó. Con D-41 `ambiguous` ya preguntaba tras 2 ejecuciones en vez de agotar 5, pero al decirle que la función no existe volvía a preguntar en bucle → **D-42 implementada** (límite de rondas `MAX_CLARIFICATIONS` + salida `CANNOT_TEST`). Resuelto con D-41: `fixTest` puede responder `NEEDS_INFO: <pregunta>` en vez de código y el grafo pausa para preguntar (sin llamadas extra). **Validado con el modelo real tras D-42 (2026-10-15):** `pass` 594 tokens y `fix` 731, ambos PASS a la primera sin preguntas; `ambiguous` pregunta credenciales, luego (NEEDS_INFO) dónde está el perfil, y al confirmar el usuario que no existe termina en `fail` con `failureReason` (4.968 tokens frente a 12.312 antes). El triage con LLM (D-31) no ha hecho falta de momento. Mejora posible: permitir `CANNOT_TEST` ya al generar, tras la aclaración (ahorra una ejecución de Docker). Diagrama `grafo-agente.svg` actualizado con `routeAfterFix`. Idea futura (Fase 8/RAG): darle al modelo el árbol de accesibilidad/DOM de la página; hoy solo adivina selectores y recibe el texto del error.
      - **Para cerrar la Fase 1:** (a) ✅ hecho: `loadRunnerConfig` (`backend/src/runner/config.ts`, 8 tests) lee `RF_RUNNER_IMAGE` (obligatoria, D-35), `RF_RUNNER_MEMORY`, `RF_RUNNER_CPUS` y `RF_RUNNER_PIDS_LIMIT` (con valores por defecto seguros) y `AUT_BASE_URL` (opcional) del entorno, y `try-agent` la usa; (b) extraer solo el mensaje de FAIL del log para la regla "mismo error"; (c) tests de seguridad del runner pendientes: corte real por memoria/CPU (US-06.4) y ejecución en paralelo sin compartir archivos (US-06.5); (d) regenerar `grafo-agente.pdf`; (e) abrir la PR de la Fase 1 hacia `main`.
