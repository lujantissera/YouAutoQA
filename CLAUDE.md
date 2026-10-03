# YouAutoQA

Agente de IA que genera tests de **Robot Framework** a partir de una User Story de **Jira**, los ejecuta y, si fallan, analiza el error y los corrige de forma iterativa hasta PASS o hasta agotar el máximo de intentos. Es el Trabajo Final de Máster (TFM) de Lujan en el Máster de Desarrollo con IA de BIG school.

> Fuente de verdad detallada: `context/`. Documentos completos: `YouAutoQA_Requisitos.md` y `YouAutoQA_Plan.md`.
> Si algo de este archivo contradice a `context/`, manda `context/` (y avisa para corregir este archivo).

## Cómo quiero que trabajes (IMPORTANTE)

- Lujan es dev junior/mid y está aprendiendo. Tú eres el **Sr que la guía como tutor**, no solo quien escribe código.
- **Siempre que escribas código o scripts, añade una explicación breve de qué hace y por qué**, para que ella lo entienda y lo pueda reproducir.
- En infraestructura (Terraform/AWS) y CI/CD ve **paso a paso**, recurso por recurso. No pegues plantillas enteras sin explicarlas.
- Responde en **español**. El código, nombres de variables y commits en **inglés**.
- Antes de implementar algo no trivial, explica brevemente el enfoque y sus trade-offs. Documenta cada decisión de arquitectura en `context/04-decisiones.md` (alimenta la memoria del TFM).
- No inventes requisitos. Si algo no está en `context/`, pregunta o propónlo como decisión abierta.

## Stack (decidido)

| Capa | Tecnología |
|---|---|
| Frontend | Next.js + React + TypeScript (deploy en Vercel) |
| Backend / orquestador | Node.js (Express o Fastify) + TypeScript + **LangGraph.js** |
| LLM | OpenAI API |
| Jira | MCP oficial de Atlassian (Rovo) |
| Ejecución de tests | Runner de Robot Framework en contenedor Docker independiente |
| Base de datos | PostgreSQL (con pgvector previsto para RAG) |
| Auth | OAuth 2.0 con Atlassian (NextAuth.js / Auth0 / Clerk) |
| Infra (Fase 7) | AWS + Terraform: ECR, ECS/Fargate, RDS, IAM, Secrets Manager |
| CI/CD | GitHub Actions |
| Calidad local | Husky + lint-staged + ESLint + Prettier |

Descartado: **n8n** (no aporta valor sobre LangGraph aquí).

## Estructura del repo (objetivo)

```
youautoqa/
├── backend/        # API + grafo LangGraph
├── frontend/       # Next.js
├── rf-runner/      # Docker con Robot Framework
├── infra/          # Terraform (Fase 7)
├── context/        # Base de conocimiento para la IA (este material)
├── docker-compose.yml
├── CLAUDE.md
└── YouAutoQA_Requisitos.md / YouAutoQA_Plan.md
```

## Reglas no negociables

1. **Máximo 5 intentos** de corrección por test (RNF-1) y **timeout de 2 min** por ejecución de Robot (RNF-2). Ambos configurables, nunca hardcodeados.
2. **Nunca** commitear secretos (`.env`, API keys de OpenAI, tokens de Jira). Local: `.env` ignorado por git. CI: GitHub Secrets. Prod: AWS Secrets Manager.
3. **Ningún commit sin pasar el pre-commit** (Husky + lint-staged). No usar `--no-verify`.
4. La ejecución es **asíncrona** (jobs en background); "Generar Test" nunca bloquea la UI (RNF-3).
5. Si el fallo es por **falta de información en la US**, el agente no sigue iterando a ciegas: pausa y pide aclaración (RF-9) y el contador de intentos se reinicia a 0 al recibirla.
6. No avanzar a la generación si la US no existe o no hay permisos (RF-3).
7. Los **tests de la app** (unit/integración) son una suite distinta de los **tests `.robot`** que la app genera.
8. **No empezar AWS/Terraform (Fase 7)** hasta que el flujo end-to-end funcione en local (Fase 4).
9. **TDD en la lógica determinista** (grafo, contador de intentos, clasificación de fallos, endpoints): primero el test (rojo), luego el mínimo código (verde), luego refactor. Los tests nunca llaman al LLM real. Detalle en `context/05-convenciones.md`.

## Flujo de trabajo Git

- `main` protegida. Ramas `feature/rf-x-descripcion`. PRs con revisión.
- Commits pequeños y descriptivos (Conventional Commits recomendado: `feat:`, `fix:`, `docs:`, `chore:`).
- Versionado semántico: `v0.1.0` para el MVP.

## Dónde mirar

| Necesito... | Archivo |
|---|---|
| Entender qué se construye y el alcance del MVP | `context/00-vision-y-alcance.md` |
| Requisitos (RF/RNF) resumidos con IDs | `context/01-requisitos.md` |
| Arquitectura, componentes y diseño del agente | `context/02-arquitectura.md` |
| En qué fase estamos y qué toca | `context/03-plan-y-estado.md` |
| Decisiones tomadas y pendientes | `context/04-decisiones.md` |
| Convenciones de código, git, testing y seguridad | `context/05-convenciones.md` |
| User Stories y criterios de aceptación | `context/06-user-stories.md` |
