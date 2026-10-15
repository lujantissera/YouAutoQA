import { extractFenced } from './markdown-fence.js';

// Lector genérico de respuestas del LLM del tipo "MARCADOR: texto" (NEEDS_INFO, CANNOT_TEST...).
// Devuelve el texto tras el marcador, o null si la respuesta no empieza por él o viene vacío.
// Solo cuenta al PRINCIPIO: la misma palabra dentro de un .robot (p. ej. en un Log) no debe
// confundirse con un aviso. `marker` es siempre una constante nuestra (letras y guiones bajos).
export function parseReplyMarker(text: string, marker: string): string | null {
  const body = (extractFenced(text) ?? text).trim();
  const found = new RegExp(`^${marker}:\\s*([\\s\\S]+)$`, 'i').exec(body)?.[1]?.trim();
  return found ? found : null;
}
