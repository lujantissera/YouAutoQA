// Límites del agente. Nunca se hardcodean: se inyectan desde fuera (env en producción,
// valores sueltos en los tests). RNF-1, RNF-2 y D-22.
export interface AgentConfig {
  /** Máximo de ejecuciones por job (D-28: intento = una ejecución). */
  maxAttempts: number;
  /** Límite de tokens acumulados por job (D-22). */
  maxTokens: number;
  /** Timeout de cada ejecución de Robot, en segundos. */
  executionTimeoutSeconds: number;
}
