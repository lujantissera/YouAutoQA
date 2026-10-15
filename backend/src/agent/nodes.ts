import { interrupt } from '@langchain/langgraph';
import type { AgentConfig } from './config.js';
import { isCodeError, isEnvironmentFailure, isRepeatedError } from './failure.js';
import { parseCannotTest } from './cannot-test.js';
import { parseNeedsInfo } from './needs-info.js';
import type { LlmPort, LlmResponse, RunnerPort, RunResult } from './ports.js';
import {
  buildFixRequest,
  buildGenerateRequest,
  buildQuestionRequest,
  buildStoryCheckRequest,
} from './prompts.js';
import { EMPTY_TEST_LOGS, extractRobotCode } from './robot-code.js';
import type { AgentStateType } from './state.js';
import { parseStoryCheck } from './story-check.js';

// Dependencias que el grafo necesita del exterior: siempre puertos, nunca OpenAI/Docker directos.
export interface AgentDeps {
  llm: LlmPort;
  runner: RunnerPort;
  config: AgentConfig;
}

type StateUpdate = Partial<AgentStateType>;

const EMPTY_TEST_RESULT: RunResult = { result: 'FAIL', logs: EMPTY_TEST_LOGS, timedOut: false };

const ENVIRONMENT_ABORT_REASON =
  'The application under test could not be reached, or the test runner was unavailable, in two consecutive runs.';

const CLARIFICATION_LIMIT_REASON =
  'The agent still needed information after the maximum number of clarification rounds.';

const tokensOf = (response: LlmResponse): number => response.tokensIn + response.tokensOut;

// Un nodo es una función (estado) -> cambios. Se crean con una "factory" para inyectar las dependencias.
export function createNodes({ llm, runner, config }: AgentDeps) {
  return {
    // D-40: antes de gastar intentos, el modelo barato comprueba que la US tenga información
    // suficiente. Si no, deja una pregunta en el estado y el grafo pausa en `askClarification`.
    async checkStory(state: AgentStateType): Promise<StateUpdate> {
      if (!config.storyCheck) return {};
      const response = await llm.generate(buildStoryCheckRequest(state));
      const check = parseStoryCheck(response.text);
      if (check.ready) return { tokensUsed: tokensOf(response) };
      return {
        question: check.question,
        tokensUsed: tokensOf(response),
        status: 'awaiting_clarification',
      };
    },

    async generateTest(state: AgentStateType): Promise<StateUpdate> {
      const response = await llm.generate(buildGenerateRequest(state));
      return {
        robotCode: extractRobotCode(response.text) ?? '',
        tokensUsed: tokensOf(response),
        status: 'generating',
      };
    },

    async runTest(state: AgentStateType): Promise<StateUpdate> {
      const attempt = state.attempt + 1;
      // US-05.3: si el LLM no devolvió un test interpretable (robotCode vacío), el intento
      // falla sin gastar un contenedor de Docker, y el ciclo de corrección sigue como siempre.
      const run =
        state.robotCode === ''
          ? EMPTY_TEST_RESULT
          : await runner.run(state.robotCode, config.executionTimeoutSeconds);
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

      // 1.º filtro: fallo de entorno. Sin LLM y sin preguntar. El primero se reintenta;
      // si el intento anterior (mismo ciclo) también fue de entorno, se aborta con motivo.
      if (isEnvironmentFailure(current.run)) {
        const persistent = comparable && previous.failureKind === 'environment';
        return {
          failureKind: 'environment',
          failureReason: persistent ? ENVIRONMENT_ABORT_REASON : null,
          attempts: [{ ...current, failureKind: 'environment' }],
        };
      }

      // 2.º filtro: "mismo error" solo cuenta como falta de información si NO es un error de
      // código (sintaxis, keyword inexistente, respuesta vacía): esos los corrige el LLM.
      const repeated =
        comparable &&
        !isCodeError(current.run.logs) &&
        isRepeatedError(previous.run.logs, current.run.logs);

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
      const current = state.attempts.at(-1);
      if (!current) throw new Error('fixTest called without any recorded attempt');
      const response = await llm.generate(buildFixRequest(state));

      // D-42: CANNOT_TEST = la US no se puede cumplir en esta app. Solo cierra el job si el usuario
      // ya contestó alguna aclaración: antes de eso aún hay que darle la oportunidad de explicarse.
      const cannotTest = parseCannotTest(response.text);
      if (cannotTest !== null && state.clarifications.some((c) => c.role === 'user')) {
        return {
          failureKind: 'cannot_test',
          failureReason: cannotTest,
          tokensUsed: tokensOf(response),
          attempts: [{ ...current, failureKind: 'cannot_test' }],
        };
      }

      // D-41: el modelo puede pedir información en vez de devolver código. No hay nada que
      // ejecutar: el intento que falló pasa a `missing_info` y el grafo pausa para preguntar.
      // Un CANNOT_TEST prematuro cae aquí también: su motivo se le muestra al usuario como pregunta.
      const question = parseNeedsInfo(response.text) ?? cannotTest;
      if (question !== null) {
        return {
          failureKind: 'missing_info',
          question,
          tokensUsed: tokensOf(response),
          status: 'awaiting_clarification',
          attempts: [{ ...current, failureKind: 'missing_info' }],
        };
      }

      return {
        robotCode: extractRobotCode(response.text) ?? '',
        tokensUsed: tokensOf(response),
        status: 'running',
      };
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
    // Si queda una pregunta pendiente que no se pudo hacer, la causa es el límite de rondas (D-42).
    // Los demás motivos (entorno, CANNOT_TEST) ya llegan en `failureReason`.
    markFailed: (state: AgentStateType): StateUpdate => ({
      status: 'fail',
      failureReason:
        state.failureReason ?? (state.question !== null ? CLARIFICATION_LIMIT_REASON : null),
      question: null,
    }),
  };
}
