import OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { loadOpenAiConfig } from '../../src/llm/config.js';
import { OpenAiLlm } from '../../src/llm/openai-llm.js';

// Test de humo con OpenAI de verdad: cuesta céntimos y necesita OPENAI_API_KEY en el .env de la raíz.
// El .env está fuera de backend/, así que lo cargamos a mano (si no existe, usamos el entorno tal cual).
try {
  process.loadEnvFile('../.env');
} catch {
  // sin .env: puede que las variables ya vengan del entorno
}

const config = loadOpenAiConfig(process.env);
const llm = new OpenAiLlm(new OpenAI({ apiKey: config.apiKey }), config.models);

const request = {
  system: 'You write Robot Framework tests. Reply with ONLY the contents of the .robot file.',
  user: 'Write a minimal test case called "Hello" that logs the word hi. Use no libraries.',
};

describe('OpenAiLlm (OpenAI real)', () => {
  it('genera texto y devuelve los tokens consumidos con el modelo grande', async () => {
    const response = await llm.generate(request);

    // Mostramos la respuesta cruda para ver cómo "viste" el código el modelo (vallas, texto extra...).
    process.stdout.write(`\n--- RAW RESPONSE ---\n${response.text}\n--- END ---\n`);

    expect(response.text.length).toBeGreaterThan(0);
    expect(response.tokensIn).toBeGreaterThan(0);
    expect(response.tokensOut).toBeGreaterThan(0);
  }, 60_000);

  it('también responde con el modelo barato (tier triage)', async () => {
    const response = await llm.generate({ ...request, tier: 'triage' });

    expect(response.text.length).toBeGreaterThan(0);
  }, 60_000);
});
