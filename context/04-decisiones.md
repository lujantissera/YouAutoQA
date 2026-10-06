# Decisiones de arquitectura (ADR ligero)

> Cada decisión se registra con su contexto y trade-off. Esto alimenta directamente la memoria del TFM.
> Formato: **Decisión — Motivo — Alternativas descartadas.**

## Cerradas

| # | Decisión | Motivo | Alternativas descartadas |
|---|---|---|---|
| D-01 | Orquestación con **LangGraph.js** | Estado nativo entre iteraciones, bucles condicionales e `interrupt` para human-in-the-loop | Llamadas directas a la API de OpenAI; LangChain solo; n8n |
| D-02 | Backend en **Node.js + TypeScript** | Es la tecnología que mejor conoce la autora; evita curva extra | Python (más natural para LangGraph, pero curva adicional) |
| D-03 | Jira vía **MCP oficial de Atlassian (Rovo)** | Reduce complejidad y tiempo; prioriza robustez del conector oficial. Trade-off consciente frente al valor académico de construirlo | MCP propio para Jira |
| D-04 | MCP **propio** solo para Jenkins (fase posterior) | No hay alternativa oficial equivalente; aquí sí aporta valor de diseño | — |
| D-05 | **PostgreSQL** para todo el modelo | Compatibilidad futura con pgvector, evita una segunda BBDD | Mongo, vector DB dedicada |
| D-06 | **Polling** para estado en tiempo real | Simplicidad en MVP | WebSockets / SSE (evolución posible) |
| D-07 | Runner Robot Framework en **contenedor Docker independiente** | Aislamiento y no mezclar Python en Node; Vercel no sirve para procesos largos | Importar Python desde Node |
| D-08 | Frontend en **Vercel**, backend en **contenedor** | Vercel resuelve Next.js; el backend necesita Docker y timeouts largos | Todo serverless |
| D-09 | Despliegue en **AWS + Terraform** (ECR, ECS/Fargate, RDS, IAM, Secrets Manager) | Decisión pedagógica y de carrera: IaC real con alto valor de mercado | Railway / Render / Fly.io |
| D-10 | Secrets: `.env` local → GitHub Secrets (CI) → Secrets Manager (prod) | Sencillo y suficiente para el TFM | HashiCorp Vault (fuera de alcance) |
| D-11 | Calidad local con **Husky + lint-staged + ESLint + Prettier** | Detectar problemas antes del commit; CI como red de seguridad | Solo CI |
| D-12 | **GitHub Actions** para CI/CD | Integración nativa con GitHub, Docker y Vercel | Jenkins, GitLab CI |
| D-13 | **n8n descartado** | No aporta valor sobre LangGraph en este caso | — |
| D-14 | Contador de intentos se **reinicia a 0** tras una aclaración del usuario | El problema pasa de técnico a resuelto por información nueva | Arrastrar el contador |
| D-15 | **TDD selectivo** con **Vitest** en la lógica determinista (grafo, intentos, clasificación, API) | Los criterios de aceptación se traducen directamente en tests; protege el límite de intentos (coste) sin gastar tokens. La salida del LLM no es determinista, así que se evalúa aparte | TDD en todo el código; tests solo al final |
| D-16 | **Monorepo con npm workspaces** (`backend`, `frontend`) y un único `package-lock.json` en la raíz | Un solo `npm install`, hooks compartidos y un solo repo para el TFM | Repos separados; pnpm/Turborepo (complejidad innecesaria ahora) |
| D-17 | **ESLint se ejecuta por workspace** desde lint-staged (`npm exec --workspace <pkg> -- eslint`) | ESLint 9 busca el `eslint.config.mjs` desde el directorio de ejecución (la raíz), donde no hay ninguno; ejecutarlo dentro del paquete usa su config y su versión | Config ESLint única en la raíz (mezclaría reglas Node y Next.js) |
| D-18 | **Frontend con ESLint 9**, backend con ESLint 10 | `eslint-plugin-react` (vía `eslint-config-next@16`) usa `context.getFilename()`, eliminado en ESLint 10. Revisar al actualizar `eslint-config-next` | Frontend en ESLint 10 (rompe el lint) |
| D-19 | **`main` protegida** en GitHub: PR obligatorio antes de mergear, sin force push | Cumple el flujo de ramas de `05-convenciones.md`. Con una sola persona se exigen 0 aprobaciones (no se puede aprobar el propio PR) | Push directo a `main` |
| D-20 | `next`, `react` y `react-dom` se instalan en `frontend` desde la Fase 0 | `eslint-config-next` carga un parser que vive dentro de `next`; sin él el lint del frontend falla | Excluir el frontend del lint hasta la Fase 4 (dejaba la config sin validar) |
| D-21 | Umbral de "mismo error" (US-10): **2 intentos seguidos** fallando por el mismo motivo ⇒ se considera falta de información. Valor configurable | Punto de partida simple; se ajusta con casos reales en la Fase 1 | 3 intentos (gasta más intentos y tokens antes de preguntar); similitud semántica (más complejo) |
| D-22 | **Límite de tokens por job** además del máximo de intentos (TS-02), configurable | Barato de implementar; protege el gasto aunque el límite de intentos falle | Solo límite de intentos |
| D-23 | En Jira se muestran **mensajes distintos para 404 y 403** (US-04) | App interna con usuarios autenticados: el riesgo de confirmar que una US existe es bajo y el mensaje distinto es más útil | Mismo mensaje para ambos |
| D-24 | "Información relevante" de la US en el MVP = **descripción + criterios de aceptación** (US-03) | Es lo mínimo necesario para generar el test; ampliar (componentes, etiquetas, enlaces) más adelante | Traer todos los campos desde el inicio |
| D-25 | Rol por defecto de un usuario nuevo: **QA Executer** (US-01) | Principio de mínimo privilegio; un Admin sube el rol después | QA Controller por defecto |
| D-26 | Las cuatro historias técnicas (**TS-01 a TS-04**) se mantienen como User Stories | Hacen trazables seguridad, coste, lint y CI. TS-03 ya está cumplida en la Fase 0 | Dejarlas como RNF |
| D-27 | Prioridades MoSCoW de `06-user-stories.md` confirmadas (Should: US-09, US-12, TS-02, TS-04) | Coherentes con el walking skeleton: el MVP sobrevive sin ellas si el tiempo aprieta | — |
| D-28 | **Intento = una ejecución** del test. Máximo 5 ejecuciones por job (la generación inicial es el intento 1, hasta 4 correcciones) | Definición simple y medible; el límite se comprueba antes de cada ejecución | 1 generación + 5 correcciones |
| D-29 | LLM mediante el **SDK oficial `openai`** detrás de un `LlmPort` | Se aprende la API directamente (structured outputs, tokens, errores) y el puerto permite añadir luego un adaptador `@langchain/openai` y comparar | `@langchain/openai` desde el inicio (más abstracción, menos visibilidad) |
| D-30 | El grafo depende de **puertos** (`LlmPort`, `RunnerPort`), nunca de OpenAI o Docker. Los tests usan dobles (`FakeLlm`, `FakeRunner`) | Tests deterministas, CI sin llamadas reales al LLM (TS-04.3) | Dependencias directas en los nodos |
| D-31 | `clasificar_fallo` se divide en una **regla determinista** (mismo error normalizado en 2 intentos seguidos ⇒ falta de info) y un **triage con LLM** con salida estructurada para el resto | La parte determinista se testea sin gastar tokens; el LLM solo decide los casos difusos | Clasificar todo con el LLM |
| D-32 | `interrupt` de LangGraph con **checkpointer en memoria** en la Fase 1; en la Fase 3 pasa a Postgres | Permite validar el flujo de aclaración sin BBDD todavía | Persistencia desde la Fase 1 |
| D-33 | **Tests unitarios junto al código** (`x.ts` + `x.test.ts`) y dobles en `src/agent/testing/`. Los tests de integración (API + Postgres, Fase 3) irán en `backend/tests/integration/`. Al crear el Dockerfile se añadirá un `tsconfig.build.json` que excluya `*.test.ts` y `testing/` del `dist/` | Es lo más cómodo con Vitest y evita mantener una estructura espejo; los tests lentos con infraestructura sí merecen carpeta y ejecución propias | Carpeta `tests/` espejo para todo |
| D-34 | Los tests generados usan **Browser Library (Playwright)** | Esperas automáticas: menos fallos falsos por tiempos, que son los que más intentos (y tokens) gastarían; es el estándar emergente en Robot Framework | SeleniumLibrary (más veterana; ver decisión abierta de soporte a proyectos Selenium) |
| D-35 | El `rf-runner` se basa en la **imagen oficial `marketsquare/robotframework-browser` con versión fija (20.6.0)**, ejecutada como `pwuser` | Trae Python, Robot, Playwright y navegadores ya integrados y probados; correr como no-root es requisito de la imagen y del aislamiento. Versión fija para reproducibilidad | Montar Playwright a mano sobre `python:slim` (más trabajo y más fallos); usar `latest` (cambia sin avisar) |
| D-36 | El runner usa `--shm-size=512m` (no `--ipc=host`), `--security-opt=no-new-privileges`, `--user pwuser`, y lanza `robot` sin pasar por una shell. Verificado con Chromium real | `--ipc=host` comparte memoria con el anfitrión y rompe el aislamiento; `--shm-size` da a Chromium lo que necesita sin esa apertura. Argumentos como lista (sin shell) evitan inyección de comandos | `--ipc=host` (recomendación de la imagen); `bash -c "..."` |

## Abiertas

- [ ] **Soporte a proyectos con SeleniumLibrary / repos de testing existentes.** Requeriría un "perfil" de librería por proyecto (`browser` o `selenium`), otra imagen de runner y prompts parametrizados; el valor real llegaría con RAG (Fase 8) para reutilizar sus keywords. Fuera del MVP; mantener runner y prompts desacoplados de la librería para no cerrar la puerta. Buen argumento de extensibilidad para la memoria.
- [x] ~~Actualizar Node a 22 LTS~~ — hecho (Node 22.23.3 vía nvm-windows; sin avisos `EBADENGINE`).
- [ ] **5 vulnerabilidades altas en `npm audit`** (cadena `eslint-config-next` → … → `braces`, DoS por patrones glob). Solo afecta a tooling de lint, riesgo bajo. No usar `npm audit fix --force` (baja a `eslint-config-next@14`). Revisar con Dependabot en Fase 6.
- [ ] Function calling nativo de OpenAI vs. orquestador intermediario (recomendado para MVP: orquestador).
- [ ] Estructura exacta de `context/`, `agent.md` y configuración MCP (esta carpeta es la primera versión).
- [ ] Medir coste real y tiempos del ciclo cuando el MVP funcione (validar RNF-5).
- [ ] Modelo de datos detallado en Postgres.
- [ ] RAG: vector DB (pgvector probable), chunking y embeddings, cuando se llegue a esa fase.
- [ ] Diseño de módulos Terraform (archivos, variables, entornos) en Fase 7.
- [ ] Estrategia de aislamiento y límites del runner (seguridad).
- [ ] Criterio exacto de `clasificar_fallo`: cómo se detecta "error repetido" entre intentos.
- [ ] Modelo de OpenAI a usar para generar/corregir vs. para triage.

## Plantilla para nuevas decisiones
```
### D-XX — Título
- Fecha:
- Contexto:
- Decisión:
- Alternativas consideradas:
- Consecuencias / trade-offs:
```
