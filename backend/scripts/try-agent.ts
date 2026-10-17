// Paso 4 de la Fase 1: conecta las piezas REALES (OpenAI + Docker) al grafo y lo prueba con una US.
// No es un test: la respuesta del LLM cambia en cada ejecución y cuesta dinero (céntimos).
// Uso (desde backend/): npm run try-agent -- <pass|fix|ambiguous>
import { Command } from '@langchain/langgraph';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import OpenAI from 'openai';
import { buildGraph } from '../src/agent/graph.js';
import { loadOpenAiConfig } from '../src/llm/config.js';
import { OpenAiLlm } from '../src/llm/openai-llm.js';
import type { AttemptRecord } from '../src/agent/state.js';
import { DockerRunner } from '../src/runner/docker-runner.js';
import { loadRunnerConfig } from '../src/runner/config.js';

// El .env está en la raíz del repo, fuera de backend/.
try {
  process.loadEnvFile('../.env');
} catch {
  // sin .env: puede que las variables ya vengan del entorno
}

// Las 3 US de ejemplo contra https://www.saucedemo.com (tienda de demo; credenciales públicas).
const SCENARIOS: Record<string, string> = {
  // Debería pasar a la primera.
  pass: [
    'Como usuario registrado quiero iniciar sesión con el usuario standard_user y la contraseña',
    'secret_sauce para acceder al catálogo. Criterio de aceptación: tras el login se muestra la',
    'página de productos con el título "Products".',
  ].join(' '),
  // Más pasos y selectores: es probable que necesite alguna corrección.
  fix: [
    'Como cliente quiero añadir la mochila "Sauce Labs Backpack" al carrito para comprarla.',
    'Inicio sesión con standard_user / secret_sauce. Criterio de aceptación: tras añadirla, el',
    'icono del carrito muestra el número 1 y al abrir el carrito aparece la mochila.',
  ].join(' '),
  // Pide algo que la web no tiene: debería acabar preguntando al usuario.
  ambiguous:
    'Como cliente quiero dar de baja mi cuenta desde mi perfil para dejar de usar el servicio.',
};

const print = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

const numberFromEnv = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

// Robot imprime mucho: del log de un fallo solo enseñamos desde la primera línea "| FAIL |".
const failureExcerpt = (logs: string): string => {
  const index = logs.indexOf('| FAIL |');
  return logs.slice(index >= 0 ? index : 0, (index >= 0 ? index : 0) + 800);
};

function printAttempts(attempts: AttemptRecord[]): void {
  for (const attempt of attempts) {
    const kind = attempt.failureKind ? ` [${attempt.failureKind}]` : '';
    print(`Ejecucion #${attempt.id} (intento ${attempt.attempt}): ${attempt.run.result}${kind}`);
    if (attempt.run.result === 'FAIL') print(failureExcerpt(attempt.run.logs));
  }
}

async function main(): Promise<void> {
  const scenario = process.argv[2] ?? '';
  const usText = SCENARIOS[scenario];
  if (!usText) {
    print(`Uso: npm run try-agent -- <${Object.keys(SCENARIOS).join('|')}>`);
    process.exitCode = 1;
    return;
  }

  const openAi = loadOpenAiConfig(process.env);
  const graph = buildGraph({
    llm: new OpenAiLlm(new OpenAI({ apiKey: openAi.apiKey }), openAi.models),
    runner: new DockerRunner(loadRunnerConfig(process.env)),
    config: {
      maxAttempts: numberFromEnv('MAX_ATTEMPTS', 5),
      maxTokens: numberFromEnv('MAX_TOKENS', 50_000),
      maxClarifications: numberFromEnv('MAX_CLARIFICATIONS', 3),
      executionTimeoutSeconds: numberFromEnv('EXECUTION_TIMEOUT_SECONDS', 120),
      storyCheck: process.env.STORY_CHECK !== 'false', // activado salvo STORY_CHECK=false
    },
  });
  const thread = { configurable: { thread_id: randomUUID() } };
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // Avanza el grafo hasta que termina o se pausa; si pide aclaración, pregunta y reanuda.
  async function drive(input: { usText: string } | Command): Promise<void> {
    const stream = await graph.stream(input, { ...thread, streamMode: 'updates' });
    for await (const update of stream) print(`  -> ${Object.keys(update).join(', ')}`);

    const state = await graph.getState(thread);
    if (state.next.includes('askClarification')) {
      // Antes de preguntar enseñamos qué pasó: si no, no se puede juzgar si la pregunta tiene sentido.
      if (state.values.attempts.length > 0) {
        print('\n----- Intentos hasta ahora -----');
        printAttempts(state.values.attempts);
      }
      print(`\nEl agente pregunta: ${state.values.question}`);
      const answer = await rl.question('Tu respuesta: ');
      await drive(new Command({ resume: answer }));
    }
  }

  try {
    print(`US (${scenario}): ${usText}\n`);
    await drive({ usText });

    const { attempts, status, tokensUsed, failureReason } = (await graph.getState(thread)).values;
    print('\n===== RESUMEN =====');
    printAttempts(attempts);
    print(`\nEstado final: ${status} | tokens: ${tokensUsed}`);
    if (failureReason) print(`Motivo: ${failureReason}`);
    print(`\n--- Ultimo .robot generado ---\n${attempts.at(-1)?.robotCode ?? '(ninguno)'}`);
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
