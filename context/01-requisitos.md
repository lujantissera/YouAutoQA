# Requisitos (resumen con IDs)

> Versión detallada y viva: `YouAutoQA_Requisitos.md`. Este resumen existe para consulta rápida de la IA.

## Funcionales

| ID | Resumen | Fase |
|---|---|---|
| RF-1 | Login con OAuth 2.0 Atlassian. Arquitectura preparada para varios proveedores (`users` + `linked_accounts`). Google en fase posterior. | 5 |
| RF-2 | Tres roles (Admin, QA Controller, QA Executer) con matriz de permisos. | 5 |
| RF-3 | Introducir ID de US; obtener descripción, criterios de aceptación e info relevante vía MCP Atlassian. Si 404/403: mensaje claro en UI y no se permite generar. | 2 |
| RF-4 | Enviar US (+ contexto RAG cuando exista) al LLM y generar el/los `.robot`. | 1 |
| RF-5 | Guardar el `.robot` y ejecutarlo con Robot Framework. MVP: runner Docker propio. Fase posterior: Jenkins vía MCP propio. | 1 |
| RF-6 | Ciclo de corrección automática: logs → LLM → corrige → reejecuta, hasta PASS o máx. intentos. | 1 |
| RF-7 | Pantallas: Home/Dashboard, Creación de test, Control de test, Administración. Visibilidad por rol. | 4 |
| RF-8 | RAG (evolución): recuperación selectiva top-k sobre tests existentes, keywords, locators y convenciones. | 8 |
| RF-9 | Human-in-the-loop: si el fallo es por falta de información, el agente pausa, pregunta por chat y reinicia el contador al recibir respuesta. | 1 y 4 |

### Detalle clave de RF-7 (Creación de test)
- Cada generación crea un **job** con ID único, mostrado en una tabla bajo el buscador, sin recargar ni bloquear jobs en paralelo.
- Estados del job: `generando` / `en ejecución` → `done` | `fail` | `esperando aclaración` (destacado visualmente).
- Al entrar a un job en `esperando aclaración` se abre una subpantalla tipo **chat** (puede haber varias preguntas).

## No funcionales

| ID | Requisito |
|---|---|
| RNF-1 | Máximo 5 iteraciones de corrección por test. |
| RNF-2 | Timeout por ejecución de Robot: 2 min (propuesto). Si se excede, cuenta como fallo. |
| RNF-3 | Ejecución asíncrona con jobs en background; la UI no se bloquea. |
| RNF-4 | Feedback incremental por intento en la UI ("Intento 2/5: fallo en step 'login'..."). |
| RNF-5 | Coste estimado ~15.000–25.000 tokens por ciclo en el peor caso. Medir empíricamente. |
| RNF-6 | URL de la aplicación bajo test (AUT) configurada a nivel de proyecto. |
| RNF-7 | Autenticación delegada en proveedor externo, sin contraseñas propias. |
| RNF-8 | Ningún commit llega al remoto sin pasar linting local (pre-commit). |

## Pendiente de definir (requisitos que aún faltan)
- Requisitos de **seguridad** explícitos (OWASP): validación de inputs, protección de logs con datos sensibles, aislamiento del runner (ejecuta código generado por un LLM), límites de coste.
- Requisitos de **observabilidad** (logging, trazabilidad de prompts y costes).
- **Criterios de aceptación** medibles por requisito (ver `06-user-stories.md`).
