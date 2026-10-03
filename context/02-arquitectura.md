# Arquitectura

## Vista general
```
┌───────────────┐   HTTP    ┌──────────────────────────┐
│ Frontend      │ ────────▶ │ Backend (Node + TS)      │
│ Next.js       │ ◀──────── │ API + LangGraph.js       │
│ (Vercel)      │  polling  │                          │
└───────────────┘           └───┬─────────┬─────────┬──┘
                                │         │         │
                       MCP      │         │ Docker  │ SQL
                  ┌─────────────▼─┐   ┌───▼──────┐ ┌▼───────────┐
                  │ Atlassian MCP │   │ rf-runner│ │ PostgreSQL │
                  │ (Jira, Rovo)  │   │ (Robot)  │ │ (+pgvector)│
                  └───────────────┘   └──────────┘ └────────────┘
                                │
                         ┌──────▼──────┐
                         │ OpenAI API  │
                         └─────────────┘
```

## Componentes
- **Frontend (Next.js)**: login, buscador de US, tabla de jobs con polling, detalle de ejecución, chat de clarificación, administración.
- **Backend**: expone la API REST, lanza el grafo en background, persiste jobs, intentos y mensajes.
- **Agente (LangGraph.js)**: grafo con estado compartido y bucles condicionales. Ver diseño abajo.
- **rf-runner**: contenedor independiente con Robot Framework. El backend lo invoca como proceso/contenedor aislado y lee el resultado. **No** se importa Python desde Node.
- **PostgreSQL**: usuarios, roles, jobs, intentos, mensajes de clarificación; después embeddings (pgvector).
- **Atlassian MCP**: obtención de la US. Errores 404/403 se traducen a mensajes de UI.

## Diseño del agente (LangGraph)

**Estado del grafo**: US (texto + criterios), `.robot` actual, resultado de la última ejecución, nº de intento, historial de errores, aclaraciones del usuario.

**Nodos**
1. `obtener_us` — consulta Jira (Fase 2).
2. `generar_test` — prompt con US (+ contexto RAG) → `.robot`.
3. `ejecutar_test` — invoca el runner, captura logs y resultado (con timeout).
4. `clasificar_fallo` — decide: **técnico** vs **falta de información**. Es el nodo más delicado.
5. `corregir_test` — prompt con el error → nuevo `.robot`.
6. `pedir_aclaracion` — `interrupt` de LangGraph (human-in-the-loop).

**Aristas condicionales (tras `ejecutar_test`)**
- PASS → fin (`done`).
- Fallo técnico e intentos < 5 → `corregir_test` → `ejecutar_test`.
- Fallo por falta de info (error repetido entre intentos) → `pedir_aclaracion`; al responder, se añade al contexto y el contador vuelve a 0.
- Intentos = 5 → fin (`fail`).

**Idea de costes**: evaluar un modelo más económico para el triage de errores (`clasificar_fallo`) y uno con mejor razonamiento para generar/corregir.

## Modelo de datos mínimo (a refinar en Fase 3)
- `users`, `linked_accounts` (múltiples proveedores), `roles`
- `jobs` (id, us_id, estado, intento_actual, created_at, …)
- `job_attempts` (job_id, intento, `.robot`, resultado, logs)
- `clarification_messages` (job_id, rol, mensaje, created_at)

## API prevista (Fase 3)
- `POST /jobs` — crea job y dispara el grafo en background.
- `GET /jobs`, `GET /jobs/:id` — estado (para polling).
- `POST /jobs/:id/clarify` — respuesta del usuario; reinicia contador.

## Patrones y paradigmas (para justificar en la memoria)
- Job asíncrono en background + polling (evolución posible a SSE/WebSockets).
- Orquestador como intermediario de las llamadas al LLM (function calling nativo de OpenAI queda como evolución).
- Puertos y adaptadores (Clean Architecture) para aislar LLM, Jira, runner y BBDD y poder testear cada uno con dobles. *Propuesta a validar con Lujan.*

## Despliegue
- **Local**: `docker-compose` con backend + runner + Postgres.
- **Producción (Fase 7)**: Frontend en Vercel. Backend y runner en AWS: imágenes en **ECR**, ejecución en **ECS/Fargate**, BBDD en **RDS**, permisos en **IAM**, secretos en **Secrets Manager**. Todo con **Terraform** (carpeta `infra/`).

## Riesgo de seguridad a diseñar bien
El runner ejecuta **código generado por un LLM**. Debe correr aislado (contenedor sin privilegios, sin acceso a secretos ni a la red interna innecesaria, con límite de CPU/memoria y timeout). Tratar también como no confiable el contenido de la US (posible prompt injection).
