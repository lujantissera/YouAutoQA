import { describe, expect, it } from 'vitest';
import { loadOpenAiConfig } from './config.js';

const validEnv = {
  OPENAI_API_KEY: 'sk-secret-value',
  OPENAI_MODEL_GENERATE: 'model-big',
  OPENAI_MODEL_TRIAGE: 'model-small',
};

describe('loadOpenAiConfig', () => {
  it('lee la clave y los dos modelos del entorno', () => {
    expect(loadOpenAiConfig(validEnv)).toEqual({
      apiKey: 'sk-secret-value',
      models: { generate: 'model-big', triage: 'model-small' },
    });
  });

  it('falla nombrando TODAS las variables que faltan', () => {
    expect(() => loadOpenAiConfig({})).toThrow(
      /OPENAI_API_KEY.*OPENAI_MODEL_GENERATE.*OPENAI_MODEL_TRIAGE/s,
    );
  });

  it('trata una variable vacía o solo con espacios como ausente', () => {
    expect(() => loadOpenAiConfig({ ...validEnv, OPENAI_MODEL_TRIAGE: '   ' })).toThrow(
      /OPENAI_MODEL_TRIAGE/,
    );
  });

  it('el mensaje de error nunca incluye el valor de la clave', () => {
    const env = { OPENAI_API_KEY: 'sk-secret-value' };
    expect(() => loadOpenAiConfig(env)).toThrow(/OPENAI_MODEL_GENERATE/);
    expect(() => loadOpenAiConfig(env)).not.toThrow(/sk-secret-value/);
  });
});
