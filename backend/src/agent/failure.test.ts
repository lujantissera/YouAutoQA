import { describe, expect, it } from 'vitest';
import { isRepeatedError, normalizeError } from './failure.js';

// US-10.3 / D-21: dos intentos seguidos que fallan por lo mismo => falta información.
describe('isRepeatedError', () => {
  it('es falso si no hay un intento anterior (primer fallo)', () => {
    expect(isRepeatedError(undefined, "Element 'login' not found")).toBe(false);
  });

  it('es verdadero con dos errores idénticos', () => {
    const log = "Element 'id=login' not found";
    expect(isRepeatedError(log, log)).toBe(true);
  });

  it('es verdadero si solo cambian números (tiempos, líneas)', () => {
    const before = "Element 'id=login' not found after 5.2 seconds (line 12)";
    const after = "Element 'id=login' not found after 5.4 seconds (line 14)";
    expect(isRepeatedError(before, after)).toBe(true);
  });

  it('ignora mayúsculas y espacios de más', () => {
    expect(isRepeatedError("Element  'Login' NOT found", "element 'login' not   found")).toBe(true);
  });

  it('es falso si el error es distinto de verdad', () => {
    const before = "Element 'id=login' not found";
    const after = "Element 'id=password' not found";
    expect(isRepeatedError(before, after)).toBe(false);
  });
});

describe('normalizeError', () => {
  it('sustituye los números por # y pasa a minúsculas', () => {
    expect(normalizeError('Timeout after 5.2 SECONDS at line 12')).toBe(
      'timeout after #.# seconds at line #',
    );
  });
});
