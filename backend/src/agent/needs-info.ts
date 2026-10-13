import { extractFenced } from './markdown-fence.js';

const NEEDS_INFO = /^NEEDS_INFO:\s*([\s\S]+)$/i;

// D-41: al corregir un test, el modelo puede responder "NEEDS_INFO: <pregunta>" en vez de código
// cuando los logs muestran que falta información o que la función no existe en la aplicación.
// Devuelve la pregunta, o null si la respuesta es código normal. Solo cuenta al PRINCIPIO de la
// respuesta: la palabra dentro de un .robot (p. ej. en un Log) no debe confundirse con el aviso.
export function parseNeedsInfo(text: string): string | null {
  const body = (extractFenced(text) ?? text).trim();
  const question = NEEDS_INFO.exec(body)?.[1]?.trim();
  return question ? question : null;
}
