import { describe, expect, it } from 'vitest';
import { APIConnectionError, AuthenticationError, RateLimitError } from 'openai';
import { LlmError, OpenAiLlm } from './openai-llm.js';

describe('OpenAiLlm', () => {
  it('traduce la petición a la Responses API', async () => {
    // 1. PREPARAR: la libreta y el "OpenAI de mentira"
    const calls: unknown[] = [];
    const fakeClient = {
      responses: {
        async create(params: unknown) {
          calls.push(params); // apunta en la libreta lo que le llega
          return { output_text: 'ok' }; // y responde algo cualquiera
        },
      },
    };
    const models = { generate: 'model-generate', triage: 'model-triage' };

    // 2. ACTUAR: el adaptador cree que habla con OpenAI de verdad
    await new OpenAiLlm(fakeClient, models).generate({ system: 'be brief', user: 'write a test' });

    // 3. COMPROBAR: ¿llamó con los datos bien traducidos?
    expect(calls[0]).toEqual({
      model: 'model-generate',
      instructions: 'be brief',
      input: 'write a test',
      store: false,
    });
  });

  it('usa el modelo barato cuando la tarea es de triaje', async () => {
    const calls: { model: string }[] = [];
    const fakeClient = {
      responses: {
        async create(params: { model: string }) {
          calls.push(params);
          return { output_text: 'ok' };
        },
      },
    };
    const models = { generate: 'model-generate', triage: 'model-triage' };

    await new OpenAiLlm(fakeClient, models).generate({
      system: 'be brief',
      user: 'write a test',
      tier: 'triage',
    });

    expect(calls[0]?.model).toBe('model-triage');
  });
  it('devuelve el texto y los tokens consumidos (US-05.6)', async () => {
    const fakeClient = {
      responses: {
        async create() {
          return {
            output_text: '*** Test Cases ***',
            usage: { input_tokens: 120, output_tokens: 30 },
          };
        },
      },
    };
    const models = { generate: 'model-generate', triage: 'model-triage' };

    const response = await new OpenAiLlm(fakeClient, models).generate({
      system: 'be brief',
      user: 'write a test',
    });

    expect(response).toEqual({ text: '*** Test Cases ***', tokensIn: 120, tokensOut: 30 });
  });

  it('clave inválida: lanza un LlmError auth sin filtrar la clave (US-05.4)', async () => {
    const apiError = new AuthenticationError(
      401,
      undefined,
      'Incorrect API key sk-secret',
      new Headers(),
    );
    const fakeClient = {
      responses: {
        async create() {
          throw apiError; // el OpenAI de mentira falla
        },
      },
    };
    const models = { generate: 'model-generate', triage: 'model-triage' };

    const promise = new OpenAiLlm(fakeClient, models).generate({
      system: 'be brief',
      user: 'write a test',
    });

    await expect(promise).rejects.toBeInstanceOf(LlmError);
    await expect(promise).rejects.toMatchObject({ kind: 'auth' });
    await expect(promise).rejects.toThrow('OpenAI rejected the API key');
  });
  it.each([
    {
      name: 'sin crédito',
      error: new RateLimitError(429, { code: 'insufficient_quota' }, 'quota', new Headers()),
      kind: 'quota',
    },
    {
      name: 'límite de peticiones',
      error: new RateLimitError(429, { code: 'rate_limit_exceeded' }, 'slow down', new Headers()),
      kind: 'rate_limit',
    },
    {
      name: 'sin conexión',
      error: new APIConnectionError({ message: 'socket hang up' }),
      kind: 'network',
    },
    { name: 'fallo desconocido', error: new Error('boom'), kind: 'unknown' },
  ])('$name -> LlmError de tipo $kind (US-05.4)', async ({ error, kind }) => {
    const fakeClient = {
      responses: {
        async create() {
          throw error;
        },
      },
    };
    const models = { generate: 'model-generate', triage: 'model-triage' };

    const promise = new OpenAiLlm(fakeClient, models).generate({
      system: 'be brief',
      user: 'write a test',
    });

    await expect(promise).rejects.toMatchObject({ kind });
  });
});
