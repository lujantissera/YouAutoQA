# Visión y alcance

## Qué es
YouAutoQA es un **agente de IA** (no un simple generador de código) capaz de **generar, ejecutar, analizar y corregir** tests de Robot Framework de forma autónoma e iterativa, a partir de una User Story de Jira.

## Problema que resuelve
Escribir y mantener tests de automatización a partir de historias de usuario es lento y repetitivo. El agente produce un primer test funcional y lo deja pasando, o indica con claridad por qué no puede (fallo técnico agotado o falta de información en la US).

## Flujo principal
```
Usuario introduce US-1234
   → App consulta Jira (MCP Atlassian)
   → LLM genera .robot
   → Runner Docker ejecuta Robot Framework
   → PASS  → fin (done)
   → FAIL  → clasificar fallo
        ├─ técnico      → LLM corrige → vuelve a ejecutar (máx. 5 intentos)
        └─ falta de info → pausa y pregunta al usuario (chat) → reinicia intentos a 0
```

## Usuarios (roles)
- **Admin**: gestiona usuarios, roles y configuración (Jira/Jenkins/AUT/límites).
- **QA Controller**: genera y edita tests, ejecuta y ve resultados.
- **QA Executer**: ve tests (solo lectura), ejecuta/re-ejecuta y ve resultados.

## Alcance por fases
- **MVP (walking skeleton)**: Jira US → .robot → ejecutar → detectar fallo → corregir → PASS o máx. intentos. Login Atlassian. Roles básicos. Pre-commit desde el inicio. Todo en local con Docker Compose.
- **Fase de infraestructura**: despliegue en AWS con Terraform.
- **Extendido**: RAG, Jenkins como executor alternativo, login con Google, historial y revisión humana.

## Fuera de alcance (de momento)
- RAG con pantallazos/imágenes (requiere modelo multimodal).
- Vault externo de secretos (HashiCorp Vault).
- Mover el frontend a AWS (se queda en Vercel).
- n8n.

## Objetivo pedagógico transversal
Practicar de forma aplicada: DevOps/CI-CD (Git, GitHub Actions, Docker), IaC con Terraform en AWS real, calidad de código con pre-commit, arquitectura, seguridad (OWASP), testing y uso de IA con criterio. Cada decisión se documenta y justifica porque alimenta la **memoria del TFM**.
