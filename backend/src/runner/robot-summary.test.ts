import { describe, expect, it } from 'vitest';
import { isPassingRun, parseRobotSummary } from './robot-summary.js';

const summaryLine = (counts: string): string =>
  `==============\n${counts}\nOutput:  /work/results/output.xml\n`;

describe('parseRobotSummary', () => {
  it('lee un resumen de un test que pasa', () => {
    expect(parseRobotSummary(summaryLine('1 test, 1 passed, 0 failed'))).toEqual({
      total: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
    });
  });

  it('lee la parte de omitidos (skipped) cuando existe', () => {
    expect(parseRobotSummary(summaryLine('1 test, 0 passed, 0 failed, 1 skipped'))).toEqual({
      total: 1,
      passed: 0,
      failed: 0,
      skipped: 1,
    });
  });

  it('acepta el plural (tests)', () => {
    expect(parseRobotSummary(summaryLine('3 tests, 2 passed, 1 failed'))?.total).toBe(3);
  });

  it('usa el ÚLTIMO resumen, que es el total de la ejecución', () => {
    const logs = `Test | PASS |\n1 test, 1 passed, 0 failed\n...\nSuite | FAIL |\n2 tests, 1 passed, 1 failed\n`;
    expect(parseRobotSummary(logs)).toEqual({ total: 2, passed: 1, failed: 1, skipped: 0 });
  });

  it('devuelve null si no hay resumen (Robot no llegó a ejecutarse)', () => {
    expect(parseRobotSummary('failed to connect to the docker API')).toBeNull();
  });
});

// Robot sale con código 0 si todo lo ejecutado pasó, AUNQUE el test se haya omitido con `Skip`.
// Un test omitido no ha verificado nada: no puede contar como PASS.
describe('isPassingRun', () => {
  it('es verdadero con código 0 y al menos un test pasado', () => {
    expect(isPassingRun(0, false, summaryLine('1 test, 1 passed, 0 failed'))).toBe(true);
  });

  it('es falso si el test se omitió aunque el código de salida sea 0', () => {
    expect(isPassingRun(0, false, summaryLine('1 test, 0 passed, 0 failed, 1 skipped'))).toBe(
      false,
    );
  });

  it('es falso si algún test se omitió aunque otro haya pasado', () => {
    expect(isPassingRun(0, false, summaryLine('2 tests, 1 passed, 0 failed, 1 skipped'))).toBe(
      false,
    );
  });

  it('es falso si no hay resumen que lo confirme', () => {
    expect(isPassingRun(0, false, 'sin resumen')).toBe(false);
  });

  it('es falso si el código de salida no es 0', () => {
    expect(isPassingRun(1, false, summaryLine('1 test, 0 passed, 1 failed'))).toBe(false);
  });

  it('es falso si hubo timeout, aunque el resumen pareciera correcto', () => {
    expect(isPassingRun(0, true, summaryLine('1 test, 1 passed, 0 failed'))).toBe(false);
  });
});
