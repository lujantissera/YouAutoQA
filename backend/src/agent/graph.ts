import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { createNodes, type AgentDeps } from './nodes.js';
import {
  routeAfterClassify,
  routeAfterFix,
  routeAfterRun,
  routeAfterStoryCheck,
} from './routing.js';
import { AgentState } from './state.js';

// Aquí se "dibuja" el diagrama: nodos (cajas) + aristas (flechas) + aristas condicionales (rombos).
export function buildGraph(deps: AgentDeps) {
  const nodes = createNodes(deps);

  return (
    new StateGraph(AgentState)
      .addNode('checkStory', nodes.checkStory)
      .addNode('generateTest', nodes.generateTest)
      .addNode('runTest', nodes.runTest)
      .addNode('classifyFailure', nodes.classifyFailure)
      .addNode('fixTest', nodes.fixTest)
      .addNode('askClarification', nodes.askClarification)
      .addNode('markDone', nodes.markDone)
      .addNode('markFailed', nodes.markFailed)
      .addEdge(START, 'checkStory')
      // Rombo 0 (D-40): ¿tiene la US información suficiente? Si no, se pregunta antes de generar.
      .addConditionalEdges('checkStory', (state) => routeAfterStoryCheck(state, deps.config), {
        generate: 'generateTest',
        ask: 'askClarification',
        abort: 'markFailed', // se agotaron las preguntas (D-42)
      })
      .addEdge('generateTest', 'runTest')
      // Rombo 1: la función decide y el mapa traduce su respuesta al nombre del nodo destino.
      .addConditionalEdges('runTest', (state) => routeAfterRun(state, deps.config), {
        done: 'markDone',
        fail: 'markFailed',
        classify: 'classifyFailure',
      })
      // Rombo 2. `retry` vuelve a ejecutar el mismo test sin pasar por el LLM (fallo de entorno).
      .addConditionalEdges('classifyFailure', (state) => routeAfterClassify(state, deps.config), {
        fix: 'fixTest',
        ask: 'askClarification',
        retry: 'runTest',
        abort: 'markFailed',
      })
      // Rombo 3 (D-41, D-42): ¿el modelo corrigió el test, pidió información o declaró CANNOT_TEST?
      .addConditionalEdges('fixTest', (state) => routeAfterFix(state, deps.config), {
        run: 'runTest',
        ask: 'askClarification',
        abort: 'markFailed',
      })
      .addEdge('askClarification', 'generateTest')
      .addEdge('markDone', END)
      .addEdge('markFailed', END)
      // El checkpointer guarda el estado por hilo (job). Imprescindible para `interrupt`.
      // En la Fase 3 pasará a Postgres (D-32).
      .compile({ checkpointer: new MemorySaver() })
  );
}
