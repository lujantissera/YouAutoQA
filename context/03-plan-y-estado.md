# Plan y estado

> Detalle completo: `YouAutoQA_Plan.md`. Actualiza **este** archivo al terminar cada fase o hito.

**Enfoque**: walking skeleton — esqueleto delgado que atraviesa todas las capas y funciona end-to-end, que luego se engorda.

**Regla de oro**: no empezar la Fase 7 (AWS/Terraform) hasta que la Fase 4 funcione end-to-end en local.

## Estado

| Fase | Contenido | Sesiones est. | Estado |
|---|---|---|---|
| Pre | Requisitos, plan, `CLAUDE.md` y `context/` | — | ✅ hecho |
| Pre | User Stories con criterios de aceptación | 1 | 🔜 siguiente |
| 0 | Setup del repo: monorepo, Husky + lint-staged + ESLint + Prettier, README, ramas | 0.5–1 | ⬜ |
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

## Siguiente acción
1. Escribir las User Stories de RF-1 a RF-9 con criterios de aceptación (`06-user-stories.md`).
2. Arrancar la Fase 0.
