import { parseReplyMarker } from './reply-marker.js';

// D-41: al corregir un test, el modelo puede responder "NEEDS_INFO: <pregunta>" en vez de código
// cuando los logs muestran que falta información o que la función no existe en la aplicación.
// Devuelve la pregunta, o null si la respuesta es código normal.
export function parseNeedsInfo(text: string): string | null {
  return parseReplyMarker(text, 'NEEDS_INFO');
}
