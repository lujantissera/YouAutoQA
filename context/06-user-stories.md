# User Stories

> Estado: **plantilla vacía**. Se rellena en sesión de tutoría, una US cada vez, con criterios de aceptación en formato Given/When/Then (Gherkin).
> Cada US enlaza con su requisito (RF/RNF) y con los tests que la validan.

## Formato

```
### US-XX — Título
**Requisito:** RF-X
**Como** <rol> **quiero** <acción> **para** <beneficio>.

**Criterios de aceptación**
- Dado ... cuando ... entonces ...

**Notas / fuera de alcance:**
**Tests asociados:** (unitario / integración)
**Prioridad (MoSCoW):** Must | Should | Could | Won't
**Fase:** 
```

## Candidatas (derivadas de los requisitos, por priorizar)

| US | Resumen | Requisito |
|---|---|---|
| US-01 | Iniciar sesión con mi cuenta de Atlassian | RF-1 |
| US-02 | Ver y usar solo las pantallas permitidas por mi rol | RF-2 |
| US-03 | Buscar una User Story de Jira por su ID | RF-3 |
| US-04 | Ver un error claro si la US no existe o no tengo permisos | RF-3 |
| US-05 | Generar un test `.robot` a partir de una US | RF-4 |
| US-06 | Ejecutar el test generado en un entorno aislado | RF-5 |
| US-07 | Que el agente corrija el test automáticamente si falla | RF-6, RNF-1 |
| US-08 | Ver el estado de cada job en tiempo real en una tabla | RF-7, RNF-3 |
| US-09 | Ver el detalle por intento (1/5, 2/5…) y los logs | RF-7, RNF-4 |
| US-10 | Que el agente me pregunte cuando falta información en la US | RF-9 |
| US-11 | Responder por chat y que el agente continúe con intentos reiniciados | RF-9 |
| US-12 | Gestionar usuarios, roles y límites del sistema (Admin) | RF-2, RF-7 |
| US-13 | Que el agente reutilice keywords y ejemplos del proyecto | RF-8 |

## Detalladas
_(pendiente — empezamos por US-03/US-04 o US-10/US-11)_
