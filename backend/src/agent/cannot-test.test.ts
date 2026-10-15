import { describe, expect, it } from 'vitest';
import { parseCannotTest } from './cannot-test.js';

// D-42: al corregir, el modelo puede responder "CANNOT_TEST: <motivo>" cuando la US no se
// puede cumplir en esta aplicación y el usuario ya lo ha confirmado.
describe('parseCannotTest', () => {
  it('extrae el motivo', () => {
    expect(parseCannotTest('CANNOT_TEST: La aplicación no ofrece baja de cuenta')).toBe(
      'La aplicación no ofrece baja de cuenta',
    );
  });

  it('devuelve null con un .robot normal', () => {
    expect(parseCannotTest('*** Test Cases ***\nLogin\n    Log    hi')).toBeNull();
  });

  it('no confunde un NEEDS_INFO con un CANNOT_TEST', () => {
    expect(parseCannotTest('NEEDS_INFO: ¿Dónde?')).toBeNull();
  });
});
