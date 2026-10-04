// Regla determinista de "mismo error" (D-21, US-10.3). No usa el LLM, así que es gratis y testeable.

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
