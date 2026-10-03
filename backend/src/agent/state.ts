import { Annotation } from '@langchain/langgraph';
import type { RunResult } from './ports.js';

export type JobStatus = 'generating' | 'running' | 'done' | 'fail' | 'awaiting_clarification';
export type FailureKind = 'technical' | 'missing_info';

export interface Clarification {
  role: 'agent' | 'user';
  message: string;
}

export interface AttemptRecord {
  attempt: number;
  robotCode: string;
  run: RunResult;
  failureKind: FailureKind | null;
}

// Reducers: definen qué pasa cuando un nodo devuelve un valor para un campo.
// - concat: acumula (historiales).
// - overwrite: el último valor gana (es el comportamiento por defecto de LangGraph).
// - sum: suma (tokens).
const concat = <T>(left: T[], right: T[]): T[] => left.concat(right);
const overwrite = <T>(_left: T, right: T): T => right;
const sum = (left: number, right: number): number => left + right;

// El "maletín" que viaja entre nodos. Cada nodo devuelve solo los campos que cambia.
export const AgentState = Annotation.Root({
  usText: Annotation<string>({ reducer: overwrite, default: () => '' }),
  clarifications: Annotation<Clarification[]>({ reducer: concat, default: () => [] }),
  robotCode: Annotation<string>({ reducer: overwrite, default: () => '' }),
  // Se reinicia a 0 tras una aclaración del usuario (D-14).
  attempt: Annotation<number>({ reducer: overwrite, default: () => 0 }),
  lastRun: Annotation<RunResult | null>({ reducer: overwrite, default: () => null }),
  attempts: Annotation<AttemptRecord[]>({ reducer: concat, default: () => [] }),
  tokensUsed: Annotation<number>({ reducer: sum, default: () => 0 }),
  failureKind: Annotation<FailureKind | null>({ reducer: overwrite, default: () => null }),
  question: Annotation<string | null>({ reducer: overwrite, default: () => null }),
  status: Annotation<JobStatus>({ reducer: overwrite, default: () => 'generating' }),
});

export type AgentStateType = typeof AgentState.State;
