# YouAutoQA

Agente de IA que genera tests de **Robot Framework** a partir de una User Story de **Jira**, los ejecuta y, si fallan, analiza el error y los corrige de forma iterativa hasta que pasan (PASS) o se agota el máximo de intentos.

Trabajo Final de Máster (TFM) del Máster de Desarrollo con IA de BIG school.

> **Estado:** Fase 0 (setup del repo). Todavía no hay funcionalidad; ver [`context/03-plan-y-estado.md`](context/03-plan-y-estado.md).

## Cómo funciona (visión general)

1. El usuario introduce el ID de una User Story de Jira.
2. El agente (LangGraph.js + OpenAI) genera un test `.robot`.
3. Un runner de Robot Framework en Docker lo ejecuta (con timeout).
4. Si falla, el agente analiza el error y corrige el test. Máximo de intentos configurable.
5. Si el fallo se debe a falta de información en la US, el agente pausa y pide aclaración.

## Stack

| Capa                  | Tecnología                                            |
| --------------------- | ----------------------------------------------------- |
| Frontend              | Next.js + React + TypeScript                          |
| Backend / orquestador | Node.js + TypeScript + LangGraph.js                   |
| LLM                   | OpenAI API                                            |
| Jira                  | MCP oficial de Atlassian                              |
| Ejecución de tests    | Robot Framework en contenedor Docker (`rf-runner/`)   |
| Base de datos         | PostgreSQL                                            |
| Calidad local         | Husky + lint-staged + ESLint + Prettier               |

## Estructura del repositorio

```
youautoqa/
├── backend/     # API + grafo LangGraph
├── frontend/    # Next.js
├── rf-runner/   # Docker con Robot Framework
├── infra/       # Terraform (Fase 7)
└── context/     # Documentación de requisitos, arquitectura, plan y decisiones
```

## Requisitos previos

- **Node.js 22 LTS** (el proyecto declara `>=22`) y npm.
- Git.
- Docker (a partir de la Fase 1, para el runner).

## Puesta en marcha local

```bash
git clone https://github.com/LujanTissera/YouAutoQA.git
cd YouAutoQA
npm install
cp .env.example .env   # rellena los valores; .env nunca se commitea
```

`npm install` en la raíz instala las dependencias de todos los workspaces (`backend`, `frontend`) y, mediante el script `prepare`, activa los hooks de Husky.

### Variables de entorno

Documentadas en [`.env.example`](.env.example). Los límites del agente (`MAX_ATTEMPTS`, `EXECUTION_TIMEOUT_SECONDS`) son configurables y nunca están fijados en el código.

## Calidad de código y hooks

En cada `git commit`, **Husky** ejecuta **lint-staged**, que solo revisa los archivos del commit:

| Archivos                    | Qué se ejecuta                                      |
| --------------------------- | --------------------------------------------------- |
| `backend/**/*.{ts,js,...}`  | ESLint (con la config del backend) + Prettier       |
| `frontend/**/*.{ts,tsx,...}`| ESLint (con la config del frontend) + Prettier      |
| `*.{json,yml,yaml,css}`     | Prettier                                            |

Si ESLint encuentra un error (por ejemplo, un `console.log`), **el commit se cancela**. No uses `--no-verify`.

Comandos útiles desde la raíz:

```bash
npm run lint           # ESLint en todos los workspaces
npm run format         # Prettier: formatea todo
npm run format:check   # Prettier: solo comprueba
```

## Flujo de trabajo Git

- `main` está protegida: los cambios entran por Pull Request con revisión.
- Ramas: `feature/rf-x-descripcion`, `fix/...`, `docs/...`, `chore/...`.
- Commits en inglés, formato [Conventional Commits](https://www.conventionalcommits.org/): `feat(backend): add clarify endpoint`.

## Documentación

Toda la base de conocimiento del proyecto está en [`context/`](context/):

| Documento                                                      | Contenido                        |
| -------------------------------------------------------------- | -------------------------------- |
| [`00-vision-y-alcance.md`](context/00-vision-y-alcance.md)     | Qué se construye y alcance MVP   |
| [`01-requisitos.md`](context/01-requisitos.md)                 | Requisitos funcionales y no funcionales |
| [`02-arquitectura.md`](context/02-arquitectura.md)             | Arquitectura y diseño del agente |
| [`03-plan-y-estado.md`](context/03-plan-y-estado.md)           | Fases y estado actual            |
| [`04-decisiones.md`](context/04-decisiones.md)                 | Decisiones de arquitectura       |
| [`05-convenciones.md`](context/05-convenciones.md)             | Convenciones de código y seguridad |
| [`06-user-stories.md`](context/06-user-stories.md)             | User Stories y criterios de aceptación |
