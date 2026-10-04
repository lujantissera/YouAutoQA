import { interrupt } from '@langchain/langgraph';
import type { AgentConfig } from './config.js';
import { isRepeatedError } from './failure.js';
import type { LlmPort, LlmResponse, RunnerPort } from './ports.js';
import { buildFixRequest, buildGenerateRequest, buildQuestionRequest } from './prompts.js';
import type { AgentStateType } from './state.js';

// Dependencias que el grafo necesita del exterior: siempre puertos, nunca OpenAI/Docker directos.
export interface AgentDeps {
  llm: LlmPort;
  runner: RunnerPort;
  config: AgentConfig;
}

type StateUpdate = Partial<AgentStateType>;

const tokensOf = (response: LlmResponse): number => response.tokensIn + response.tokensOut;

// Un nodo es una función (estado) -> cambios. Se crean con una "factory" para inyectar las dependencias.
export function createNodes({ llm, runner, config }: AgentDeps) {
  return {
    async generateTest(state: AgentStateType): Promise<StateUpdate> {
      const response = await llm.generate(buildGenerateRequest(state));
      return { robotCode: response.text, tokensUsed: tokensOf(response), status: 'generating' };
    },

    async runTest(state: AgentStateType): Promise<StateUpdate> {
      const attempt = state.attempt + 1;
      const run = await runner.run(state.robotCode, config.executionTimeoutSeconds);
      const record = {
        id: state.attempts.length + 1,
        attempt,
        robotCode: state.robotCode,
        run,
        failureKind: null,
      };
      return { attempt, lastRun: run, status: 'running', attempts: [record] };
    },

    async classifyFailure(state: AgentStateType): Promise<StateUpdate> {
      const current = state.attempts.at(-1);
      if (!current) throw new Error('classifyFailure called without any recorded attempt');

      // Solo se compara con el intento inmediatamente anterior DEL MISMO CICLO: tras una
      // aclaración el contador vuelve a 0 y el fallo previo ya no cuenta (D-14).
      const previous = state.attempts.at(-2);
      const comparable = previous !== undefined && previous.attempt === current.attempt - 1;
      const repeated = comparable && isRepeatedError(previous.run.logs, current.run.logs);

      if (!repeated) {
        return { failureKind: 'technical', attempts: [{ ...current, failureKind: 'technical' }] };
      }

      // Falta información: el LLM formula la pregunta concreta (US-10.4).
      const response = await llm.generate(buildQuestionRequest(state));
      return {
        failureKind: 'missing_info',
        question: response.text,
        tokensUsed: tokensOf(response),
        status: 'awaiting_clarification',
        attempts: [{ ...current, failureKind: 'missing_info' }],
      };
    },

    async fixTest(state: AgentStateType): Promise<StateUpdate> {
      const response = await llm.generate(buildFixRequest(state));
      return { robotCode: response.text, tokensUsed: tokensOf(response), status: 'running' };
    },

    // `interrupt` congela el grafo aquí y devuelve la pregunta a quien lo invocó. Al reanudar con
    // Command({ resume }) el nodo se ejecuta DE NUEVO desde el principio y `interrupt` devuelve la
    // respuesta. Por eso antes del interrupt no debe haber efectos secundarios.
    askClarification(state: AgentStateType): StateUpdate {
      const answer: unknown = interrupt({ question: state.question });
      if (typeof answer !== 'string') throw new Error('Clarification answer must be a string');
      return {
        clarifications: [
          { role: 'agent', message: state.question ?? '' },
          { role: 'user', message: answer },
        ],
        attempt: 0, // D-14: el contador se reinicia
        failureKind: null,
        question: null,
        status: 'generating',
      };
    },

    markDone: (): StateUpdate => ({ status: 'done' }),
    markFailed: (): StateUpdate => ({ status: 'fail' }),
  };
}
