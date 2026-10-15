import type { AgentConfig } from './config.js';
import type { AgentStateType } from './state.js';

export type RunRoute = 'done' | 'fail' | 'classify';

// Arista condicional tras `runTest`: decide el siguiente paso.
// Función pura (sin LLM ni Docker), por eso se testea de forma aislada.
// El orden importa:
//   1. PASS gana siempre, incluso si fue justo en el último intento.
//   2. Los límites (intentos y tokens) se comprueban ANTES de gastar más: así
//      nunca hay una ejecución o llamada al LLM por encima del máximo (US-07.7).
//   3. Si no, hay que averiguar por qué falló.
export function routeAfterRun(state: AgentStateType, config: AgentConfig): RunRoute {
  if (state.lastRun?.result === 'PASS') return 'done';
  if (state.attempt >= config.maxAttempts) return 'fail';
  if (state.tokensUsed >= config.maxTokens) return 'fail';
  return 'classify';
}

// D-42: cada ronda de aclaración deja un mensaje del agente en `clarifications`, así que las
// preguntas ya hechas se cuentan ahí, sin un contador aparte que pueda desincronizarse.
function canAskMore(state: AgentStateType, config: AgentConfig): boolean {
  const asked = state.clarifications.filter((c) => c.role === 'agent').length;
  return asked < config.maxClarifications;
}

export type StoryCheckRoute = 'generate' | 'ask' | 'abort';

// Arista condicional tras `checkStory` (D-40): si dejó una pregunta, se pausa antes de generar
// (o se aborta si ya se agotaron las preguntas, D-42).
export function routeAfterStoryCheck(state: AgentStateType, config: AgentConfig): StoryCheckRoute {
  if (state.question === null) return 'generate';
  return canAskMore(state, config) ? 'ask' : 'abort';
}

export type FixRoute = 'run' | 'ask' | 'abort';

// Arista condicional tras `fixTest`:
//   - CANNOT_TEST (D-42): la US no se puede cumplir en esta app -> se aborta con su motivo.
//   - Pregunta en vez de código (D-41): se pausa para aclararla, o se aborta si ya no quedan rondas.
//   - Si no, se ejecuta el test corregido.
export function routeAfterFix(state: AgentStateType, config: AgentConfig): FixRoute {
  if (state.failureKind === 'cannot_test') return 'abort';
  if (state.question === null) return 'run';
  return canAskMore(state, config) ? 'ask' : 'abort';
}

export type ClassifyRoute = 'fix' | 'ask' | 'retry' | 'abort';

// Arista condicional tras `classifyFailure`: corregir el test, preguntar al usuario, reintentar
// el mismo test (fallo de entorno) o abortar (segundo fallo de entorno seguido).
// Si llega sin clasificar es un bug del programa, no un caso de negocio: fallamos en
// voz alta en vez de elegir una ruta "por defecto" que escondería el error.
export function routeAfterClassify(state: AgentStateType, config: AgentConfig): ClassifyRoute {
  if (state.failureKind === 'technical') return 'fix';
  // Un fallo de entorno con `failureReason` es el segundo seguido: classifyFailure ya decidió abortar.
  if (state.failureKind === 'environment') return state.failureReason !== null ? 'abort' : 'retry';
  if (state.failureKind === 'missing_info') return canAskMore(state, config) ? 'ask' : 'abort';
  throw new Error('routeAfterClassify called before the failure was classified');
}
