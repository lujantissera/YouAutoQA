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

## Abiertas

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
