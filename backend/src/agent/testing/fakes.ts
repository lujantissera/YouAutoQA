import type { LlmPort, LlmRequest, LlmResponse, RunnerPort, RunResult } from '../ports.js';

// Dobles de prueba (D-30): implementan los puertos con respuestas guionizadas,
// sin llamar a OpenAI ni a Docker. Además apuntan cada llamada para poder
// comprobar "cuántas veces se llamó".

export class FakeLlm implements LlmPort {
  readonly calls: LlmRequest[] = [];
  private index = 0;

  constructor(
    private readonly texts: string[],
    private readonly tokens = { tokensIn: 100, tokensOut: 50 },
  ) {}

  async generate(request: LlmRequest): Promise<LlmResponse> {
    this.calls.push(request);
    const text = this.texts[this.index++];
    if (text === undefined) throw new Error('FakeLlm: no scripted responses left');
    return { text, ...this.tokens };
  }
}

export class FakeRunner implements RunnerPort {
  readonly calls: { robotCode: string; timeoutSeconds: number }[] = [];
  private index = 0;

  constructor(private readonly results: RunResult[]) {}

  async run(robotCode: string, timeoutSeconds: number): Promise<RunResult> {
    this.calls.push({ robotCode, timeoutSeconds });
    const result = this.results[this.index++];
    if (result === undefined) throw new Error('FakeRunner: no scripted results left');
    return result;
  }
}
