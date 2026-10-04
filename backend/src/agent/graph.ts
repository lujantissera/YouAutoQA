import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { createNodes, type AgentDeps } from './nodes.js';
import { routeAfterClassify, routeAfterRun } from './routing.js';
import { AgentState } from './state.js';

// Aquí se "dibuja" el diagrama: nodos (cajas) + aristas (flechas) + aristas condicionales (rombos).
export function buildGraph(deps: AgentDeps) {
  const nodes = createNodes(deps);

  return (
    new StateGraph(AgentState)
      .addNode('generateTest', nodes.generateTest)
      .addNode('runTest', nodes.runTest)
      .addNode('classifyFailure', nodes.classifyFailure)
      .addNode('fixTest', nodes.fixTest)
      .addNode('askClarification', nodes.askClarification)
      .addNode('markDone', nodes.markDone)
      .addNode('markFailed', nodes.markFailed)
      .addEdge(START, 'generateTest')
      .addEdge('generateTest', 'runTest')
      // Rombo 1: la función decide y el mapa traduce su respuesta al nombre del nodo destino.
      .addConditionalEdges('runTest', (state) => routeAfterRun(state, deps.config), {
        done: 'markDone',
        fail: 'markFailed',
        classify: 'classifyFailure',
      })
      // Rombo 2.
      .addConditionalEdges('classifyFailure', routeAfterClassify, {
        fix: 'fixTest',
        ask: 'askClarification',
      })
      .addEdge('fixTest', 'runTest')
      .addEdge('askClarification', 'generateTest')
      .addEdge('markDone', END)
      .addEdge('markFailed', END)
      // El checkpointer guarda el estado por hilo (job). Imprescindible para `interrupt`.
      // En la Fase 3 pasará a Postgres (D-32).
      .compile({ checkpointer: new MemorySaver() })
  );
}
