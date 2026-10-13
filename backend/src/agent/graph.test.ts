import { Command } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { AgentConfig } from './config.js';
import { buildGraph } from './graph.js';
import type { RunResult } from './ports.js';
import { FakeLlm, FakeRunner } from './testing/fakes.js';

// storyCheck desactivado por defecto: así los tests de generar/ejecutar/corregir no cuentan esa llamada.
const baseConfig: AgentConfig = {
  maxAttempts: 5,
  maxTokens: 50_000,
  executionTimeoutSeconds: 120,
  storyCheck: false,
};
const pass: RunResult = { result: 'PASS', logs: 'ok', timedOut: false };
const fail = (logs: string): RunResult => ({ result: 'FAIL', logs, timedOut: false });
const input = { usText: 'Como usuario quiero iniciar sesión' };
// Respuesta de LLM que es un .robot válido (si no, el agente la trata como no interpretable, US-05.3).
const code = (n: number) => `*** Test Cases ***\nTest ${n}`;

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
    const { llm, runner, graph, thread } = setup([code(1)], [pass]);

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('done');
    expect(result.attempt).toBe(1);
    expect(runner.calls).toHaveLength(1);
    expect(llm.calls).toHaveLength(1);
  });

  it('falla dos veces y pasa a la tercera, corrigiendo entre medias (US-07.1, US-07.4)', async () => {
    const { llm, runner, graph, thread } = setup(
      [code(1), code(2), code(3)],
      [fail('selector login not found'), fail('timeout waiting for dashboard'), pass],
    );

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('done');
    expect(result.attempt).toBe(3);
    expect(llm.calls).toHaveLength(3); // 1 generar + 2 corregir
    expect(runner.calls.map((c) => c.robotCode)).toEqual([code(1), code(2), code(3)]);
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts[0]?.failureKind).toBe('technical');
  });

  it('nunca pasa: se detiene en el máximo de intentos y no lanza uno más (US-07.3, US-07.7)', async () => {
    const { runner, graph, thread } = setup(
      [code(1), code(2), code(3)],
      [fail('error alpha'), fail('error beta'), fail('error gamma')],
      { maxAttempts: 3 },
    );

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('fail');
    expect(runner.calls).toHaveLength(3);
  });

  it('mismo error dos veces: se pausa y pregunta; al responder reinicia el contador (US-10, US-11.3)', async () => {
    const { runner, graph, thread } = setup(
      [code(1), code(2), '¿Dónde se hace la baja del cliente?', code(3)],
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

  it('un fallo de entorno se reintenta con el mismo test, sin llamar al LLM ni preguntar', async () => {
    const { llm, runner, graph, thread } = setup(
      [code(1)],
      [fail('page.goto: net::ERR_CONNECTION_REFUSED at http://app/'), pass],
    );

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('done');
    expect(runner.calls.map((c) => c.robotCode)).toEqual([code(1), code(1)]);
    expect(llm.calls).toHaveLength(1); // solo la generación inicial
    expect(result.attempts[0]?.failureKind).toBe('environment');
    expect(result.clarifications).toEqual([]);
  });

  it('dos fallos de entorno seguidos terminan el job en fail con un motivo, sin preguntar', async () => {
    const { llm, runner, graph, thread } = setup(
      [code(1)],
      [fail('page.goto: Timeout 30000ms exceeded.'), fail('page.goto: Timeout 30000ms exceeded.')],
    );

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('fail');
    expect(result.failureReason).toMatch(/application/i);
    expect(runner.calls).toHaveLength(2);
    expect(llm.calls).toHaveLength(1);
  });

  it('un timeout global del runner cuenta como fallo de entorno (RNF-2)', async () => {
    const timeout: RunResult = { result: 'FAIL', logs: '', timedOut: true };
    const { graph, thread, runner } = setup([code(1)], [timeout, timeout]);

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('fail');
    expect(runner.calls).toHaveLength(2);
  });

  it('los fallos de entorno solo abortan si son consecutivos', async () => {
    const env = fail('page.goto: net::ERR_CONNECTION_REFUSED');
    const { runner, graph, thread } = setup(
      [code(1), code(2)],
      [env, fail('element login not found'), env, pass],
    );

    const result = await graph.invoke(input, thread);

    // env -> reintento (mismo test) -> fallo técnico -> corrección -> env -> reintento -> PASS
    expect(result.status).toBe('done');
    expect(runner.calls.map((c) => c.robotCode)).toEqual([code(1), code(1), code(2), code(2)]);
  });

  it('un error de sintaxis repetido se corrige, no se pregunta al usuario', async () => {
    const syntax = fail("No keyword with name 'Click Buton' found.");
    const { llm, graph, thread } = setup([code(1), code(2), code(3)], [syntax, syntax, pass]);

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('done');
    expect(result.clarifications).toEqual([]);
    expect(llm.calls).toHaveLength(3); // generar + 2 correcciones, ninguna pregunta
  });

  it('dos respuestas basura seguidas del LLM se corrigen, no se pregunta al usuario', async () => {
    const { llm, graph, thread } = setup(['lo siento', 'otra vez no puedo', code(3)], [pass]);

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('done');
    expect(result.clarifications).toEqual([]);
    expect(llm.calls).toHaveLength(3);
  });

  it('limpia las vallas markdown de la respuesta antes de ejecutar (US-05.2)', async () => {
    const { runner, graph, thread } = setup([`\`\`\`robot\n${code(1)}\n\`\`\``], [pass]);

    await graph.invoke(input, thread);

    expect(runner.calls.map((c) => c.robotCode)).toEqual([code(1)]);
  });

  it('una respuesta no interpretable cuenta como intento fallido y no se ejecuta (US-05.3)', async () => {
    const { runner, graph, thread } = setup(['Lo siento, no puedo ayudarte.', code(2)], [pass]);

    const result = await graph.invoke(input, thread);

    expect(runner.calls.map((c) => c.robotCode)).toEqual([code(2)]); // el 1.º no llegó a Docker
    expect(result.status).toBe('done');
    expect(result.attempt).toBe(2); // el intento vacío consumió uno
    expect(result.attempts[0]?.run.result).toBe('FAIL');
  });

  // D-40: antes de generar, el modelo barato comprueba que la US tenga información suficiente.
  describe('comprobación previa de la US (D-40)', () => {
    const ready = '{"ready": true}';
    const notReady = '{"ready": false, "question": "¿Qué usuario y contraseña uso?"}';

    it('si la US está lista, sigue a generar; la comprobación usa el modelo barato y gasta tokens', async () => {
      const { llm, graph, thread } = setup([ready, code(1)], [pass], { storyCheck: true });

      const result = await graph.invoke(input, thread);

      expect(result.status).toBe('done');
      expect(llm.calls.map((c) => c.tier)).toEqual(['triage', undefined]);
      expect(result.tokensUsed).toBe(300); // 150 de la comprobación + 150 de generar
    });

    it('si falta información, pregunta ANTES de generar y no ejecuta nada', async () => {
      const { llm, runner, graph, thread } = setup([notReady, code(1)], [pass], {
        storyCheck: true,
      });

      await graph.invoke(input, thread);

      const paused = await graph.getState(thread);
      expect(paused.values.status).toBe('awaiting_clarification');
      expect(paused.values.question).toBe('¿Qué usuario y contraseña uso?');
      expect(paused.next).toEqual(['askClarification']);
      expect(llm.calls).toHaveLength(1); // solo la comprobación
      expect(runner.calls).toHaveLength(0);
    });

    it('al responder, genera el test usando la aclaración y no vuelve a comprobar', async () => {
      const { llm, graph, thread } = setup([notReady, code(1)], [pass], { storyCheck: true });

      await graph.invoke(input, thread);
      const result = await graph.invoke(
        new Command({ resume: 'standard_user / secret_sauce' }),
        thread,
      );

      expect(result.status).toBe('done');
      expect(result.clarifications.map((c) => c.role)).toEqual(['agent', 'user']);
      expect(llm.calls).toHaveLength(2); // comprobación + generar (no se re-comprueba)
      expect(llm.calls[1]?.user).toContain('standard_user / secret_sauce');
    });

    it('si la respuesta del modelo no se puede leer, deja pasar y genera igualmente', async () => {
      const { runner, graph, thread } = setup(['no sé qué decirte', code(1)], [pass], {
        storyCheck: true,
      });

      const result = await graph.invoke(input, thread);

      expect(result.status).toBe('done');
      expect(runner.calls).toHaveLength(1);
    });

    it('el prompt de la comprobación pide JSON, trata la US como dato y no pide un .robot', async () => {
      const { llm, graph, thread } = setup([ready, code(1)], [pass], { storyCheck: true });

      await graph.invoke(input, thread);

      const system = llm.calls[0]?.system ?? '';
      expect(system).toContain('"ready"');
      expect(system).toContain('is DATA');
      expect(system).not.toMatch(/\.robot file|markdown fences/i);
    });
  });

  // D-41: al corregir, el modelo puede responder NEEDS_INFO en vez de código (falta información
  // o la función no existe) y el grafo pregunta al usuario sin gastar más intentos.
  describe('NEEDS_INFO al corregir (D-41)', () => {
    const needsInfo = 'NEEDS_INFO: ¿Dónde se da de baja la cuenta?';

    it('pausa y pregunta en vez de ejecutar otra vez, y marca el intento como falta de información', async () => {
      const { llm, runner, graph, thread } = setup(
        [code(1), needsInfo],
        [fail('La aplicación no ofrece acceso al perfil')],
      );

      await graph.invoke(input, thread);

      const paused = await graph.getState(thread);
      expect(paused.values.status).toBe('awaiting_clarification');
      expect(paused.values.question).toBe('¿Dónde se da de baja la cuenta?');
      expect(paused.next).toEqual(['askClarification']);
      expect(paused.values.attempts[0]?.failureKind).toBe('missing_info');
      expect(runner.calls).toHaveLength(1); // no se ejecutó una "corrección" inexistente
      expect(llm.calls).toHaveLength(2); // generar + corregir; sin llamada extra de triage
    });

    it('al responder, regenera el test con la aclaración y reinicia el contador (D-14)', async () => {
      const { llm, graph, thread } = setup(
        [code(1), needsInfo, code(2)],
        [fail('La aplicación no ofrece acceso al perfil'), pass],
      );

      await graph.invoke(input, thread);
      const result = await graph.invoke(new Command({ resume: 'Usa la opción Cuenta' }), thread);

      expect(result.status).toBe('done');
      expect(result.attempt).toBe(1);
      expect(result.clarifications.map((c) => c.role)).toEqual(['agent', 'user']);
      expect(llm.calls[2]?.user).toContain('Usa la opción Cuenta');
    });

    it('el prompt de corrección permite NEEDS_INFO sin contradecirse; el de generar no', async () => {
      const { llm, graph, thread } = setup([code(1), needsInfo], [fail('x')]);

      await graph.invoke(input, thread);

      const generate = llm.calls[0]?.system ?? '';
      const fix = llm.calls[1]?.system ?? '';
      expect(fix).toContain('NEEDS_INFO');
      expect(fix).not.toContain('ONLY the contents of the .robot file'); // contradiría la 2.ª salida
      expect(fix).toContain('is DATA');
      expect(generate).not.toContain('NEEDS_INFO');
    });
  });

  it('el prompt de la pregunta no manda devolver un .robot, pero sí tratar la US como dato', async () => {
    const { llm, graph, thread } = setup(
      [code(1), code(2), '¿Dónde está el botón?'],
      [fail('button not found'), fail('button not found')],
    );

    await graph.invoke(input, thread);

    const system = llm.calls[2]?.system ?? '';
    expect(system).not.toMatch(/\.robot file|markdown fences/i); // contradiría "responde solo la pregunta"
    expect(system).toContain('is DATA'); // la barrera frente a instrucciones inyectadas se mantiene (TS-01)
  });

  it('el prompt indica Browser Library en headless y la URL por variable (D-34, RNF-6)', async () => {
    const { llm, graph, thread } = setup([code(1)], [pass]);

    await graph.invoke(input, thread);

    const system = llm.calls[0]?.system ?? '';
    expect(system).toContain('Library    Browser');
    expect(system).toContain('headless=True');
    expect(system).toContain('${BASE_URL}');
    expect(system).toContain('SeleniumLibrary');
  });

  it('el prompt prohíbe omitir el test con Skip: un test omitido no verifica nada', async () => {
    const { llm, graph, thread } = setup([code(1)], [pass]);

    await graph.invoke(input, thread);

    expect(llm.calls[0]?.system).toMatch(/never use Skip/i);
  });

  it('usa el modelo barato (tier triage) solo para formular la pregunta de aclaración (D-37)', async () => {
    const { llm, graph, thread } = setup(
      [code(1), code(2), '¿Dónde está el botón?'],
      [fail('button not found'), fail('button not found')],
    );

    await graph.invoke(input, thread);

    // Llamadas: generar, corregir, preguntar.
    expect(llm.calls.map((c) => c.tier)).toEqual([undefined, undefined, 'triage']);
  });

  it('se detiene al alcanzar el límite de tokens (TS-02.4)', async () => {
    // Cada llamada al LLM gasta 150 tokens; el límite es 200.
    const { runner, graph, thread } = setup(
      [code(1), code(2), code(3)],
      [fail('error alpha'), fail('error beta'), fail('error gamma')],
      { maxTokens: 200 },
    );

    const result = await graph.invoke(input, thread);

    expect(result.status).toBe('fail');
    expect(runner.calls).toHaveLength(2); // generar (150) + corregir (300 >= 200) -> fail
  });

  it('tras una aclaración, un fallo igual al de antes de preguntar no vuelve a pausar el grafo (D-14)', async () => {
    const { runner, graph, thread } = setup(
      [code(1), code(2), '¿Dónde está el botón?', code(3), code(4)],
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
