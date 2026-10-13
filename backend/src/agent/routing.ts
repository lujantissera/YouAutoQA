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

export type StoryCheckRoute = 'generate' | 'ask';

// Arista condicional tras `checkStory` (D-40): si dejó una pregunta, se pausa antes de generar.
export function routeAfterStoryCheck(state: AgentStateType): StoryCheckRoute {
  return state.question !== null ? 'ask' : 'generate';
}

export type FixRoute = 'run' | 'ask';

// Arista condicional tras `fixTest` (D-41): si el modelo devolvió una pregunta en vez de código,
// se pausa para aclararla; si no, se ejecuta el test corregido.
export function routeAfterFix(state: AgentStateType): FixRoute {
  return state.question !== null ? 'ask' : 'run';
}

export type ClassifyRoute = 'fix' | 'ask' | 'retry' | 'abort';

// Arista condicional tras `classifyFailure`: corregir el test, preguntar al usuario, reintentar
// el mismo test (fallo de entorno) o abortar (segundo fallo de entorno seguido).
// Si llega sin clasificar es un bug del programa, no un caso de negocio: fallamos en
// voz alta en vez de elegir una ruta "por defecto" que escondería el error.
export function routeAfterClassify(state: AgentStateType): ClassifyRoute {
  if (state.failureKind === 'technical') return 'fix';
  // Un fallo de entorno con `failureReason` es el segundo seguido: classifyFailure ya decidió abortar.
  if (state.failureKind === 'environment') return state.failureReason !== null ? 'abort' : 'retry';
  if (state.failureKind === 'missing_info') return 'ask';
  throw new Error('routeAfterClassify called before the failure was classified');
}
