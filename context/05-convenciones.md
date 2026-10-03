# Convenciones

## Idioma
- Documentación y conversación: **español**.
- Código, identificadores, mensajes de commit, nombres de ramas: **inglés** (salvo textos de UI, que serán en español).

## Git
- `main` protegida; trabajo en `feature/rf-x-descripcion`, `fix/...`, `docs/...`, `chore/...`.
- PR obligatorio con revisión antes de mergear.
- Commits en formato Conventional Commits: `feat(backend): add clarify endpoint`.
- Releases con versionado semántico (`v0.1.0` = MVP).

## Calidad de código
- TypeScript en modo `strict` en backend y frontend.
- ESLint + Prettier con configuración propia en cada paquete (Node/TS vs Next.js/React).
- Husky + lint-staged en cada commit; **prohibido `--no-verify`**.
- Funciones cortas y con un solo propósito; nombres claros; sin duplicación.
- Aplicar principios SOLID y puertos/adaptadores para aislar LLM, Jira, runner y BBDD.

## Testing (de la propia app)
- **Unitarios**: lógica de negocio y cada nodo del grafo de LangGraph de forma aislada, con el LLM mockeado.
- **Integración**: endpoints de la API (crear job, consultar estado, responder aclaración), sin UI.
- Los tests deben ser deterministas: nunca llamar al LLM real en CI.
- No confundir con los `.robot` que genera la app: son otra suite con otro propósito.
- Metodología: partir de las User Stories y sus criterios de aceptación para derivar los tests (Spec Driven Development).
- **TDD selectivo** (ciclo rojo → verde → refactor): se escribe primero el test, se ve fallar, se escribe el mínimo código para que pase y se mejora sin romperlo.
  - **Sí aplica** a la lógica determinista: aristas del grafo (`decideNextStep`), contador de intentos y su reinicio tras una aclaración, heurístico de `clasificar_fallo`, endpoints y permisos por rol.
  - **No aplica** a la calidad de lo que genera el LLM (salida no determinista): se evalúa aparte con una pequeña suite de evaluación (2-3 US de ejemplo: ¿pasa a la primera?, ¿cuántos intentos necesita?). Tampoco a la configuración ni a las pantallas del MVP.
  - La lógica de decisión se escribe como **funciones puras** y recibe el LLM, Jira y el runner como parámetros (puertos), para poder usar dobles de prueba. Nunca se llama a servicios reales desde los tests.
  - Framework: **Vitest** (backend). Script `npm test`.

## Seguridad (OWASP Top 10 aplicado)
- Validar y sanear toda entrada (ID de US, mensajes de aclaración, parámetros de API).
- Control de acceso en el backend según la matriz de roles (RF-2); nunca confiar solo en la UI.
- Secretos fuera del código y de los logs. Revisar que los logs de ejecución no filtren datos sensibles.
- Tratar el contenido de la US y la salida del LLM como **no confiables** (inyección de prompts, código generado).
- Runner aislado: sin privilegios, límites de recursos y timeout.
- Dependencias: revisar vulnerabilidades (`npm audit`, Dependabot).
- Usar la IA como copiloto de revisión, **sin aceptar sugerencias a ciegas**.

## Configuración
- Límites del sistema (máx. iteraciones, timeout, URL de la AUT) configurables, nunca hardcodeados.
- Variables de entorno documentadas en `.env.example` (sin valores reales).

## Documentación
- Cada decisión relevante → `context/04-decisiones.md`.
- Al cerrar una fase → actualizar `context/03-plan-y-estado.md`.
- README del repo con cómo levantar el entorno local y cómo funcionan los hooks.
