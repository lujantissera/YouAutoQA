import type { OpenAiModels } from './openai-llm.js';

export interface OpenAiConfig {
  apiKey: string;
  models: OpenAiModels;
}

const REQUIRED = ['OPENAI_API_KEY', 'OPENAI_MODEL_GENERATE', 'OPENAI_MODEL_TRIAGE'] as const;

// Recibe el entorno como parámetro (en producción `process.env`) para poder probarlo
// sin tocar variables globales. Lista todo lo que falta de una vez y nunca imprime valores.
export function loadOpenAiConfig(env: Record<string, string | undefined>): OpenAiConfig {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const generate = env.OPENAI_MODEL_GENERATE?.trim();
  const triage = env.OPENAI_MODEL_TRIAGE?.trim();
  if (!apiKey || !generate || !triage) {
    const missing = REQUIRED.filter((name) => !env[name]?.trim());
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  return { apiKey, models: { generate, triage } };
}
