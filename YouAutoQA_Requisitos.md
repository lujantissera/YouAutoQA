# YouAutoQA — Documento de Requisitos

> Documento vivo. Se actualiza a medida que se definen nuevos requisitos durante el desarrollo del TFM.
> Última actualización: 17/09/2026

---

## 1. Descripción general

Aplicación que genera automáticamente tests de **Robot Framework** a partir de una User Story de **Jira**, usando un LLM (OpenAI API), los ejecuta, y si fallan, analiza el error y corrige el test de forma iterativa hasta que pase o se alcance un máximo de intentos.

No es solo "generar código con IA": es un **agente capaz de generar, ejecutar, analizar y corregir tests de forma autónoma e iterativa**.

**Flujo conceptual:**
Jira → LLM → Robot Framework → resultado → análisis del error → LLM → corrección → Robot Framework → ... → PASS

### Objetivo pedagógico transversal

Además de construir la aplicación, el proyecto busca practicar de forma aplicada varias competencias trabajadas durante el máster, en particular:
- **DevOps / CI-CD:** control de versiones con Git, automatización de pipelines (build, test, lint, despliegue) mediante GitHub Actions, containerización con Docker.
- **Infraestructura como Código (IaC):** provisión de infraestructura real en AWS mediante Terraform, como práctica deliberada de aprendizaje y como skill de cara al mercado laboral (no solo como medio de desplegar).
- **Calidad de código:** control automático mediante linting local (pre-commit) además de en CI, evitando que code smells lleguen siquiera a un commit.

Esto implica que, al abordar la implementación de CI/CD e infraestructura, el enfoque será guiado paso a paso (mentoría en rol DevOps/SRE) para maximizar el aprendizaje, no solo copiar una plantilla ya hecha.

---

## 2. Requisitos funcionales

### RF-1 — Autenticación (US-1)
- Login mediante **OAuth 2.0 con Atlassian** (obligatorio) — cubre identidad + autorización de acceso a la API de Jira en un solo flujo.
- **Fase 2:** añadir login alternativo con Google u otros proveedores. Arquitectura debe soportar múltiples proveedores desde el diseño (tabla `linked_accounts` separada de `users`), aunque solo se implemente Atlassian en el MVP.
- Librería recomendada: Auth0 / Clerk / NextAuth.js (no reinventar gestión de OAuth).

### RF-2 — Roles y permisos (US-2)
Tres roles: **Admin**, **QA Controller**, **QA Executer**.

| Acción | Admin | QA Controller | QA Executer |
|---|---|---|---|
| Gestionar usuarios y roles | ✅ | ❌ | ❌ |
| Configurar Jira/Jenkins/AUT/límites | ✅ | ❌ | ❌ |
| Generar test desde US (Jira → LLM) | ✅ | ✅ | ❌ |
| Ver tests (.robot) | ✅ | ✅ | ✅ (solo lectura) |
| Editar test manualmente | ✅ | ✅ | ❌ |
| Ejecutar/re-ejecutar test | ✅ | ✅ | ✅ |
| Ver pantalla de seguimiento/resultados | ✅ | ✅ | ✅ |

### RF-3 — Vinculación con Jira
- El usuario introduce el ID de una User Story (ej. `US-1234`).
- La app consulta Jira vía **MCP oficial de Atlassian (Rovo)** y obtiene: descripción, criterios de aceptación, información relevante.
- **Validación:** si la US no existe o el usuario no tiene permisos sobre ella, el MCP/API de Jira devuelve error (404/403) que la app debe capturar y mostrar de forma clara en la UI (ej. "No se encontró la User Story US-9999"), sin bloquear ni romper la pantalla. No se debe permitir avanzar a la generación del test (RF-4) si la US no fue resuelta correctamente.

### RF-4 — Generación de test
- Se envía la información de la US (+ contexto RAG) al LLM (OpenAI API).
- El LLM genera el/los test(s) en formato `.robot`.

### RF-5 — Ejecución de test
- La app guarda el `.robot` y lo ejecuta mediante Robot Framework.
- **MVP:** runner propio en Docker.
- **Fase 2:** Jenkins como executor alternativo (vía MCP propio para Jenkins: `trigger_job`, `get_build_status`, `get_console_log`).

### RF-6 — Ciclo de corrección automática
- Si el test falla: se recogen logs/resultados → se envían al LLM → el LLM corrige el `.robot` → se vuelve a ejecutar.
- Se repite hasta PASS o hasta alcanzar el máximo de intentos (ver RNF).

### RF-7 — Pantallas de la aplicación

Tras el login, el usuario accede a una **pantalla de inicio (Home/Dashboard)** con resumen general (últimos tests generados, estado rápido de ejecuciones, accesos directos) y navegación a 3 pantallas principales:

1. **Creación de test** — buscador de User Story (con validación de existencia/permisos, ver RF-3) + botón "Generar Test". Visible para Admin y QA Controller (ver permisos RF-2).
   - Cada vez que se genera un test a partir de una US, se crea un registro (job) con un **identificador único** y se añade como fila en una **tabla/listado debajo del buscador**, sin recargar la pantalla ni bloquear la creación de nuevos jobs en paralelo.
   - Cada fila muestra el estado del job en tiempo real, con al menos estos valores: `generando` / `en ejecución` (loading, mientras el ciclo de generación-ejecución-corrección de RF-6 está en curso) → `done` (test pasó) o `fail` (se agotaron los intentos, ver RNF-1) o `esperando aclaración` (ver RF-9).
   - Esta tabla es la base para el detalle ampliado que se muestra en la pantalla de Control de test.
2. **Control de test** — listado de ejecuciones en curso e históricas, estado por intento (1/5, 2/5...), logs, resultado PASS/FAIL. Visible para los tres roles (Admin, QA Controller, QA Executer).
3. **Administración** — gestión de usuarios y roles, configuración de vinculación Jira/Jenkins, configuración de límites del sistema (máx. iteraciones, timeout). Visible solo para Admin.

La visibilidad/acceso a cada pantalla debe respetar la matriz de permisos definida en RF-2.

### RF-8 — RAG (evolución, no MVP)

**Concepto clave:** RAG no es "meter toda la documentación en el prompt" — es un mecanismo de **recuperación selectiva**: el corpus (código, docs, ejemplos) se trocea en *chunks*, se convierte en embeddings, se guarda en una base vectorial, y para cada US se recuperan solo los *N* chunks más relevantes (búsqueda semántica) que se inyectan en el prompt. Esto controla coste, tokens y ruido.

```
Corpus (código, docs, ejemplos) → chunking + embeddings → Vector DB
US (consulta) ──▶ búsqueda semántica (top-k) ──▶ chunks relevantes ──▶ prompt final al LLM
```

**Fuentes a indexar, priorizadas por señal/complejidad:**

*Fase 2a (RAG inicial, alta señal, baja complejidad):*
1. Tests `.robot` existentes correctos (estilo, sintaxis, patrones del equipo).
2. Keywords propias / librerías custom (para que el LLM las reutilice en vez de reinventar pasos).
3. Locators/selectores de las pantallas relevantes — **no el código fuente completo de la app bajo test**; solo IDs/clases/XPaths extraídos (idealmente ya organizados como Page Object Model). El código de negocio en bruto (ej. JSPs completas) aporta poco y mete ruido.
4. Convenciones de naming/estructura de carpetas documentadas.

*Fase 2b (evolución, mayor complejidad):*
5. Guías de usuario en texto — trocear en fragmentos pequeños, no indexar documentos completos como bloque único.

*Fase 3 (futuro, requiere capacidad multimodal):*
6. Pantallazos/imágenes de la UI — un RAG de texto no puede "leer" imágenes directamente; requeriría OCR o un modelo de visión que describa los elementos antes de indexar. Se deja fuera del alcance hasta validar valor de las fases anteriores.

El diseño e implementación concreta del RAG (elección de vector DB, estrategia de chunking, embeddings) se abordará como paso guiado cuando se llegue a esa fase del desarrollo.

### RF-9 — Solicitud de clarificación al usuario (human-in-the-loop)

El agente debe distinguir entre dos tipos de fallo al analizar el resultado de una ejecución:

- **Fallo técnico/corregible** (selector incorrecto, sintaxis Robot Framework, timing, etc.) → sigue el ciclo normal de auto-corrección (RF-6).
- **Fallo por falta de información en la US** (ej. la US dice "debe darse de baja el cliente" sin especificar la pantalla, el flujo o los pasos concretos) → el agente detecta que el error se repite de forma similar entre intentos (ej. mismo elemento no encontrado, misma ambigüedad) y **corta el ciclo de auto-corrección antes de agotar los 5 intentos**, en vez de seguir iterando a ciegas.

**Comportamiento al detectar falta de información:**
1. El agente pausa el ciclo y envía al usuario un mensaje concreto pidiendo la aclaración necesaria (ej. "No encuentro la pantalla para dar de baja al cliente. ¿Puedes indicar dónde se realiza esta acción o los pasos del flujo?", o "¿Podrías proporcionarme un número válido de teléfono para probar la portabilidad?").
2. El usuario responde con la información adicional.
3. Esa aclaración se añade al contexto/prompt (junto con la US original) y **se reinicia el contador de intentos desde 0** — el agente vuelve a generar/corregir con la información completa, sin arrastrar la cuenta de los intentos ya consumidos antes de la aclaración.

Este mecanismo es adicional al límite de 5 intentos por fallos técnicos (RNF-1): no lo sustituye, sino que actúa como una salida temprana cuando el problema de fondo no es técnico sino de especificación insuficiente.

**Interfaz de clarificación:**
- Mientras el job está en la pantalla de Creación de test (RF-7) en estado `generando`, si el agente necesita clarificación, el estado de la fila cambia a `esperando aclaración` y se destaca visualmente de forma clara (ej. color/badge distintivo) en la tabla principal, para que el usuario no lo pase por alto.
- Al entrar al job (fila) en ese estado, se habilita una **subpantalla en formato chat/conversación** (no un formulario de una sola pregunta), ya que el agente puede necesitar más de una aclaración dentro de la misma pausa (ej. primero la ubicación de una pantalla, luego un dato de prueba concreto como un número de teléfono válido). El formato chat es coherente con la naturaleza conversacional del agente.

---

## 3. Requisitos no funcionales

- **RNF-1:** Máximo de 5 iteraciones de corrección por test.
- **RNF-2:** Timeout máximo por ejecución individual de Robot Framework (propuesto: 2 minutos); si se excede, se cuenta como fallo y pasa a corrección.
- **RNF-3:** Ejecución asíncrona — patrón de job en background (backend lanza proceso, devuelve ID; frontend hace polling o recibe websocket). El "Generar Test" no debe bloquear la UI.
- **RNF-4:** Feedback incremental en UI por intento (ej. "Intento 2/5: fallo en step 'login', corrigiendo...").
- **RNF-5:** Coste estimado por ciclo: ~15.000-25.000 tokens en el peor caso (5 intentos). A medir empíricamente en el MVP.
- **RNF-6:** URL de la aplicación bajo test (AUT) configurada a nivel de proyecto (no solicitada en cada creación de test).
- **RNF-7:** Autenticación delegada en proveedor externo (Atlassian OAuth) — sin gestión propia de contraseñas.
- **RNF-8:** Ningún commit debe llegar al repositorio remoto sin pasar linting local (pre-commit) — capa adicional de calidad antes de la verificación en CI.

---

## 4. Requisitos técnicos / decisiones de arquitectura

- **LLM:** OpenAI API (modelo con buena capacidad de razonamiento para generar/corregir; evaluar modelo más económico para pasos intermedios como triage de errores).
- **Orquestación del agente:** LangGraph (manejo nativo de estado entre iteraciones + bucles condicionales). El grafo debe incluir un nodo de **clasificación de fallo** (técnico vs. falta de información) tras cada ejecución fallida, que decida entre continuar el ciclo de auto-corrección (RF-6) o pausar y solicitar clarificación al usuario (RF-9) — LangGraph soporta nativamente este tipo de pausa/espera de input humano dentro del grafo ("human-in-the-loop").
- **Integración Jira:** MCP **oficial de Atlassian** (Rovo). Se evaluó desarrollar un MCP propio, pero se descartó para reducir complejidad y tiempo de desarrollo — se prioriza robustez/mantenimiento del conector oficial sobre el valor académico de construirlo desde cero (decisión justificable como trade-off consciente en la memoria).
- **Integración Jenkins (fase 2):** MCP propio (no existe alternativa oficial equivalente; aquí sí aporta valor de diseño propio).
- **Ejecución de tests:** runner Docker propio (MVP) → Jenkins como alternativa (fase 2).
- **n8n:** descartado — no aporta valor sobre LangGraph para este caso de uso.
- **Function calling:** decisión pendiente — orquestador como intermediario (recomendado para MVP) vs. function calling nativo de OpenAI (evolución futura).
- **Auth:** OAuth 2.0 vía Atlassian; librería tipo Auth0/Clerk/NextAuth.

### Persistencia de datos
- **PostgreSQL** para todo el modelo de datos: usuarios, roles, jobs, historial de intentos/ejecuciones, mensajes de la conversación de clarificación (RF-9). Elegido también pensando en compatibilidad futura con **pgvector** si se usa Postgres como vector DB en la fase de RAG (RF-8), evitando introducir una segunda tecnología de base de datos solo para eso.
- Modelo de datos detallado (tablas, relaciones) a definir durante el diseño técnico del backend.

### Actualización de estado en tiempo real
- **Polling simple** desde el frontend (consulta periódica cada pocos segundos al backend) para reflejar el estado de los jobs en la tabla (RF-7: generando/en ejecución, done, fail, esperando aclaración). Elegido por simplicidad de implementación en el MVP frente a WebSockets/SSE; se puede evolucionar a WebSockets/SSE más adelante si el polling resulta insuficiente en UX o carga de servidor.

### Gestión de secrets
- **MVP local:** variables de entorno vía `.env` (no commiteado).
- **CI:** GitHub Actions Secrets.
- **Producción (AWS):** AWS Secrets Manager (o Parameter Store como alternativa más económica), provisionado vía Terraform y consumido por la Task Definition de ECS/Fargate. Sin vault dedicado externo (ej. HashiCorp Vault) — se considera fuera de alcance para el TFM.

### Estrategia de testing de la propia aplicación
- **Tests unitarios:** lógica de negocio del backend, incluyendo los nodos individuales del grafo de LangGraph (generación de prompt, clasificación de fallo, etc.), de forma aislada.
- **Tests de integración:** endpoints de la API (crear job, consultar estado, responder aclaración), verificando el comportamiento end-to-end del backend sin necesidad de UI.
- Nota: esto es independiente de los tests Robot Framework que la aplicación genera para el usuario — son dos suites de testing distintas con propósitos distintos.

### Calidad de código (linting local)
- **Herramientas:** Husky (git hooks) + lint-staged (corre lint solo sobre archivos modificados) + ESLint + Prettier.
- **Alcance:** backend y frontend, cada uno con su propia configuración de ESLint acorde a su stack (Node/TypeScript vs Next.js/React).
- **Justificación:** detectar code smells y errores de estilo antes del commit, reduciendo ruido en las Pull Requests y el tiempo de CI (que actúa como red de seguridad, no como primera línea de defensa).

### Stack tecnológico y despliegue

- **Frontend:** Next.js (React + TypeScript). Deploy en Vercel (rápido, gratis para fase TFM). Candidato a usar Vercel AI SDK para streaming/feedback incremental (RNF-4).
- **Backend/orquestador:** Node.js (Express/Fastify) + **LangGraph.js** (`@langchain/langgraph`, versión JS de LangGraph — no exclusivo de Python). Elegido por ser la tecnología que mejor conoce el autor, evitando curva de aprendizaje adicional.
- **Empaquetado backend:** contenedor Docker desde el día uno. Justificación: Vercel no soporta procesos largos ni Docker dentro de sus funciones serverless, y el backend necesita levantar el runner de Robot Framework (RF-5) y respetar timeouts de varios minutos (RNF-2) — incompatible con serverless.
- **Runner de Robot Framework:** contenedor Docker independiente, invocado por el backend (no se importa Python desde Node; se ejecuta como proceso/contenedor aislado y se lee su resultado).
- **Desarrollo local:** todo el stack (backend + runner + Postgres) se levanta con `docker-compose` en local, permitiendo desarrollar y probar el ciclo completo del agente sin depender de infraestructura cloud.

### Infraestructura de despliegue — **DECISIÓN CERRADA**

- **Proveedor:** **AWS** (se descarta Railway/Render/Fly.io como destino final).
- **Infraestructura como Código:** **Terraform**, gestionando de forma declarativa:
  - **ECR** (registro de imágenes Docker — backend y runner).
  - **ECS + Fargate** (ejecución del backend containerizado, serverless de contenedores — sin gestionar servidores EC2 directamente).
  - **RDS PostgreSQL** (base de datos gestionada).
  - **IAM** (roles y permisos mínimos necesarios para que Fargate acceda a ECR, RDS y Secrets Manager).
  - **Secrets Manager** (API key de OpenAI, tokens de Jira).
- **Justificación de la decisión:** más allá del requisito técnico, es una decisión pedagógica y de carrera deliberada — practicar IaC con un proveedor cloud real (AWS) tiene alto valor de mercado y da a la memoria del TFM una historia de infraestructura completa y defendible, frente a la simplicidad de un PaaS.
- **Gestión del riesgo de complejidad:** para no comprometer el desarrollo del core del agente (la parte más importante del TFM), la infraestructura en AWS se aborda **después** de tener el walking skeleton funcionando localmente con Docker Compose, como una fase dedicada y guiada paso a paso (ver Plan de Trabajo, `YouAutoQA_Plan.md`).
- **Frontend:** se mantiene en Vercel — no se justifica moverlo a AWS (Vercel resuelve mejor el despliegue de Next.js y no es el foco de aprendizaje de infraestructura de este proyecto).

---

## 5. CI/CD y control de versiones

**Herramienta:** GitHub Actions (gratuito, se integra de forma nativa con GitHub, Docker y Vercel; estándar de la industria, fácil de justificar en la memoria).

**Control de versiones y estrategia de ramas:**
- Repositorio en GitHub.
- Estrategia de ramas: `main` (estable) + ramas de feature (`feature/rf-x-descripcion`) + PRs con revisión antes de mergear.
- Versionado semántico para releases (`v0.1.0` para el MVP, etc.) — a definir con más detalle al iniciar implementación.

**Calidad de código local (pre-commit):**
- Husky + lint-staged + ESLint + Prettier corren automáticamente en cada `git commit`, sobre los archivos modificados.
- Bloquea el commit si hay errores de lint no corregibles automáticamente.

**Pipeline de CI (en cada Pull Request):**
- Frontend (Next.js): lint + build.
- Backend (Node.js): lint + tests unitarios + build de la imagen Docker.
- Runner de Robot Framework: validación de que la imagen Docker construye correctamente.
- (Fase infraestructura) `terraform plan` como check informativo en PRs que toquen la carpeta `infra/`, mostrando cambios propuestos antes de aplicar.

**Pipeline de CD (al mergear a `main`):**
- **Frontend:** despliegue automático a Vercel (ya lo gestiona Vercel de forma nativa al conectar el repo).
- **Backend:** build y push de la imagen Docker a **ECR**, `terraform apply` (o actualización de la Task Definition de ECS) para desplegar la nueva versión en Fargate.
- **Runner de Robot Framework:** build y push de su imagen Docker a ECR, versionada junto con el backend.

---

## 6. Roadmap por fases

**MVP (Fase 1) — Walking skeleton:**
Jira US → generar `.robot` → ejecutar (runner propio, local vía Docker Compose) → detectar fallo → corregir → repetir hasta PASS o máximo de intentos. Login con Atlassian. Roles básicos. Pre-commit configurado desde el inicio.

**Fase 2 — Infraestructura AWS:**
- Terraform: ECR, RDS, IAM, Secrets Manager, ECS/Fargate.
- Migración del backend de local a AWS.
- Pipeline de CD actualizado (push a ECR + despliegue en Fargate).

**Fase 3 — Funcionalidad extendida:**
- RAG (contexto de proyecto, keywords, ejemplos).
- Integración con Jenkins como executor alternativo.
- Login alternativo (Google, etc.).
- Historial, revisión humana, interfaz más completa.

*(Ver desglose detallado en `YouAutoQA_Plan.md`.)*

---

## 7. Pendientes / decisiones abiertas

- [ ] Definir función exacta de function calling nativo vs. orquestador intermediario.
- [ ] Definir estructura exacta de la carpeta de contexto/base de conocimiento (`context/`, `agent.md`, MCP configs, etc.).
- [ ] Medir coste real y tiempos de ciclo una vez el MVP esté funcionando.
- [ ] Cuando se llegue a la fase del RAG: definir elección de vector DB, estrategia de chunking y modelo de embeddings.
- [ ] Modelo de datos detallado en PostgreSQL (tablas, relaciones) — a definir durante el diseño técnico del backend.
- [ ] Diseño detallado de los módulos Terraform (organización de archivos, variables, entornos) — a abordar como guía paso a paso en la Fase 2.

---

## 8. Historial de cambios

- 20/08/2026 — Creación del documento inicial con requisitos recopilados durante mentoría.
- 20/08/2026 — Añadida decisión de stack tecnológico: Next.js (frontend, Vercel) + Node.js/LangGraph.js (backend, Docker) + runner Docker independiente para Robot Framework.
- 20/08/2026 — Cambio de decisión: integración con Jira vía MCP oficial de Atlassian (Rovo) en vez de MCP propio, para reducir complejidad. MCP propio se mantiene solo para Jenkins (fase 2).
- 20/08/2026 — Ampliado RF-8 (RAG) con fuentes priorizadas por señal/complejidad (fases 2a, 2b, 3) y aclaración del mecanismo de recuperación selectiva vs. meter todo el contexto.
- 20/08/2026 — Añadida validación de US inexistente/sin permisos en RF-3 (manejo de error 404/403 del MCP de Jira, mensaje claro en UI).
- 20/08/2026 — Ampliado RF-7 con estructura completa de navegación: Home/Dashboard + 3 pantallas (Creación de test, Control de test, Administración), con visibilidad ligada a roles de RF-2.
- 20/08/2026 — Añadido RF-9: solicitud de clarificación al usuario cuando el agente detecta fallo por falta de información en la US.
- 20/08/2026 — Detallado comportamiento de UI en pantalla de Creación de test: cada búsqueda de US genera un job con ID único, listado en tabla con estado en tiempo real.
- 20/08/2026 — Añadida sección de CI/CD y control de versiones: GitHub Actions, estrategia de ramas, pipelines de CI y CD.
- 20/08/2026 — Ampliado RF-9 con interfaz de clarificación tipo chat.
- 20/08/2026 — Añadido objetivo pedagógico transversal (sección 1).
- 20/08/2026 — Cerrados 4 puntos técnicos complementarios: persistencia en PostgreSQL, polling, gestión de secrets, estrategia de testing.
- 17/09/2026 — **Decisión cerrada de infraestructura:** despliegue en producción vía **AWS + Terraform** (ECR, ECS/Fargate, RDS, IAM, Secrets Manager), descartando Railway/Render/Fly.io como destino final. Justificación pedagógica y de valor de mercado laboral documentada.
- 17/09/2026 — Añadida capa de calidad de código local: **pre-commit con Husky + lint-staged + ESLint + Prettier**, obligatoria (RNF-8), como capa previa a los checks de CI.
- 17/09/2026 — Añadida referencia a `terraform plan` como check informativo en PRs que afecten la carpeta `infra/`.
- 17/09/2026 — Actualizado roadmap por fases: MVP (walking skeleton local) → Fase 2 (infraestructura AWS con Terraform) → Fase 3 (funcionalidad extendida: RAG, Jenkins, etc.). Detalle completo movido a documento de plan separado (`YouAutoQA_Plan.md`).
