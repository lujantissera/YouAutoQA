export interface RobotSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

// Robot imprime líneas como "1 test, 1 passed, 0 failed" y añade ", 1 skipped" si hay omitidos.
const SUMMARY_LINE = /(\d+) tests?, (\d+) passed, (\d+) failed(?:, (\d+) skipped)?/g;

// Lee el resumen del log. Si hay varios (uno por suite y uno final) se queda con el último,
// que es el total. Devuelve null si Robot no llegó a imprimir ninguno.
export function parseRobotSummary(logs: string): RobotSummary | null {
  const last = [...logs.matchAll(SUMMARY_LINE)].at(-1);
  if (!last) return null;
  return {
    total: Number(last[1]),
    passed: Number(last[2]),
    failed: Number(last[3]),
    skipped: Number(last[4] ?? 0),
  };
}

// Robot sale con código 0 aunque el test se haya omitido (`Skip`), y un test omitido no ha
// verificado nada. Por eso PASS exige además que el resumen confirme que algo pasó y que
// nada falló ni se omitió. Sin resumen no hay forma de confirmarlo: se trata como fallo.
export function isPassingRun(exitCode: number | null, timedOut: boolean, logs: string): boolean {
  if (exitCode !== 0 || timedOut) return false;
  const summary = parseRobotSummary(logs);
  return summary !== null && summary.passed > 0 && summary.failed === 0 && summary.skipped === 0;
}
