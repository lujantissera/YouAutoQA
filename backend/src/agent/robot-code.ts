const FENCE = /```[a-zA-Z]*\r?\n([\s\S]*?)```/;
const SECTION_HEADER = /^\*{3}\s*[A-Za-z ]+?\s*\*{0,3}\s*$/m;
const TEST_CASES_SECTION = /^\*{3}\s*test cases?\s*\*{0,3}\s*$/im;

// Log que se registra cuando el LLM no devuelve un test usable. Es una constante compartida
// para que la clasificación de fallos pueda reconocerlo (es un error del modelo, no de la US).
export const EMPTY_TEST_LOGS =
  'The model did not return a usable Robot Framework test (empty or not interpretable).';

// US-05.2 / 05.3: el LLM a veces envuelve el código en ```robot o añade explicaciones.
// Devuelve solo el código Robot, o null si la respuesta no es un test interpretable
// (vacía, solo prosa, o sin sección "Test Cases"). Es una comprobación mínima, no un parser:
// la validación real de sintaxis la hace Robot al ejecutar.
export function extractRobotCode(text: string): string | null {
  const fenced = FENCE.exec(text)?.[1];
  let code = fenced ?? text;

  // Sin valla: tiramos lo que haya antes de la primera cabecera de sección (*** ... ***).
  const header = SECTION_HEADER.exec(code);
  if (header) code = code.slice(header.index);

  code = code.trim();
  return TEST_CASES_SECTION.test(code) ? code : null;
}
