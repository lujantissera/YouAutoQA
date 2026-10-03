# YouAutoQA — Design Doc

> Complementa a `YouAutoQA_Requisitos.md` (el qué) y `YouAutoQA_Plan.md` (el cuándo). Este documento es el **cómo**: arquitectura de componentes, diseño técnico del grafo, modelo de datos y contratos de API para las Fases 0–5 (walking skeleton local).
> El diseño detallado de infraestructura AWS/Terraform se aborda en la Fase 7 (ver `YouAutoQA_Plan.md`) y no se incluye aquí para no quedar desactualizado antes de tiempo.
> Última actualización: 17/09/2026

---

## 1. Arquitectura de componentes (vista local / walking skeleton)

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js)"]
        UI[UI: Creación / Control / Admin]
    end

    subgraph Backend["Backend (Node.js)"]
        API[API REST]
        Agent["Agente LangGraph.js"]
    end

    subgraph Runner["RF Runner (Docker, Python)"]
        RF[Robot Framework]
    end

    DB[(PostgreSQL)]
    Jira["Jira · MCP oficial Atlassian"]
    LLM["OpenAI API"]

    UI -->|"REST + polling"| API
    API --> Agent
    API --> DB
    Agent --> DB
    Agent -->|"obtener US"| Jira
    Agent -->|"generar / corregir"| LLM
    Agent -->|"ejecutar .robot"| RF
    RF -->|"resultado / logs"| Agent
```

**Notas de diseño:**
- El **Agente** vive dentro del proceso del Backend (no es un servicio aparte) — es un módulo que el API invoca de forma asíncrona al crear un job.
- El **RF Runner** es un contenedor Docker independiente; el backend lo invoca como proceso aislado (`docker run` o llamada a un contenedor ya corriendo, según se decida al implementar) y lee su salida (report/log/output.xml).
- Todo el entorno local se levanta con `docker-compose` (backend, runner, Postgres). El frontend corre aparte con `npm run dev` (no necesita estar dockerizado en local).

---

## 2. Diseño del grafo LangGraph

### 2.1 Estado del grafo (`GraphState`)

```typescript
interface GraphState {
  jobId: string;
  usId: string;                    // ej. "US-1234"
  usDescription: string;
  acceptanceCriteria: string;
  clarifications: { question: string; answer: string }[]; // se acumulan si hay varias rondas (RF-9)

  currentRobotCode: string | null;
  attemptNumber: number;           // se resetea a 0 tras una clarificación (RF-9)
  maxAttempts: number;             // 5, ver RNF-1

  lastExecutionResult: {
    status: "pass" | "fail";
    logs: string;
  } | null;

  failureHistory: string[];        // errores de intentos previos, para detectar patrones repetidos
  status: "generando" | "en_ejecucion" | "esperando_aclaracion" | "done" | "fail";
}
```

### 2.2 Nodos

| Nodo | Entrada relevante | Salida / efecto |
|---|---|---|
| `generar_test` | `usDescription`, `acceptanceCriteria`, `clarifications` | `currentRobotCode` (nuevo) |
| `ejecutar_test` | `currentRobotCode` | `lastExecutionResult` |
| `clasificar_fallo` | `lastExecutionResult`, `failureHistory` | decide próximo edge: `tecnico` / `falta_info` / `pass` |
| `corregir_test` | `currentRobotCode`, `lastExecutionResult.logs` | `currentRobotCode` (corregido), `attemptNumber += 1` |
| `pedir_aclaracion` | `failureHistory` | interrupt del grafo — pausa esperando input humano |
| `procesar_aclaracion` | respuesta del usuario | añade a `clarifications`, resetea `attemptNumber = 0` |

### 2.3 Edges condicionales (lógica de decisión)

```mermaid
stateDiagram-v2
    [*] --> generar_test
    generar_test --> ejecutar_test
    ejecutar_test --> clasificar_fallo

    clasificar_fallo --> DONE: PASS
    clasificar_fallo --> corregir_test: fallo técnico AND attemptNumber < maxAttempts
    clasificar_fallo --> FAIL: fallo técnico AND attemptNumber >= maxAttempts
    clasificar_fallo --> pedir_aclaracion: falta de información detectada

    corregir_test --> ejecutar_test
    pedir_aclaracion --> procesar_aclaracion: usuario responde
    procesar_aclaracion --> generar_test

    DONE --> [*]
    FAIL --> [*]
```

**El nodo más delicado a implementar es `clasificar_fallo`.** Criterio propuesto para el MVP: si el mismo tipo de error (ej. mismo selector no encontrado, mismo mensaje de ambigüedad) se repite igual en 2 intentos consecutivos, se interpreta como falta de información en la US en lugar de seguir corrigiendo a ciegas. Este heurístico se puede refinar durante la Fase 1 con casos de prueba reales.

---

## 3. Modelo de datos (PostgreSQL)

```mermaid
erDiagram
    users ||--o{ linked_accounts : tiene
    users ||--o{ jobs : crea
    jobs ||--o{ job_attempts : tiene
    jobs ||--o{ clarification_messages : tiene

    users {
        uuid id PK
        string email
        string display_name
        string role "admin | qa_controller | qa_executer"
        timestamp created_at
    }

    linked_accounts {
        uuid id PK
        uuid user_id FK
        string provider "atlassian | google (fase 2)"
        string provider_account_id
        text access_token_encrypted
        text refresh_token_encrypted
    }

    jobs {
        uuid id PK
        string us_id
        uuid created_by FK
        string status "generando | en_ejecucion | esperando_aclaracion | done | fail"
        int attempt_number
        int max_attempts
        text current_robot_code
        timestamp created_at
        timestamp updated_at
    }

    job_attempts {
        uuid id PK
        uuid job_id FK
        int attempt_number
        string result "pass | fail"
        text logs
        timestamp created_at
    }

    clarification_messages {
        uuid id PK
        uuid job_id FK
        string role "agent | user"
        text message
        timestamp created_at
    }
```

**Notas:**
- `linked_accounts` separada de `users` desde el diseño, aunque el MVP solo use Atlassian — así la Fase 2 (login con Google) no requiere migrar el esquema.
- `current_robot_code` vive en `jobs` (última versión), mientras que el histórico de código por intento, si se quiere conservar, puede añadirse como columna en `job_attempts` más adelante — no es estrictamente necesario para el MVP, se deja como decisión abierta.

---

## 4. Contrato de API (backend)

| Endpoint | Método | Body / Params | Respuesta | Notas |
|---|---|---|---|---|
| `/jobs` | POST | `{ usId: string }` | `{ jobId: string, status: "generando" }` | Dispara el grafo en background (RNF-3); no bloquea |
| `/jobs` | GET | query opcional `?status=` | `[{ jobId, usId, status, attemptNumber, createdAt }]` | Usado por la tabla de la pantalla de Creación de test (polling) |
| `/jobs/:id` | GET | — | `{ jobId, usId, status, attemptNumber, currentRobotCode, attempts: [...], clarifications: [...] }` | Detalle completo, usado en Control de test |
| `/jobs/:id/clarify` | POST | `{ answer: string }` | `{ jobId, status: "generando" }` | Responde a la última pregunta pendiente, reinicia `attemptNumber` a 0 |

**Autenticación:** todos los endpoints requieren sesión válida (cookie/JWT de NextAuth). La autorización por rol (RF-2) se aplica a nivel de middleware, antes de llegar al handler de cada endpoint — ej. `POST /jobs` requiere rol `admin` o `qa_controller`.

---

## 5. Estructura de carpetas (monorepo)

```
youautoqa/
├── backend/
│   ├── src/
│   │   ├── agent/            # grafo LangGraph: state, nodes, edges
│   │   ├── api/               # rutas Express/Fastify
│   │   ├── db/                 # esquema, migraciones, modelos
│   │   └── integrations/       # cliente MCP Jira, cliente OpenAI
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── app/ (o pages/)
│   │   ├── creacion/
│   │   ├── control/
│   │   └── admin/
│   └── package.json
├── rf-runner/
│   ├── Dockerfile
│   └── entrypoint.sh
├── infra/                     # Terraform — se puebla en Fase 7
├── docker-compose.yml
├── YouAutoQA_Requisitos.md
├── YouAutoQA_Plan.md
└── YouAutoQA_DesignDoc.md
```

---

## 6. Diagrama de secuencia — flujo completo (incluye clarificación)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend
    participant BE as Backend/API
    participant AG as Agente (LangGraph)
    participant J as Jira (MCP)
    participant L as OpenAI
    participant RF as RF Runner

    U->>FE: Introduce US-1234, click "Generar Test"
    FE->>BE: POST /jobs {usId: "US-1234"}
    BE-->>FE: {jobId, status: "generando"}
    BE->>AG: Dispara grafo (background)
    AG->>J: obtener_us("US-1234")
    J-->>AG: descripción + criterios

    loop hasta PASS, FAIL o clarificación
        AG->>L: generar/corregir .robot
        L-->>AG: código .robot
        AG->>RF: ejecutar test
        RF-->>AG: resultado + logs
        AG->>AG: clasificar_fallo
    end

    alt requiere clarificación
        AG-->>BE: status = "esperando_aclaracion" + pregunta
        FE->>BE: polling GET /jobs (detecta cambio de estado)
        FE-->>U: destaca fila + habilita chat
        U->>FE: responde en el chat
        FE->>BE: POST /jobs/:id/clarify {answer}
        BE->>AG: reanuda grafo con nueva info, attemptNumber = 0
    end

    AG-->>BE: status final = "done" | "fail"
    FE->>BE: polling GET /jobs
    FE-->>U: muestra resultado final
```

---

## 7. Decisiones pendientes a resolver durante la implementación

- [ ] Formato exacto de invocación del RF Runner desde el backend (¿contenedor efímero por ejecución, o contenedor persistente con API interna?) — a decidir al implementar la Fase 1.
- [ ] Si se conserva `current_robot_code` por intento en `job_attempts` o solo la última versión en `jobs`.
- [ ] Umbral exacto del heurístico de `clasificar_fallo` (¿2 intentos iguales? ¿similitud de mensaje de error?) — a afinar con casos de prueba reales en Fase 1.
