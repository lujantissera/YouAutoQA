import { Command } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { AgentConfig } from './config.js';
import { buildGraph } from './graph.js';
import type { RunResult } from './ports.js';
import { FakeLlm, FakeRunner } from './testing/fakes.js';

const baseConfig: AgentConfig = { maxAttempts: 5, maxTokens: 50_000, executionTimeoutSeconds: 120 };
const pass: RunResult = { result: 'PASS', logs: 'ok', timedOut: false };
const fail = (logs: string): RunResult => ({ result: 'FAIL', logs, timedOut: false });
const input = { usText: 'Como usuario quiero iniciar sesión' };

// Prepara un grafo con dobles. `llmTexts` y `runs` son las respuestas guionizadas, en orden.
function setup(llmTexts: string[], runs: RunResult[], config: Partial<AgentConfig> = {}) {
  const llm = new FakeLlm(llmTexts);
  const runner = new FakeRunner(runs);
  const graph = buildGraph({ llm, runner, config: { ...baseConfig, ...config } });
  // thread_id identifica el job: el checkpointer guarda el estado por hilo (necesario para interrupt).
  const thread = { configurable: { thread_id: 'job-1' } };
  return { llm, runner, graph, thread };
}

describe('agent graph', () => {
  it('pasa a la primera: un solo ciclo generar -> ejecutar (US-05, US-07.2)', async () => {
    const { llm, runner, graph, thread } = setup(['robot v1'], [pass]);

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('done');
    expect(result.attempt).toBe(1);
    expect(runner.calls).toHaveLength(1);
    expect(llm.calls).toHaveLength(1);
  });

  it('falla dos veces y pasa a la tercera, corrigiendo entre medias (US-07.1, US-07.4)', async () => {
    const { llm, runner, graph, thread } = setup(
      ['robot v1', 'robot v2', 'robot v3'],
      [fail('selector login not found'), fail('timeout waiting for dashboard'), pass],
    );

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('done');
    expect(result.attempt).toBe(3);
    expect(llm.calls).toHaveLength(3); // 1 generar + 2 corregir
    expect(runner.calls.map((c) => c.robotCode)).toEqual(['robot v1', 'robot v2', 'robot v3']);
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts[0]?.failureKind).toBe('technical');
  });

  it('nunca pasa: se detiene en el máximo de intentos y no lanza uno más (US-07.3, US-07.7)', async () => {
    const { runner, graph, thread } = setup(
      ['v1', 'v2', 'v3'],
      [fail('error alpha'), fail('error beta'), fail('error gamma')],
      { maxAttempts: 3 },
    );

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('fail');
    expect(runner.calls).toHaveLength(3);
  });

  it('mismo error dos veces: se pausa y pregunta; al responder reinicia el contador (US-10, US-11.3)', async () => {
    const { runner, graph, thread } = setup(
      ['v1', 'v2', '¿Dónde se hace la baja del cliente?', 'v3'],
      [fail('element baja button not found'), fail('element baja button not found'), pass],
    );

    await graph.invoke(input, thread);

    // El grafo se queda esperando al humano.
    const paused = await graph.getState(thread);
    expect(paused.values.status).toBe('awaiting_clarification');
    expect(paused.values.question).toBe('¿Dónde se hace la baja del cliente?');
    expect(paused.next).toEqual(['askClarification']);
    expect(runner.calls).toHaveLength(2); // no se ejecuta nada mientras espera

    // El usuario responde y el grafo continúa.
    const result = await graph.invoke(
      new Command({ resume: 'Está en el menú Clientes > Baja' }),
      thread,
    );

    expect(result.status).toBe('done');
    expect(result.attempt).toBe(1); // reiniciado a 0 y luego una ejecución
    expect(result.clarifications.map((c) => c.role)).toEqual(['agent', 'user']);
    expect(result.question).toBeNull();
  });

  it('se detiene al alcanzar el límite de tokens (TS-02.4)', async () => {
    // Cada llamada al LLM gasta 150 tokens; el límite es 200.
    const { runner, graph, thread } = setup(
      ['v1', 'v2', 'v3'],
      [fail('error alpha'), fail('error beta'), fail('error gamma')],
      { maxTokens: 200 },
    );

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('fail');
    expect(runner.calls).toHaveLength(2); // generar (150) + corregir (300 >= 200) -> fail
  });

  it('tras una aclaración, un fallo igual al de antes de preguntar no vuelve a pausar el grafo (D-14)', async () => {
    const { runner, graph, thread } = setup(
      ['v1', 'v2', '¿Dónde está el botón?', 'v3', 'v4'],
      [fail('button not found'), fail('button not found'), fail('button not found'), pass],
    );

    await graph.invoke(input, thread);
    const result = await graph.invoke(new Command({ resume: 'Está arriba a la derecha' }), thread);

    // El 3.er fallo es el primero del ciclo nuevo: se corrige (técnico), no se vuelve a preguntar.
    expect(result.status).toBe('done');
    expect(runner.calls).toHaveLength(4);
    expect(result.attempts.map((a) => a.id)).toEqual([1, 2, 3, 4]);
  });
});
