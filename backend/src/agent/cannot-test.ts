import { parseReplyMarker } from './reply-marker.js';

// D-42: al corregir, el modelo responde "CANNOT_TEST: <motivo>" cuando la US no se puede cumplir
// en esta aplicación (p. ej. la función no existe) y ya no hay nada que preguntar ni corregir.
export function parseCannotTest(text: string): string | null {
  return parseReplyMarker(text, 'CANNOT_TEST');
}
