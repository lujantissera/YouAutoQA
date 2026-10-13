import { z } from 'zod';
import { extractFenced } from './markdown-fence.js';

// Forma esperada de la respuesta del LLM: o está lista, o trae UNA pregunta no vacía.
const StoryCheckSchema = z.discriminatedUnion('ready', [
  z.object({ ready: z.literal(true) }),
  z.object({ ready: z.literal(false), question: z.string().trim().min(1) }),
]);

export type StoryCheck = z.infer<typeof StoryCheckSchema>;

// Valida la respuesta del LLM. Es "fail-open": si no es JSON o no tiene la forma esperada,
// se da la US por lista. Un validador roto no debe impedir trabajar al usuario; lo peor que
// pasa es que se genere con información justa, y después aún actúan las reglas de fallos.
export function parseStoryCheck(text: string): StoryCheck {
  try {
    const json: unknown = JSON.parse(extractFenced(text) ?? text.trim());
    const parsed = StoryCheckSchema.safeParse(json);
    if (parsed.success) return parsed.data;
  } catch {
    // no era JSON: caemos al valor por defecto
  }
  return { ready: true };
}
