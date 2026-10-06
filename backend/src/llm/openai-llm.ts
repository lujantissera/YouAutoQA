import { APIConnectionError, AuthenticationError, RateLimitError } from 'openai';
import type { LlmPort, LlmRequest, LlmResponse } from '../agent/ports.js';

export type LlmErrorKind = 'auth' | 'quota' | 'rate_limit' | 'network' | 'unknown';

// Error propio: el resto del sistema no necesita conocer las clases de error de OpenAI.
export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'LlmError';
  }
}

// Lo mínimo que necesitamos del cliente de OpenAI: un objeto con `responses.create(...)`.
export interface ResponsesClient {
  responses: {
    create(params: {
      model: string;
      instructions: string;
      input: string;
      store: boolean;
    }): Promise<{
      output_text: string;
      usage?: { input_tokens: number; output_tokens: number } | undefined;
    }>;
  };
}

export interface OpenAiModels {
  generate: string;
  triage: string;
}

// Traduce el error de OpenAI a uno nuestro. Los mensajes son siempre nuestros y limpios:
// nunca incluyen la clave ni el contenido de la petición. El error original va en `cause`.
function toLlmError(error: unknown): LlmError {
  if (error instanceof AuthenticationError) {
    return new LlmError('auth', 'OpenAI rejected the API key', { cause: error });
  }
  if (error instanceof RateLimitError) {
    return error.code === 'insufficient_quota'
      ? new LlmError('quota', 'OpenAI credit exhausted', { cause: error })
      : new LlmError('rate_limit', 'OpenAI rate limit reached', { cause: error });
  }
  if (error instanceof APIConnectionError) {
    return new LlmError('network', 'Could not reach OpenAI', { cause: error });
  }
  return new LlmError('unknown', 'OpenAI request failed', { cause: error });
}

export class OpenAiLlm implements LlmPort {
  constructor(
    private readonly client: ResponsesClient,
    private readonly models: OpenAiModels,
  ) {}

  async generate(request: LlmRequest): Promise<LlmResponse> {
    try {
      const response = await this.client.responses.create({
        model: request.tier === 'triage' ? this.models.triage : this.models.generate,
        instructions: request.system,
        input: request.user,
        store: false,
      });
      return {
        text: response.output_text,
        tokensIn: response.usage?.input_tokens ?? 0,
        tokensOut: response.usage?.output_tokens ?? 0,
      };
    } catch (error) {
      throw toLlmError(error);
    }
  }
}
