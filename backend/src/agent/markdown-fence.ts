const FENCED_BLOCK = /```[a-zA-Z]*\r?\n([\s\S]*?)```/;

// Los LLM suelen envolver su respuesta en ```lenguaje ... ```. Devuelve el contenido del primer
// bloque con valla, o undefined si no hay ninguno. Compartido por los lectores de respuestas.
export function extractFenced(text: string): string | undefined {
  return FENCED_BLOCK.exec(text)?.[1];
}
