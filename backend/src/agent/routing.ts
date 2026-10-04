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

export type ClassifyRoute = 'fix' | 'ask';

// Arista condicional tras `classifyFailure`: corregir el test o preguntar al usuario.
// Si llega sin clasificar es un bug del programa, no un caso de negocio: fallamos en
// voz alta en vez de elegir una ruta "por defecto" que escondería el error.
export function routeAfterClassify(state: AgentStateType): ClassifyRoute {
  if (state.failureKind === 'technical') return 'fix';
  if (state.failureKind === 'missing_info') return 'ask';
  throw new Error('routeAfterClassify called before the failure was classified');
}
