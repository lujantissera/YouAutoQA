// Puertos (D-30): lo único que el grafo conoce del mundo exterior.
// OpenAI y Docker serán adaptadores que implementan estas interfaces;
// en los tests se sustituyen por dobles (FakeLlm, FakeRunner).

export interface LlmRequest {
  system: string;
  user: string;
}

export interface LlmResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export interface LlmPort {
  generate(request: LlmRequest): Promise<LlmResponse>;
}

export interface RunResult {
  result: 'PASS' | 'FAIL';
  logs: string;
  timedOut: boolean;
}

export interface RunnerPort {
  run(robotCode: string, timeoutSeconds: number): Promise<RunResult>;
}
