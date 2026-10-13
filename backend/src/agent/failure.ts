// Reglas deterministas para clasificar fallos (D-21, US-10.3). No usan el LLM: son gratis y testeables.
import type { RunResult } from './ports.js';
import { EMPTY_TEST_LOGS } from './robot-code.js';

// Fallos de entorno: la app no carga o no responde. Cambiar el test no los arregla y el usuario
// no tiene nada que aclarar. Solo cuentan los timeouts de NAVEGACIÓN (`page.goto`) y el timeout
// global del runner: un "Timeout esperando un selector" NO está aquí porque ahí el selector
// puede estar mal, es decir, puede faltar información.
const ENVIRONMENT_PATTERNS = [
  /net::err_[a-z_]+/i,
  /page\.goto: timeout/i,
  /econnrefused|econnreset|enotfound|getaddrinfo/i,
  // El propio runner no está disponible (Docker apagado): tampoco lo arregla ni el LLM ni el usuario.
  /failed to connect to the docker api/i,
  /cannot connect to the docker daemon/i,
];

export function isEnvironmentFailure(run: RunResult): boolean {
  return run.timedOut || ENVIRONMENT_PATTERNS.some((pattern) => pattern.test(run.logs));
}

// Errores del código generado (sintaxis, keyword inexistente, librería mal importada, respuesta
// vacía del LLM). Aunque se repitan, el culpable es el modelo y no la US: se corrigen, no se preguntan.
const CODE_ERROR_PATTERNS = [
  /no keyword with name/i,
  /error in file/i,
  /importing library .* failed/i,
];

export function isCodeError(logs: string): boolean {
  return (
    logs.includes(EMPTY_TEST_LOGS) || CODE_ERROR_PATTERNS.some((pattern) => pattern.test(logs))
  );
}

// Deja el error en una forma comparable: dos fallos por el mismo motivo casi nunca son
// idénticos carácter a carácter (cambian tiempos, líneas, mayúsculas, espacios).
export function normalizeError(logs: string): string {
  return logs.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

// `previousLogs` es undefined en el primer fallo: no hay nada con qué comparar.
export function isRepeatedError(previousLogs: string | undefined, currentLogs: string): boolean {
  if (previousLogs === undefined) return false;
  return normalizeError(previousLogs) === normalizeError(currentLogs);
}
