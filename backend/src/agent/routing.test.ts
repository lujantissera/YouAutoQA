import { describe, expect, it } from 'vitest';
import type { AgentConfig } from './config.js';
import { routeAfterClassify, routeAfterRun } from './routing.js';
import type { AgentStateType } from './state.js';

const config: AgentConfig = { maxAttempts: 5, maxTokens: 50_000, executionTimeoutSeconds: 120 };

// Construye un estado válido y deja cambiar solo lo que cada test necesita.
function makeState(overrides: Partial<AgentStateType>): AgentStateType {
  return {
    usText: 'Como usuario quiero iniciar sesión',
    clarifications: [],
    robotCode: '*** Test Cases ***',
    attempt: 1,
    lastRun: { result: 'FAIL', logs: 'error', timedOut: false },
    attempts: [],
    tokensUsed: 0,
    failureKind: null,
    question: null,
    status: 'running',
    ...overrides,
  };
}

// US-07: ciclo de corrección y límite de intentos.
describe('routeAfterRun', () => {
  it('termina en done cuando el test pasa (US-07.2)', () => {
    const state = makeState({ lastRun: { result: 'PASS', logs: 'ok', timedOut: false } });
    expect(routeAfterRun(state, config)).toBe('done');
  });

  it('termina en done aunque pase justo en el último intento', () => {
    const state = makeState({
      attempt: 5,
      lastRun: { result: 'PASS', logs: 'ok', timedOut: false },
    });
    expect(routeAfterRun(state, config)).toBe('done');
  });

  it('clasifica el fallo cuando aún quedan intentos (US-07.1)', () => {
    const state = makeState({ attempt: 4 });
    expect(routeAfterRun(state, config)).toBe('classify');
  });

  it('termina en fail al agotar los intentos y no lanza uno más (US-07.3, US-07.7)', () => {
    const state = makeState({ attempt: 5 });
    expect(routeAfterRun(state, config)).toBe('fail');
  });

  it('respeta un máximo de intentos distinto del por defecto (US-07.6)', () => {
    const state = makeState({ attempt: 2 });
    expect(routeAfterRun(state, { ...config, maxAttempts: 2 })).toBe('fail');
  });

  it('termina en fail al alcanzar el límite de tokens (TS-02.4)', () => {
    const state = makeState({ attempt: 1, tokensUsed: 50_000 });
    expect(routeAfterRun(state, config)).toBe('fail');
  });

  it('trata un timeout como un fallo normal (RNF-2)', () => {
    const state = makeState({
      attempt: 1,
      lastRun: { result: 'FAIL', logs: '', timedOut: true },
    });
    expect(routeAfterRun(state, config)).toBe('classify');
  });
});

// US-10: tras clasificar, un fallo técnico se corrige y la falta de información se pregunta.
describe('routeAfterClassify', () => {
  it('manda a corregir un fallo técnico (US-10.2)', () => {
    const state = makeState({ failureKind: 'technical' });
    expect(routeAfterClassify(state)).toBe('fix');
  });

  it('manda a pedir aclaración si falta información (US-10.4)', () => {
    const state = makeState({ failureKind: 'missing_info' });
    expect(routeAfterClassify(state)).toBe('ask');
  });

  it('lanza un error si el fallo no fue clasificado (bug del programa)', () => {
    const state = makeState({ failureKind: null });
    expect(() => routeAfterClassify(state)).toThrow();
  });
});
